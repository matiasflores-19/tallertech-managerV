import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth.js';
import { all, get, insert, run, transaction } from '../db.js';
import {
  asyncHandler,
  audit,
  clientName,
  emailSchema,
  HttpError,
  isoDate,
  normalizePhone,
  nowIso,
  optionalDaySchema,
  optionalDateSchema,
  optionalString,
  ORDER_STATUSES,
  parse,
  PAYMENT_METHODS,
  PAYMENT_TYPES,
  phoneSchema,
  PRIORITIES,
  requiredString,
  roundMoney,
  STATUS_META,
} from '../utils.js';
import { decryptSecret, encryptSecret } from '../security.js';
import { saveOrderPhotos } from '../services/uploads.js';
import { renderOrderReceipt } from '../services/pdf.js';

const router = Router();
router.use(requireAuth);

const optionalId = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
  z.number().int().positive().nullable(),
);

const clientInputSchema = z.object({
  first_name: requiredString('El nombre', 2, 80),
  last_name: requiredString('El apellido', 2, 80),
  phone: phoneSchema,
  email: emailSchema,
  dni: optionalString(20),
  address: optionalString(200),
  notes: optionalString(1000),
});

const createOrderSchema = z
  .object({
    client_id: optionalId.optional(),
    client: clientInputSchema.optional(),
    equipment_type_id: z.coerce.number().int().positive(),
    brand: requiredString('La marca', 1, 80),
    model: requiredString('El modelo', 1, 120),
    serial_number: optionalString(120),
    imei: optionalString(40),
    color: optionalString(60),
    accessories: optionalString(500),
    unlock_type: optionalString(40),
    unlock_secret: optionalString(200),
    intake_at: optionalDateSchema.optional(),
    declared_issue: requiredString('La falla declarada', 3, 300),
    detailed_problem: optionalString(3000),
    physical_condition: optionalString(2000),
    visible_damage: optionalString(1000),
    initial_diagnosis: optionalString(3000),
    technician_id: optionalId.optional(),
    priority: z.enum(PRIORITIES).default('NORMAL'),
    estimated_budget: z.coerce.number().min(0).max(999999999).default(0),
    estimated_delivery: optionalDaySchema.optional(),
    internal_notes: optionalString(3000),
    deposit_amount: z.coerce.number().min(0).max(999999999).default(0),
    payment_method: z.enum(PAYMENT_METHODS).default('EFECTIVO'),
    photos: z
      .array(z.object({ data_url: z.string().min(20), label: optionalString(60) }))
      .max(6, 'Podés adjuntar hasta 6 fotografías.')
      .optional(),
  })
  .refine((data) => data.client_id || data.client, {
    message: 'Seleccioná un cliente existente o cargá uno nuevo.',
    path: ['client_id'],
  })
  .refine((data) => !data.deposit_amount || data.estimated_budget >= data.deposit_amount, {
    message: 'La seña no puede superar el presupuesto estimado.',
    path: ['deposit_amount'],
  });

const updateOrderSchema = z.object({
  equipment_type_id: optionalId.optional(),
  brand: requiredString('La marca', 1, 80).optional(),
  model: requiredString('El modelo', 1, 120).optional(),
  serial_number: optionalString(120).optional(),
  imei: optionalString(40).optional(),
  color: optionalString(60).optional(),
  accessories: optionalString(500).optional(),
  unlock_type: optionalString(40).optional(),
  unlock_secret: optionalString(200).optional(),
  declared_issue: requiredString('La falla declarada', 3, 300).optional(),
  detailed_problem: optionalString(3000).optional(),
  physical_condition: optionalString(2000).optional(),
  visible_damage: optionalString(1000).optional(),
  initial_diagnosis: optionalString(3000).optional(),
  technician_id: optionalId.optional(),
  priority: z.enum(PRIORITIES).optional(),
  estimated_budget: z.coerce.number().min(0).max(999999999).optional(),
  estimated_delivery: optionalDaySchema.optional(),
  internal_notes: optionalString(3000).optional(),
  labor_cost: z.coerce.number().min(0).max(999999999).optional(),
  final_price: z.coerce.number().min(0).max(999999999).optional(),
});

const partsCostSql = `COALESCE((SELECT SUM(op.quantity * op.unit_cost) FROM order_parts op WHERE op.order_id = o.id AND op.removed_at IS NULL), 0)`;
const partsTotalSql = `COALESCE((SELECT SUM(op.quantity * op.unit_price) FROM order_parts op WHERE op.order_id = o.id AND op.removed_at IS NULL), 0)`;
const partsCountSql = `COALESCE((SELECT SUM(op.quantity) FROM order_parts op WHERE op.order_id = o.id AND op.removed_at IS NULL), 0)`;
const paidSql = `COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id AND p.deleted_at IS NULL), 0)`;

function decorateOrder(row) {
  if (!row) return null;
  const billable = Number(row.final_price) > 0 ? Number(row.final_price) : Number(row.estimated_budget || 0);
  const paid = Number(row.paid_total || 0);
  return {
    ...row,
    has_unlock: Boolean(row.unlock_secret_enc),
    unlock_secret_enc: undefined,
    billable: roundMoney(billable),
    paid_total: roundMoney(paid),
    balance: roundMoney(Math.max(billable - paid, 0)),
    parts_cost: roundMoney(row.parts_cost),
    parts_total: roundMoney(row.parts_total),
    status_label: STATUS_META[row.status]?.label || row.status,
    client_name: clientName(row),
  };
}

const orderSelect = `
  SELECT o.*, c.first_name, c.last_name, c.phone AS client_phone, c.email AS client_email,
    c.dni AS client_dni, c.address AS client_address,
    et.name AS equipment_type_name,
    t.name AS technician_name,
    ${partsCostSql} AS parts_cost,
    ${partsTotalSql} AS parts_total,
    ${partsCountSql} AS parts_count,
    ${paidSql} AS paid_total
  FROM orders o
  JOIN clients c ON c.id = o.client_id
  JOIN equipment_types et ON et.id = o.equipment_type_id
  LEFT JOIN technicians t ON t.id = o.technician_id
`;

router.get(
  '/stats',
  asyncHandler((req, res) => {
    const rows = all('SELECT status, COUNT(*) AS count FROM orders GROUP BY status');
    const counts = Object.fromEntries(ORDER_STATUSES.map((status) => [status, 0]));
    for (const row of rows) counts[row.status] = row.count;
    res.json({ counts, total: rows.reduce((sum, row) => sum + row.count, 0) });
  }),
);

router.get(
  '/',
  asyncHandler((req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const where = [];
    const params = [];

    if (req.query.status) {
      const statuses = String(req.query.status)
        .split(',')
        .map((status) => status.trim().toUpperCase())
        .filter((status) => ORDER_STATUSES.includes(status));
      if (statuses.length) {
        where.push(`o.status IN (${statuses.map(() => '?').join(',')})`);
        params.push(...statuses);
      }
    }
    if (req.query.active === '1') {
      where.push("o.status NOT IN ('ENTREGADO','CANCELADO','SIN_REPARACION')");
    }
    if (req.query.equipment_type_id) {
      where.push('o.equipment_type_id = ?');
      params.push(Number(req.query.equipment_type_id));
    }
    if (req.query.technician_id) {
      where.push('o.technician_id = ?');
      params.push(Number(req.query.technician_id));
    }
    if (req.query.client_id) {
      where.push('o.client_id = ?');
      params.push(Number(req.query.client_id));
    }
    if (req.query.priority) {
      where.push('o.priority = ?');
      params.push(String(req.query.priority).toUpperCase());
    }
    if (req.query.from) {
      where.push('date(o.intake_at) >= date(?)');
      params.push(req.query.from);
    }
    if (req.query.to) {
      where.push('date(o.intake_at) <= date(?)');
      params.push(req.query.to);
    }
    if (req.query.overdue === '1') {
      where.push("o.estimated_delivery IS NOT NULL AND date(o.estimated_delivery) < date('now') AND o.status NOT IN ('ENTREGADO','CANCELADO','SIN_REPARACION')");
    }
    const search = String(req.query.search || '').trim();
    if (search) {
      const like = `%${search.toLowerCase()}%`;
      where.push(`(
        lower(o.order_number) LIKE ? OR
        lower(c.first_name || ' ' || c.last_name) LIKE ? OR
        c.phone LIKE ? OR lower(o.brand) LIKE ? OR lower(o.model) LIKE ? OR
        lower(COALESCE(o.serial_number,'')) LIKE ? OR lower(COALESCE(o.imei,'')) LIKE ?
      )`);
      params.push(like, like, `%${search}%`, like, like, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const sortMap = {
      recent: 'o.created_at DESC',
      oldest: 'o.created_at ASC',
      delivery: 'o.estimated_delivery ASC',
      priority: "CASE o.priority WHEN 'URGENTE' THEN 0 WHEN 'ALTA' THEN 1 WHEN 'NORMAL' THEN 2 ELSE 3 END, o.created_at DESC",
      updated: 'o.updated_at DESC',
    };
    const sort = sortMap[req.query.sort] || sortMap.recent;
    const total = get(
      `SELECT COUNT(*) AS count FROM orders o JOIN clients c ON c.id = o.client_id ${whereSql}`,
      params,
    ).count;
    const rows = all(`${orderSelect} ${whereSql} ORDER BY ${sort} LIMIT ? OFFSET ?`, [...params, limit, offset]);
    res.json({
      orders: rows.map(decorateOrder),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  }),
);

router.get(
  '/:id',
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const order = decorateOrder(get(`${orderSelect} WHERE o.id = ?`, [id]));
    if (!order) throw new HttpError(404, 'Orden de reparación no encontrada.');
    const client = get('SELECT * FROM clients WHERE id = ?', [order.client_id]);
    const statusHistory = all(
      `SELECT h.*, u.full_name AS changed_by_name FROM order_status_history h
       LEFT JOIN users u ON u.id = h.changed_by WHERE h.order_id = ? ORDER BY h.created_at DESC`,
      [id],
    );
    const interventions = all(
      `SELECT i.*, u.full_name AS created_by_name, t.name AS technician_name
       FROM order_interventions i LEFT JOIN users u ON u.id = i.created_by
       LEFT JOIN technicians t ON t.id = i.technician_id
       WHERE i.order_id = ? ORDER BY i.created_at DESC`,
      [id],
    );
    const parts = all(
      `SELECT op.*, p.name, p.sku, p.brand AS product_brand, p.model AS product_model
       FROM order_parts op JOIN products p ON p.id = op.product_id
       WHERE op.order_id = ? AND op.removed_at IS NULL ORDER BY op.created_at`,
      [id],
    );
    const payments = all(
      `SELECT p.*, u.full_name AS created_by_name FROM payments p
       LEFT JOIN users u ON u.id = p.created_by
       WHERE p.order_id = ? AND p.deleted_at IS NULL ORDER BY p.received_at DESC`,
      [id],
    );
    const photos = all(
      `SELECT id, label, mime_type, created_at, file_name FROM order_photos WHERE order_id = ? ORDER BY created_at`,
      [id],
    ).map((photo) => ({ ...photo, url: `/api/orders/${id}/photos/${photo.id}` }));
    res.json({ order, client, statusHistory, interventions, parts, payments, photos });
  }),
);

router.post(
  '/',
  asyncHandler((req, res) => {
    const data = parse(createOrderSchema, req.body);
    const equipmentType = get('SELECT id, name FROM equipment_types WHERE id = ? AND active = 1', [
      data.equipment_type_id,
    ]);
    if (!equipmentType) throw new HttpError(422, 'El tipo de equipo seleccionado no es válido.');
    if (data.technician_id) {
      const technician = get('SELECT id FROM technicians WHERE id = ? AND active = 1', [data.technician_id]);
      if (!technician) throw new HttpError(422, 'El técnico seleccionado no es válido.');
    }

    let client = null;
    if (data.client_id) {
      client = get('SELECT * FROM clients WHERE id = ?', [data.client_id]);
      if (!client) throw new HttpError(422, 'El cliente seleccionado no existe.');
    } else {
      const normalized = normalizePhone(data.client.phone);
      const existing = get('SELECT * FROM clients WHERE phone_normalized = ?', [normalized]);
      if (existing) {
        throw new HttpError(409, 'Ya existe un cliente con ese teléfono.', {
          existingClient: {
            id: existing.id,
            first_name: existing.first_name,
            last_name: existing.last_name,
            phone: existing.phone,
          },
        });
      }
    }

    const created = transaction(() => {
      let clientId = data.client_id || null;
      if (!clientId) {
        clientId = insert(
          `INSERT INTO clients (first_name, last_name, phone, phone_normalized, email, dni, address, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            data.client.first_name,
            data.client.last_name,
            data.client.phone,
            normalizePhone(data.client.phone),
            data.client.email,
            data.client.dni,
            data.client.address,
            data.client.notes,
            nowIso(),
            nowIso(),
          ],
        );
      }
      const orderNumber = (() => {
        const year = new Date().getFullYear();
        const row = get(
          `SELECT order_number FROM orders WHERE order_number LIKE ? ORDER BY id DESC LIMIT 1`,
          [`OT-${year}-%`],
        );
        let sequence = 1;
        if (row) {
          const match = row.order_number.match(/(\d+)$/);
          if (match) sequence = Number(match[1]) + 1;
        }
        return `OT-${year}-${String(sequence).padStart(4, '0')}`;
      })();

      const orderId = insert(
        `INSERT INTO orders (
          order_number, client_id, equipment_type_id, brand, model, serial_number, imei, color, accessories,
          unlock_type, unlock_secret_enc, intake_at, declared_issue, detailed_problem, physical_condition,
          visible_damage, initial_diagnosis, technician_id, status, priority, estimated_budget,
          estimated_delivery, internal_notes, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'RECIBIDO', ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderNumber,
          clientId,
          data.equipment_type_id,
          data.brand,
          data.model,
          data.serial_number,
          data.imei,
          data.color,
          data.accessories,
          data.unlock_type,
          data.unlock_secret ? encryptSecret(data.unlock_secret) : null,
          data.intake_at || nowIso(),
          data.declared_issue,
          data.detailed_problem,
          data.physical_condition,
          data.visible_damage,
          data.initial_diagnosis,
          data.technician_id,
          data.priority,
          data.estimated_budget,
          data.estimated_delivery,
          data.internal_notes,
          req.user.id,
          nowIso(),
          nowIso(),
        ],
      );

      run(
        `INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by, created_at)
         VALUES (?, NULL, 'RECIBIDO', ?, ?, ?)`,
        [orderId, 'Ingreso del equipo al taller.', req.user.id, nowIso()],
      );
      if (data.initial_diagnosis) {
        insert(
          `INSERT INTO order_interventions (order_id, type, description, technician_id, created_by, created_at)
           VALUES (?, 'DIAGNOSTICO', ?, ?, ?, ?)`,
          [orderId, data.initial_diagnosis, data.technician_id, req.user.id, nowIso()],
        );
      }
      if (data.deposit_amount > 0) {
        const paymentId = insert(
          `INSERT INTO payments (order_id, client_id, amount, method, payment_type, notes, received_at, created_by, created_at)
           VALUES (?, ?, ?, ?, 'SENA', 'Seña registrada al ingresar el equipo.', ?, ?, ?)`,
          [orderId, clientId, data.deposit_amount, data.payment_method, nowIso(), req.user.id, nowIso()],
        );
        insert(
          `INSERT INTO transactions (type, category, description, amount, method, transaction_date, order_id, payment_id, notes, created_by)
           VALUES ('INGRESO', 'Seña de reparación', ?, ?, ?, ?, ?, ?, 'Seña de ingreso', ?)`,
          [
            `Seña de la orden ${orderNumber}`,
            data.deposit_amount,
            data.payment_method,
            isoDate(),
            orderId,
            paymentId,
            req.user.id,
          ],
        );
      }
      return { orderId, orderNumber, clientId };
    });

    const photos = saveOrderPhotos(created.orderId, data.photos || []);
    for (const photo of photos) {
      insert('INSERT INTO order_photos (order_id, file_name, mime_type, data, label) VALUES (?, ?, ?, ?, ?)', [
        created.orderId,
        photo.fileName,
        photo.mime,
        photo.buffer,
        photo.label,
      ]);
    }
    audit(
      req,
      'ORDER_CREATE',
      'order',
      created.orderId,
      `Se registró la orden ${created.orderNumber} (${equipmentType.name} ${data.brand} ${data.model}).`,
    );
    const full = decorateOrder(get(`${orderSelect} WHERE o.id = ?`, [created.orderId]));
    res.status(201).json({
      ok: true,
      message: `Equipo ingresado correctamente. Orden ${created.orderNumber}.`,
      order: full,
    });
  }),
);

router.patch(
  '/:id',
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const current = get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!current) throw new HttpError(404, 'Orden no encontrada.');
    const data = parse(updateOrderSchema, req.body);
    const fields = [];
    const params = [];
    for (const field of [
      'equipment_type_id',
      'brand',
      'model',
      'serial_number',
      'imei',
      'color',
      'accessories',
      'unlock_type',
      'declared_issue',
      'detailed_problem',
      'physical_condition',
      'visible_damage',
      'initial_diagnosis',
      'technician_id',
      'priority',
      'estimated_budget',
      'estimated_delivery',
      'internal_notes',
      'labor_cost',
      'final_price',
    ]) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(data[field]);
      }
    }
    if (data.unlock_secret !== undefined) {
      fields.push('unlock_secret_enc = ?');
      params.push(data.unlock_secret ? encryptSecret(data.unlock_secret) : null);
    }
    if (!fields.length) throw new HttpError(400, 'No hay cambios para guardar.');
    fields.push('updated_at = ?');
    params.push(nowIso(), id);
    run(`UPDATE orders SET ${fields.join(', ')} WHERE id = ?`, params);

    if (data.initial_diagnosis && data.initial_diagnosis !== current.initial_diagnosis) {
      insert(
        `INSERT INTO order_interventions (order_id, type, description, created_by, created_at)
         VALUES (?, 'DIAGNOSTICO', ?, ?, ?)`,
        [id, data.initial_diagnosis, req.user.id, nowIso()],
      );
    }
    audit(req, 'ORDER_UPDATE', 'order', id, `Se actualizó la orden ${current.order_number}.`);
    res.json({
      ok: true,
      message: 'Orden actualizada correctamente.',
      order: decorateOrder(get(`${orderSelect} WHERE o.id = ?`, [id])),
    });
  }),
);

router.patch(
  '/:id/status',
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const order = get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) throw new HttpError(404, 'Orden no encontrada.');
    const schema = z.object({
      status: z.enum(ORDER_STATUSES),
      note: optionalString(1000),
      cancellation_reason: optionalString(500),
    });
    const data = parse(schema, req.body);
    if (data.status === order.status) throw new HttpError(400, 'La orden ya se encuentra en ese estado.');
    const deliveredAt = data.status === 'ENTREGADO' ? nowIso() : order.delivered_at;
    transaction(() => {
      run('UPDATE orders SET status = ?, updated_at = ?, delivered_at = ?, cancellation_reason = ? WHERE id = ?', [
        data.status,
        nowIso(),
        deliveredAt,
        data.status === 'CANCELADO' ? data.cancellation_reason || data.note || 'Cancelada por el taller.' : order.cancellation_reason,
        id,
      ]);
      insert(
        `INSERT INTO order_status_history (order_id, from_status, to_status, note, changed_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, order.status, data.status, data.note || null, req.user.id, nowIso()],
      );
      if (data.note) {
        insert(
          `INSERT INTO order_interventions (order_id, type, description, created_by, created_at)
           VALUES (?, 'NOTA', ?, ?, ?)`,
          [id, data.note, req.user.id, nowIso()],
        );
      }
    });
    audit(
      req,
      'ORDER_STATUS',
      'order',
      id,
      `Orden ${order.order_number}: ${STATUS_META[order.status].label} → ${STATUS_META[data.status].label}.`,
    );
    const decorated = decorateOrder(get(`${orderSelect} WHERE o.id = ?`, [id]));
    const warning =
      data.status === 'ENTREGADO' && decorated.balance > 0
        ? `La orden se marcó como entregada con un saldo pendiente de $${decorated.balance.toLocaleString('es-AR')}.`
        : null;
    res.json({
      ok: true,
      message: `Estado actualizado a “${STATUS_META[data.status].label}”.`,
      warning,
      order: decorated,
    });
  }),
);

router.post(
  '/:id/interventions',
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const order = get('SELECT id, order_number FROM orders WHERE id = ?', [id]);
    if (!order) throw new HttpError(404, 'Orden no encontrada.');
    const schema = z.object({
      type: z.enum(['DIAGNOSTICO', 'REPARACION', 'PRUEBA', 'NOTA']).default('NOTA'),
      description: requiredString('La descripción', 3, 3000),
      technician_id: optionalId.optional(),
    });
    const data = parse(schema, req.body);
    const interventionId = insert(
      `INSERT INTO order_interventions (order_id, type, description, technician_id, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.type, data.description, data.technician_id || null, req.user.id, nowIso()],
    );
    audit(req, 'INTERVENTION_CREATE', 'order', id, `Se agregó una intervención a la orden ${order.order_number}.`);
    res.status(201).json({
      ok: true,
      message: 'Intervención registrada.',
      intervention: get('SELECT * FROM order_interventions WHERE id = ?', [interventionId]),
    });
  }),
);

router.post(
  '/:id/parts',
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const order = get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) throw new HttpError(404, 'Orden no encontrada.');
    if (['ENTREGADO', 'CANCELADO'].includes(order.status)) {
      throw new HttpError(400, 'No podés agregar repuestos a una orden entregada o cancelada.');
    }
    const schema = z.object({
      product_id: z.coerce.number().int().positive(),
      quantity: z.coerce.number().int().positive().max(9999),
      unit_price: z.coerce.number().min(0).max(999999999).optional(),
      unit_cost: z.coerce.number().min(0).max(999999999).optional(),
      notes: optionalString(500),
      allow_negative: z.boolean().optional().default(false),
    });
    const data = parse(schema, req.body);
    const product = get('SELECT * FROM products WHERE id = ? AND active = 1', [data.product_id]);
    if (!product) throw new HttpError(422, 'El repuesto no existe o está inactivo.');
    if (product.stock < data.quantity && !(data.allow_negative && req.user.role === 'admin')) {
      throw new HttpError(
        409,
        `Stock insuficiente de “${product.name}”. Disponible: ${product.stock}. Un administrador puede autorizar stock negativo.`,
        { available: product.stock, productId: product.id },
      );
    }
    const unitPrice = data.unit_price ?? Number(product.sale_price || 0);
    const unitCost = data.unit_cost ?? Number(product.purchase_price || 0);
    const stockAfter = Number(product.stock) - data.quantity;
    const part = transaction(() => {
      const partId = insert(
        `INSERT INTO order_parts (order_id, product_id, quantity, unit_cost, unit_price, notes, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, product.id, data.quantity, unitCost, unitPrice, data.notes, req.user.id, nowIso()],
      );
      run('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?', [stockAfter, nowIso(), product.id]);
      insert(
        `INSERT INTO inventory_movements (product_id, movement_type, quantity, stock_after, unit_cost, reason, reference_type, reference_id, notes, created_by)
         VALUES (?, 'SALIDA', ?, ?, ?, ?, 'REPARACION', ?, ?, ?)`,
        [
          product.id,
          -data.quantity,
          stockAfter,
          unitCost,
          `Repuesto usado en orden ${order.order_number}`,
          id,
          data.notes || null,
          req.user.id,
        ],
      );
      return get('SELECT * FROM order_parts WHERE id = ?', [partId]);
    });
    audit(req, 'ORDER_PART_ADD', 'order', id, `Se agregó ${data.quantity} × ${product.name} a la orden ${order.order_number}.`);
    res.status(201).json({
      ok: true,
      message: `Repuesto agregado. Stock actual: ${stockAfter}.`,
      warning: stockAfter < 0 ? 'Se autorizó stock negativo para este repuesto.' : null,
      part,
      stock: stockAfter,
    });
  }),
);

router.delete(
  '/:id/parts/:partId',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const partId = Number(req.params.partId);
    const part = get(
      `SELECT op.*, p.name, p.stock AS product_stock, o.order_number
       FROM order_parts op JOIN products p ON p.id = op.product_id JOIN orders o ON o.id = op.order_id
       WHERE op.id = ? AND op.order_id = ? AND op.removed_at IS NULL`,
      [partId, id],
    );
    if (!part) throw new HttpError(404, 'Repuesto de la orden no encontrado.');
    transaction(() => {
      run('UPDATE order_parts SET removed_at = ? WHERE id = ?', [nowIso(), partId]);
      const stockAfter = Number(part.product_stock) + Number(part.quantity);
      run('UPDATE products SET stock = ?, updated_at = ? WHERE id = ?', [stockAfter, nowIso(), part.product_id]);
      insert(
        `INSERT INTO inventory_movements (product_id, movement_type, quantity, stock_after, unit_cost, reason, reference_type, reference_id, notes, created_by)
         VALUES (?, 'ENTRADA', ?, ?, ?, ?, 'REPARACION', ?, 'Reversión de repuesto', ?)`,
        [
          part.product_id,
          part.quantity,
          stockAfter,
          part.unit_cost,
          `Reversión de repuesto en orden ${part.order_number}`,
          id,
          req.user.id,
        ],
      );
    });
    audit(req, 'ORDER_PART_REMOVE', 'order', id, `Se quitó ${part.name} de la orden ${part.order_number}.`);
    res.json({ ok: true, message: 'Repuesto quitado y stock restituido.' });
  }),
);

router.post(
  '/:id/payments',
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const order = get(`${orderSelect} WHERE o.id = ?`, [id]);
    if (!order) throw new HttpError(404, 'Orden no encontrada.');
    if (order.status === 'CANCELADO') throw new HttpError(400, 'No podés registrar pagos de una orden cancelada.');
    const schema = z.object({
      amount: z.coerce.number().positive('El importe debe ser mayor a cero.').max(999999999),
      method: z.enum(PAYMENT_METHODS),
      payment_type: z.enum(PAYMENT_TYPES).default('PAGO_PARCIAL'),
      reference: optionalString(120),
      notes: optionalString(500),
      received_at: optionalDateSchema.optional(),
    });
    const data = parse(schema, req.body);
    const billable = Number(order.final_price) > 0 ? Number(order.final_price) : Number(order.estimated_budget || 0);
    const paid = Number(order.paid_total || 0);
    const balance = Math.max(billable - paid, 0);
    if (billable > 0 && data.amount > balance + 0.009) {
      throw new HttpError(400, `El pago supera el saldo pendiente de $${balance.toLocaleString('es-AR')}.`);
    }
    const receivedAt = data.received_at || nowIso();
    const payment = transaction(() => {
      const paymentId = insert(
        `INSERT INTO payments (order_id, client_id, amount, method, payment_type, reference, notes, received_at, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, order.client_id, data.amount, data.method, data.payment_type, data.reference, data.notes, receivedAt, req.user.id, nowIso()],
      );
      const category =
        data.payment_type === 'SENA'
          ? 'Seña de reparación'
          : data.payment_type === 'PAGO_FINAL'
            ? 'Cobro final de reparación'
            : 'Pago de reparación';
      insert(
        `INSERT INTO transactions (type, category, description, amount, method, transaction_date, order_id, payment_id, notes, created_by)
         VALUES ('INGRESO', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          category,
          `Pago de la orden ${order.order_number}`,
          data.amount,
          data.method,
          isoDate(receivedAt),
          id,
          paymentId,
          data.notes,
          req.user.id,
        ],
      );
      return get('SELECT * FROM payments WHERE id = ?', [paymentId]);
    });
    audit(req, 'PAYMENT_CREATE', 'order', id, `Se registró un pago de $${data.amount} en la orden ${order.order_number}.`);
    res.status(201).json({
      ok: true,
      message: `Pago registrado. Saldo pendiente: $${Math.max(balance - data.amount, 0).toLocaleString('es-AR')}.`,
      payment,
      order: decorateOrder(get(`${orderSelect} WHERE o.id = ?`, [id])),
    });
  }),
);

router.delete(
  '/:id/payments/:paymentId',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const paymentId = Number(req.params.paymentId);
    const payment = get('SELECT * FROM payments WHERE id = ? AND order_id = ? AND deleted_at IS NULL', [paymentId, id]);
    if (!payment) throw new HttpError(404, 'Pago no encontrado.');
    const order = get('SELECT order_number FROM orders WHERE id = ?', [id]);
    transaction(() => {
      run('UPDATE payments SET deleted_at = ? WHERE id = ?', [nowIso(), paymentId]);
      run('UPDATE transactions SET deleted_at = ? WHERE payment_id = ? AND deleted_at IS NULL', [nowIso(), paymentId]);
    });
    audit(req, 'PAYMENT_DELETE', 'order', id, `Se anuló un pago de $${payment.amount} en la orden ${order.order_number}.`);
    res.json({
      ok: true,
      message: 'Pago anulado. El saldo de la orden fue recalculado.',
      order: decorateOrder(get(`${orderSelect} WHERE o.id = ?`, [id])),
    });
  }),
);

router.post(
  '/:id/reveal-unlock',
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const order = get('SELECT id, order_number, unlock_type, unlock_secret_enc FROM orders WHERE id = ?', [id]);
    if (!order) throw new HttpError(404, 'Orden no encontrada.');
    if (!order.unlock_secret_enc) throw new HttpError(404, 'La orden no tiene contraseña o patrón registrado.');
    const secret = decryptSecret(order.unlock_secret_enc);
    if (!secret) throw new HttpError(500, 'No se pudo descifrar el dato de desbloqueo.');
    audit(req, 'UNLOCK_REVEAL', 'order', id, `Se consultó el dato de desbloqueo de la orden ${order.order_number}.`);
    res.json({ unlock_type: order.unlock_type, unlock_secret: secret });
  }),
);

router.post(
  '/:id/photos',
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const order = get('SELECT id, order_number FROM orders WHERE id = ?', [id]);
    if (!order) throw new HttpError(404, 'Orden no encontrada.');
    const schema = z.object({
      photos: z.array(z.object({ data_url: z.string().min(20), label: optionalString(60) })).min(1).max(6),
    });
    const data = parse(schema, req.body);
    const saved = saveOrderPhotos(id, data.photos);
    for (const photo of saved) {
      insert('INSERT INTO order_photos (order_id, file_name, mime_type, data, label) VALUES (?, ?, ?, ?, ?)', [
        id,
        photo.fileName,
        photo.mime,
        photo.buffer,
        photo.label,
      ]);
    }
    audit(req, 'ORDER_PHOTO_ADD', 'order', id, `Se agregaron fotografías a la orden ${order.order_number}.`);
    res.status(201).json({ ok: true, message: 'Fotografías agregadas.', count: saved.length });
  }),
);

router.get(
  '/:id/photos/:photoId',
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const photo = get('SELECT * FROM order_photos WHERE id = ? AND order_id = ?', [
      Number(req.params.photoId),
      id,
    ]);
    if (!photo) throw new HttpError(404, 'Fotografía no encontrada.');
    if (!photo.data) throw new HttpError(404, 'La fotografía no tiene datos asociados.');
    res.setHeader('Content-Type', photo.mime_type);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(Buffer.from(photo.data));
  }),
);

router.get(
  '/:id/receipt.pdf',
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const order = decorateOrder(get(`${orderSelect} WHERE o.id = ?`, [id]));
    if (!order) throw new HttpError(404, 'Orden no encontrada.');
    const client = get('SELECT * FROM clients WHERE id = ?', [order.client_id]);
    renderOrderReceipt(res, { order, client });
  }),
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const order = get('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) throw new HttpError(404, 'Orden no encontrada.');
    const payments = get('SELECT COUNT(*) AS count FROM payments WHERE order_id = ? AND deleted_at IS NULL', [id]).count;
    if (payments > 0) {
      throw new HttpError(409, 'No se puede eliminar una orden con pagos registrados. Cambiá su estado a cancelada.');
    }
    run('DELETE FROM orders WHERE id = ?', [id]);
    audit(req, 'ORDER_DELETE', 'order', id, `Se eliminó la orden ${order.order_number}.`);
    res.json({ ok: true, message: 'Orden eliminada.' });
  }),
);

export default router;
