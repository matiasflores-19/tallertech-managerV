import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth.js';
import { all, get, insert, run } from '../db.js';
import {
  asyncHandler,
  audit,
  emailSchema,
  HttpError,
  normalizePhone,
  nowIso,
  optionalString,
  pagination,
  parse,
  phoneSchema,
  requiredString,
} from '../utils.js';

const router = Router();
router.use(requireAuth);

const clientSchema = z.object({
  first_name: requiredString('El nombre', 2, 80),
  last_name: requiredString('El apellido', 2, 80),
  phone: phoneSchema,
  email: emailSchema,
  dni: optionalString(20),
  address: optionalString(200),
  notes: optionalString(1000),
});

const orderBillable = `COALESCE(NULLIF(o.final_price, 0), o.estimated_budget)`;
const orderPaid = `COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id AND p.deleted_at IS NULL), 0)`;

router.get(
  '/',
  asyncHandler((req, res) => {
    const { page, limit, offset } = pagination(req.query);
    const search = String(req.query.search || '').trim();
    const where = [];
    const params = [];
    if (search) {
      const like = `%${search.toLowerCase()}%`;
      where.push(`(
        lower(c.first_name || ' ' || c.last_name) LIKE ? OR
        c.phone LIKE ? OR lower(COALESCE(c.email,'')) LIKE ? OR
        lower(COALESCE(c.dni,'')) LIKE ?
      )`);
      params.push(like, `%${search}%`, like, like);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = get(`SELECT COUNT(*) AS count FROM clients c ${whereSql}`, params).count;
    const clients = all(
      `SELECT c.*,
        (SELECT COUNT(*) FROM orders o WHERE o.client_id = c.id) AS orders_count,
        (SELECT COUNT(*) FROM orders o WHERE o.client_id = c.id AND o.status NOT IN ('ENTREGADO','CANCELADO','SIN_REPARACION')) AS active_orders,
        (SELECT COALESCE(SUM(${orderBillable}), 0) FROM orders o WHERE o.client_id = c.id AND o.status NOT IN ('CANCELADO','SIN_REPARACION')) AS billed,
        (SELECT COALESCE(SUM(p.amount), 0) FROM payments p WHERE p.client_id = c.id AND p.deleted_at IS NULL) AS paid,
        (SELECT COALESCE(SUM(MAX(${orderBillable} - ${orderPaid}, 0)), 0)
           FROM orders o WHERE o.client_id = c.id AND o.status NOT IN ('CANCELADO','SIN_REPARACION')) AS debt,
        (SELECT MAX(o.created_at) FROM orders o WHERE o.client_id = c.id) AS last_visit
       FROM clients c ${whereSql}
       ORDER BY c.last_name COLLATE NOCASE, c.first_name COLLATE NOCASE
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    res.json({ clients, total, page, limit });
  }),
);

router.get(
  '/quick',
  asyncHandler((req, res) => {
    const search = String(req.query.q || '').trim();
    if (!search) return res.json({ clients: [] });
    const like = `%${search.toLowerCase()}%`;
    const clients = all(
      `SELECT c.id, c.first_name, c.last_name, c.phone, c.email, c.dni,
         (SELECT COUNT(*) FROM orders o WHERE o.client_id = c.id) AS orders_count
       FROM clients c
       WHERE lower(c.first_name || ' ' || c.last_name) LIKE ?
          OR c.phone LIKE ? OR lower(COALESCE(c.email,'')) LIKE ?
          OR lower(COALESCE(c.dni,'')) LIKE ?
       ORDER BY c.last_name COLLATE NOCASE, c.first_name COLLATE NOCASE
       LIMIT 8`,
      [like, `%${search}%`, like, like],
    );
    res.json({ clients });
  }),
);

router.get(
  '/:id',
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const client = get('SELECT * FROM clients WHERE id = ?', [id]);
    if (!client) throw new HttpError(404, 'Cliente no encontrado.');

    const orders = all(
      `SELECT o.id, o.order_number, o.status, o.priority, o.brand, o.model, o.created_at,
        o.intake_at, o.delivered_at, o.estimated_budget, o.final_price,
        et.name AS equipment_type_name,
        ${orderPaid} AS paid,
        MAX(${orderBillable} - ${orderPaid}, 0) AS balance
       FROM orders o JOIN equipment_types et ON et.id = o.equipment_type_id
       WHERE o.client_id = ? ORDER BY o.created_at DESC`,
      [id],
    );
    const payments = all(
      `SELECT p.id, p.amount, p.method, p.payment_type, p.received_at, p.reference,
        o.order_number
       FROM payments p JOIN orders o ON o.id = p.order_id
       WHERE p.client_id = ? AND p.deleted_at IS NULL
       ORDER BY p.received_at DESC LIMIT 30`,
      [id],
    );
    const stats = {
      orders_count: orders.length,
      active_orders: orders.filter((order) => !['ENTREGADO', 'CANCELADO', 'SIN_REPARACION'].includes(order.status)).length,
      billed: orders
        .filter((order) => !['CANCELADO', 'SIN_REPARACION'].includes(order.status))
        .reduce((sum, order) => sum + Number(order.final_price || order.estimated_budget || 0), 0),
      paid: Number(
        get('SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE client_id = ? AND deleted_at IS NULL', [id]).total,
      ),
      debt: orders
        .filter((order) => !['CANCELADO', 'SIN_REPARACION'].includes(order.status))
        .reduce((sum, order) => sum + Number(order.balance || 0), 0),
    };
    res.json({ client, orders, payments, stats });
  }),
);

router.post(
  '/',
  asyncHandler((req, res) => {
    const data = parse(clientSchema, req.body);
    const phoneNormalized = normalizePhone(data.phone);
    const existing = get('SELECT * FROM clients WHERE phone_normalized = ?', [phoneNormalized]);
    if (existing) {
      throw new HttpError(409, 'Ya existe un cliente con ese teléfono.', [
        { field: 'phone', message: 'Teléfono ya registrado.' },
        { field: '__existingClient', message: existing.id },
      ]);
    }
    const id = insert(
      `INSERT INTO clients (first_name, last_name, phone, phone_normalized, email, dni, address, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.first_name,
        data.last_name,
        data.phone,
        phoneNormalized,
        data.email,
        data.dni,
        data.address,
        data.notes,
        nowIso(),
        nowIso(),
      ],
    );
    audit(req, 'CLIENT_CREATE', 'client', id, `Se registró el cliente ${data.first_name} ${data.last_name}.`);
    res.status(201).json({
      ok: true,
      message: 'Cliente registrado correctamente.',
      client: get('SELECT * FROM clients WHERE id = ?', [id]),
    });
  }),
);

router.patch(
  '/:id',
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const current = get('SELECT * FROM clients WHERE id = ?', [id]);
    if (!current) throw new HttpError(404, 'Cliente no encontrado.');
    const data = parse(clientSchema.partial(), req.body);
    const fields = [];
    const params = [];
    for (const field of ['first_name', 'last_name', 'phone', 'email', 'dni', 'address', 'notes']) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(data[field]);
      }
    }
    if (data.phone !== undefined) {
      const phoneNormalized = normalizePhone(data.phone);
      const duplicate = get('SELECT id FROM clients WHERE phone_normalized = ? AND id <> ?', [phoneNormalized, id]);
      if (duplicate) throw new HttpError(409, 'Otro cliente ya utiliza ese teléfono.');
      fields.push('phone_normalized = ?');
      params.push(phoneNormalized);
    }
    if (!fields.length) throw new HttpError(400, 'No hay cambios para guardar.');
    fields.push('updated_at = ?');
    params.push(nowIso(), id);
    run(`UPDATE clients SET ${fields.join(', ')} WHERE id = ?`, params);
    audit(req, 'CLIENT_UPDATE', 'client', id, `Se actualizaron los datos del cliente ${current.first_name} ${current.last_name}.`);
    res.json({
      ok: true,
      message: 'Cliente actualizado correctamente.',
      client: get('SELECT * FROM clients WHERE id = ?', [id]),
    });
  }),
);

router.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const client = get('SELECT * FROM clients WHERE id = ?', [id]);
    if (!client) throw new HttpError(404, 'Cliente no encontrado.');
    const orders = get('SELECT COUNT(*) AS count FROM orders WHERE client_id = ?', [id]).count;
    if (orders > 0) {
      throw new HttpError(409, 'No se puede eliminar un cliente con órdenes asociadas. Conservá el historial.');
    }
    run('DELETE FROM clients WHERE id = ?', [id]);
    audit(req, 'CLIENT_DELETE', 'client', id, `Se eliminó el cliente ${client.first_name} ${client.last_name}.`);
    res.json({ ok: true, message: 'Cliente eliminado.' });
  }),
);

export default router;
