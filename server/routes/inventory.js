import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth.js';
import { all, get, insert, run, transaction } from '../db.js';
import {
  asyncHandler,
  audit,
  HttpError,
  isoDate,
  nowIso,
  optionalString,
  parse,
  requiredString,
  roundMoney,
} from '../utils.js';

const router = Router();
router.use(requireAuth);

const optionalId = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
  z.number().int().positive().nullable(),
);

const productSchema = z.object({
  name: requiredString('El nombre del producto', 2, 160),
  category_id: optionalId.optional(),
  brand: optionalString(80),
  model: optionalString(80),
  sku: optionalString(60),
  serial_number: optionalString(120),
  stock: z.coerce.number().int().min(0).max(999999).default(0),
  min_stock: z.coerce.number().int().min(0).max(999999).default(0),
  purchase_price: z.coerce.number().min(0).max(999999999).default(0),
  sale_price: z.coerce.number().min(0).max(999999999).default(0),
  supplier_id: optionalId.optional(),
  location: optionalString(120),
  entry_date: optionalString(20),
  active: z.boolean().optional().default(true),
});

const movementSchema = z.object({
  product_id: z.coerce.number().int().positive(),
  movement_type: z.enum(['ENTRADA', 'SALIDA', 'AJUSTE']),
  quantity: z.coerce.number().int().refine((value) => value !== 0, 'La cantidad debe ser distinta de cero.'),
  unit_cost: z.coerce.number().min(0).max(999999999).optional(),
  reason: requiredString('El motivo del movimiento', 3, 300),
  notes: optionalString(500),
  allow_negative: z.boolean().optional().default(false),
});

function productSelect(where = '', params = []) {
  return all(
    `SELECT p.*, pc.name AS category_name, s.name AS supplier_name,
      (p.stock <= p.min_stock) AS low_stock,
      (p.stock <= 0) AS out_of_stock,
      (p.stock * p.purchase_price) AS stock_value
     FROM products p
     LEFT JOIN product_categories pc ON pc.id = p.category_id
     LEFT JOIN suppliers s ON s.id = p.supplier_id
     ${where} ORDER BY p.active DESC, (p.stock <= p.min_stock) DESC, p.name COLLATE NOCASE`,
    params,
  );
}

router.get(
  '/stats',
  asyncHandler((req, res) => {
    const stats = get(
      `SELECT
        COUNT(*) AS products,
        COALESCE(SUM(stock), 0) AS units,
        COALESCE(SUM(stock * purchase_price), 0) AS purchase_value,
        COALESCE(SUM(stock * sale_price), 0) AS sale_value,
        COALESCE(SUM(CASE WHEN stock <= min_stock THEN 1 ELSE 0 END), 0) AS low_stock,
        COALESCE(SUM(CASE WHEN stock <= 0 THEN 1 ELSE 0 END), 0) AS out_of_stock
       FROM products WHERE active = 1`,
    );
    const categories = all(
      `SELECT pc.id, pc.name, COUNT(p.id) AS products, COALESCE(SUM(p.stock),0) AS units
       FROM product_categories pc LEFT JOIN products p ON p.category_id = pc.id AND p.active = 1
       GROUP BY pc.id ORDER BY pc.name`,
    );
    res.json({
      stats: {
        ...stats,
        purchase_value: roundMoney(stats.purchase_value),
        sale_value: roundMoney(stats.sale_value),
      },
      categories,
    });
  }),
);

router.get(
  '/products',
  asyncHandler((req, res) => {
    const where = ['1 = 1'];
    const params = [];
    const search = String(req.query.search || '').trim();
    if (search) {
      const like = `%${search.toLowerCase()}%`;
      where.push(
        `(lower(p.name) LIKE ? OR lower(COALESCE(p.sku,'')) LIKE ? OR lower(COALESCE(p.brand,'')) LIKE ? OR lower(COALESCE(p.model,'')) LIKE ? OR lower(COALESCE(p.serial_number,'')) LIKE ?)`,
      );
      params.push(like, like, like, like, like);
    }
    if (req.query.category_id) {
      where.push('p.category_id = ?');
      params.push(Number(req.query.category_id));
    }
    if (req.query.supplier_id) {
      where.push('p.supplier_id = ?');
      params.push(Number(req.query.supplier_id));
    }
    if (req.query.low_stock === '1') where.push('p.stock <= p.min_stock');
    if (req.query.active !== 'all') where.push('p.active = 1');
    const products = productSelect(`WHERE ${where.join(' AND ')}`, params);
    res.json({ products: products.map((product) => ({ ...product, active: Boolean(product.active), low_stock: Boolean(product.low_stock), out_of_stock: Boolean(product.out_of_stock) })) });
  }),
);

router.get(
  '/alerts',
  asyncHandler((req, res) => {
    const products = productSelect(
      'WHERE p.active = 1 AND p.stock <= p.min_stock',
    ).map((product) => ({ ...product, low_stock: Boolean(product.low_stock), out_of_stock: Boolean(product.out_of_stock) }));
    res.json({ alerts: products, count: products.length });
  }),
);

router.get(
  '/products/:id',
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const product = get(
      `SELECT p.*, pc.name AS category_name, s.name AS supplier_name
       FROM products p LEFT JOIN product_categories pc ON pc.id = p.category_id
       LEFT JOIN suppliers s ON s.id = p.supplier_id WHERE p.id = ?`,
      [id],
    );
    if (!product) throw new HttpError(404, 'Producto no encontrado.');
    const movements = all(
      `SELECT m.*, u.full_name AS created_by_name FROM inventory_movements m
       LEFT JOIN users u ON u.id = m.created_by WHERE m.product_id = ?
       ORDER BY m.created_at DESC LIMIT 60`,
      [id],
    );
    const usage = all(
      `SELECT op.quantity, op.unit_price, op.created_at, o.order_number
       FROM order_parts op JOIN orders o ON o.id = op.order_id
       WHERE op.product_id = ? AND op.removed_at IS NULL ORDER BY op.created_at DESC LIMIT 30`,
      [id],
    );
    res.json({ product: { ...product, active: Boolean(product.active), low_stock: product.stock <= product.min_stock }, movements, usage });
  }),
);

router.post(
  '/products',
  asyncHandler((req, res) => {
    const data = parse(productSchema, req.body);
    if (data.sku && get('SELECT id FROM products WHERE sku = ?', [data.sku])) {
      throw new HttpError(409, 'Ya existe un producto con ese código interno (SKU).');
    }
    if (data.category_id && !get('SELECT id FROM product_categories WHERE id = ?', [data.category_id])) {
      throw new HttpError(422, 'La categoría seleccionada no existe.');
    }
    if (data.supplier_id && !get('SELECT id FROM suppliers WHERE id = ?', [data.supplier_id])) {
      throw new HttpError(422, 'El proveedor seleccionado no existe.');
    }
    const productId = transaction(() => {
      const id = insert(
        `INSERT INTO products (name, category_id, brand, model, sku, serial_number, stock, min_stock,
          purchase_price, sale_price, supplier_id, location, entry_date, active, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          data.name,
          data.category_id,
          data.brand,
          data.model,
          data.sku,
          data.serial_number,
          data.stock,
          data.min_stock,
          data.purchase_price,
          data.sale_price,
          data.supplier_id,
          data.location,
          data.entry_date || isoDate(),
          data.active ? 1 : 0,
          nowIso(),
          nowIso(),
        ],
      );
      if (data.stock > 0) {
        insert(
          `INSERT INTO inventory_movements (product_id, movement_type, quantity, stock_after, unit_cost, reason, reference_type, created_by)
           VALUES (?, 'ENTRADA', ?, ?, ?, 'Stock inicial', 'PRODUCTO', ?)`,
          [id, data.stock, data.stock, data.purchase_price, req.user.id],
        );
      }
      return id;
    });
    audit(req, 'PRODUCT_CREATE', 'product', productId, `Se creó el repuesto ${data.name}.`);
    res.status(201).json({
      ok: true,
      message: 'Producto agregado al inventario.',
      product: get('SELECT * FROM products WHERE id = ?', [productId]),
    });
  }),
);

router.patch(
  '/products/:id',
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const current = get('SELECT * FROM products WHERE id = ?', [id]);
    if (!current) throw new HttpError(404, 'Producto no encontrado.');
    const schema = productSchema.partial().omit({ stock: true });
    const data = parse(schema, req.body);
    if (data.sku !== undefined && data.sku && data.sku !== current.sku) {
      if (get('SELECT id FROM products WHERE sku = ? AND id <> ?', [data.sku, id])) {
        throw new HttpError(409, 'Ya existe otro producto con ese código interno.');
      }
    }
    const fields = [];
    const params = [];
    for (const field of [
      'name',
      'category_id',
      'brand',
      'model',
      'sku',
      'serial_number',
      'min_stock',
      'purchase_price',
      'sale_price',
      'supplier_id',
      'location',
      'entry_date',
      'active',
    ]) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(field === 'active' ? (data[field] ? 1 : 0) : data[field]);
      }
    }
    if (!fields.length) throw new HttpError(400, 'No hay cambios para guardar.');
    fields.push('updated_at = ?');
    params.push(nowIso(), id);
    run(`UPDATE products SET ${fields.join(', ')} WHERE id = ?`, params);
    audit(req, 'PRODUCT_UPDATE', 'product', id, `Se actualizó el repuesto ${current.name}.`);
    res.json({ ok: true, message: 'Producto actualizado.', product: get('SELECT * FROM products WHERE id = ?', [id]) });
  }),
);

router.delete(
  '/products/:id',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const product = get('SELECT * FROM products WHERE id = ?', [id]);
    if (!product) throw new HttpError(404, 'Producto no encontrado.');
    run('UPDATE products SET active = 0, updated_at = ? WHERE id = ?', [nowIso(), id]);
    audit(req, 'PRODUCT_DEACTIVATE', 'product', id, `Se dio de baja el repuesto ${product.name}.`);
    res.json({ ok: true, message: 'Producto dado de baja. El historial se conserva.' });
  }),
);

router.get(
  '/movements',
  asyncHandler((req, res) => {
    const where = [];
    const params = [];
    if (req.query.product_id) {
      where.push('m.product_id = ?');
      params.push(Number(req.query.product_id));
    }
    if (req.query.type) {
      where.push('m.movement_type = ?');
      params.push(String(req.query.type).toUpperCase());
    }
    if (req.query.from) {
      where.push('date(m.created_at) >= date(?)');
      params.push(req.query.from);
    }
    if (req.query.to) {
      where.push('date(m.created_at) <= date(?)');
      params.push(req.query.to);
    }
    const limit = Math.min(200, Number(req.query.limit) || 80);
    const movements = all(
      `SELECT m.*, p.name AS product_name, p.sku, u.full_name AS created_by_name
       FROM inventory_movements m JOIN products p ON p.id = m.product_id
       LEFT JOIN users u ON u.id = m.created_by
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY m.created_at DESC LIMIT ?`,
      [...params, limit],
    );
    res.json({ movements });
  }),
);

router.post(
  '/movements',
  asyncHandler((req, res) => {
    const data = parse(movementSchema, req.body);
    const product = get('SELECT * FROM products WHERE id = ? AND active = 1', [data.product_id]);
    if (!product) throw new HttpError(422, 'El producto no existe o está inactivo.');
    if (data.movement_type === 'SALIDA' && data.quantity < 0) {
      throw new HttpError(422, 'La cantidad de una salida debe ser positiva.');
    }
    if (data.movement_type !== 'AJUSTE' && data.quantity < 0) {
      throw new HttpError(422, 'La cantidad debe ser positiva.');
    }
    const delta =
      data.movement_type === 'ENTRADA'
        ? Math.abs(data.quantity)
        : data.movement_type === 'SALIDA'
          ? -Math.abs(data.quantity)
          : data.quantity;
    const stockAfter = Number(product.stock) + delta;
    if (stockAfter < 0 && !(data.allow_negative && req.user.role === 'admin')) {
      throw new HttpError(
        409,
        `La operación dejaría stock negativo (${stockAfter}). Un administrador debe autorizarlo explícitamente.`,
        { available: product.stock, requested: Math.abs(delta) },
      );
    }
    const movementId = transaction(() => {
      run('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?', [stockAfter, nowIso(), product.id]);
      return insert(
        `INSERT INTO inventory_movements (product_id, movement_type, quantity, stock_after, unit_cost, reason, notes, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          product.id,
          data.movement_type,
          delta,
          stockAfter,
          data.unit_cost ?? product.purchase_price,
          data.reason,
          data.notes,
          req.user.id,
        ],
      );
    });
    audit(
      req,
      'INVENTORY_MOVEMENT',
      'product',
      product.id,
      `Movimiento ${data.movement_type} de ${delta > 0 ? '+' : ''}${delta} en ${product.name}. Stock: ${stockAfter}.`,
    );
    res.status(201).json({
      ok: true,
      message: `Movimiento registrado. Stock actual de ${product.name}: ${stockAfter}.`,
      warning: stockAfter < 0 ? 'El producto quedó con stock negativo bajo autorización administrativa.' : null,
      stock: stockAfter,
      movement: get('SELECT * FROM inventory_movements WHERE id = ?', [movementId]),
    });
  }),
);

const categorySchema = z.object({ name: requiredString('El nombre de la categoría', 2, 80) });
router.get('/categories', (req, res) => {
  res.json({ categories: all('SELECT * FROM product_categories ORDER BY name') });
});
router.post(
  '/categories',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const data = parse(categorySchema, req.body);
    if (get('SELECT id FROM product_categories WHERE name = ? COLLATE NOCASE', [data.name])) {
      throw new HttpError(409, 'Esa categoría ya existe.');
    }
    const id = insert('INSERT INTO product_categories (name) VALUES (?)', [data.name]);
    audit(req, 'CATEGORY_CREATE', 'product_category', id, `Se creó la categoría ${data.name}.`);
    res.status(201).json({ ok: true, message: 'Categoría creada.', category: get('SELECT * FROM product_categories WHERE id = ?', [id]) });
  }),
);

const supplierSchema = z.object({
  name: requiredString('El nombre del proveedor', 2, 120),
  contact_name: optionalString(120),
  phone: optionalString(40),
  email: optionalString(120),
  address: optionalString(200),
  cuit: optionalString(30),
  notes: optionalString(1000),
  active: z.boolean().optional().default(true),
});

router.get('/suppliers', (req, res) => {
  const suppliers = all(
    `SELECT s.*, COUNT(p.id) AS products_count,
      (SELECT COUNT(*) FROM transactions t WHERE t.supplier_id = s.id AND t.deleted_at IS NULL) AS purchases_count
     FROM suppliers s LEFT JOIN products p ON p.supplier_id = s.id
     GROUP BY s.id ORDER BY s.active DESC, s.name COLLATE NOCASE`,
  ).map((supplier) => ({ ...supplier, active: Boolean(supplier.active) }));
  res.json({ suppliers });
});

router.post(
  '/suppliers',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const data = parse(supplierSchema, req.body);
    const id = insert(
      `INSERT INTO suppliers (name, contact_name, phone, email, address, cuit, notes, active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [data.name, data.contact_name, data.phone, data.email, data.address, data.cuit, data.notes, data.active ? 1 : 0, nowIso(), nowIso()],
    );
    audit(req, 'SUPPLIER_CREATE', 'supplier', id, `Se creó el proveedor ${data.name}.`);
    res.status(201).json({ ok: true, message: 'Proveedor registrado.', supplier: get('SELECT * FROM suppliers WHERE id = ?', [id]) });
  }),
);

router.patch(
  '/suppliers/:id',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const supplier = get('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!supplier) throw new HttpError(404, 'Proveedor no encontrado.');
    const data = parse(supplierSchema.partial(), req.body);
    const fields = [];
    const params = [];
    for (const field of ['name', 'contact_name', 'phone', 'email', 'address', 'cuit', 'notes', 'active']) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(field === 'active' ? (data[field] ? 1 : 0) : data[field]);
      }
    }
    if (!fields.length) throw new HttpError(400, 'No hay cambios para guardar.');
    fields.push('updated_at = ?');
    params.push(nowIso(), id);
    run(`UPDATE suppliers SET ${fields.join(', ')} WHERE id = ?`, params);
    audit(req, 'SUPPLIER_UPDATE', 'supplier', id, `Se actualizó el proveedor ${supplier.name}.`);
    res.json({ ok: true, message: 'Proveedor actualizado.', supplier: get('SELECT * FROM suppliers WHERE id = ?', [id]) });
  }),
);

router.delete(
  '/suppliers/:id',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const supplier = get('SELECT * FROM suppliers WHERE id = ?', [id]);
    if (!supplier) throw new HttpError(404, 'Proveedor no encontrado.');
    run('UPDATE suppliers SET active = 0, updated_at = ? WHERE id = ?', [nowIso(), id]);
    audit(req, 'SUPPLIER_DEACTIVATE', 'supplier', id, `Se dio de baja el proveedor ${supplier.name}.`);
    res.json({ ok: true, message: 'Proveedor dado de baja.' });
  }),
);

export default router;
