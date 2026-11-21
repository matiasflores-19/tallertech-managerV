import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth.js';
import { all, get, insert, run } from '../db.js';
import {
  asyncHandler,
  audit,
  HttpError,
  parse,
  PAYMENT_METHODS,
  PAYMENT_TYPES,
  PRIORITIES,
  STATUS_META,
  ORDER_STATUSES,
} from '../utils.js';
import { getSettings } from '../db.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const settings = getSettings();
  res.json({
    statuses: ORDER_STATUSES.map((value) => ({ value, label: STATUS_META[value].label, tone: STATUS_META[value].tone })),
    equipmentTypes: all('SELECT id, name, icon FROM equipment_types WHERE active = 1 ORDER BY name'),
    technicians: all('SELECT id, name, phone, specialty FROM technicians WHERE active = 1 ORDER BY name'),
    categories: all('SELECT id, name FROM product_categories ORDER BY name'),
    suppliers: all('SELECT id, name FROM suppliers WHERE active = 1 ORDER BY name'),
    paymentMethods: PAYMENT_METHODS,
    paymentTypes: PAYMENT_TYPES,
    priorities: PRIORITIES,
    currency: settings.currency || 'ARS',
    workshopName: settings.workshop_name,
  });
});

const equipmentTypeSchema = z.object({
  name: z.string().trim().min(2, 'Ingresá un nombre.').max(80),
  icon: z.string().trim().max(40).optional().default('cpu'),
});

router.post(
  '/equipment-types',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const data = parse(equipmentTypeSchema, req.body);
    if (get('SELECT id FROM equipment_types WHERE name = ? COLLATE NOCASE', [data.name])) {
      throw new HttpError(409, 'Ese tipo de equipo ya existe.');
    }
    const id = insert('INSERT INTO equipment_types (name, icon) VALUES (?, ?)', [data.name, data.icon]);
    audit(req, 'EQUIPMENT_TYPE_CREATE', 'equipment_type', id, `Se agregó el tipo de equipo ${data.name}.`);
    res.status(201).json({
      ok: true,
      message: 'Tipo de equipo agregado.',
      equipmentType: get('SELECT id, name, icon FROM equipment_types WHERE id = ?', [id]),
    });
  }),
);

const technicianSchema = z.object({
  name: z.string().trim().min(3, 'Ingresá el nombre del técnico.').max(100),
  phone: z.string().trim().max(40).optional().nullable(),
  specialty: z.string().trim().max(100).optional().nullable(),
});

router.post(
  '/technicians',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const data = parse(technicianSchema, req.body);
    const id = insert('INSERT INTO technicians (name, phone, specialty) VALUES (?, ?, ?)', [
      data.name,
      data.phone || null,
      data.specialty || null,
    ]);
    audit(req, 'TECHNICIAN_CREATE', 'technician', id, `Se agregó el técnico ${data.name}.`);
    res.status(201).json({
      ok: true,
      message: 'Técnico agregado.',
      technician: get('SELECT id, name, phone, specialty FROM technicians WHERE id = ?', [id]),
    });
  }),
);

router.get('/technicians', (req, res) => {
  res.json({ technicians: all('SELECT * FROM technicians ORDER BY active DESC, name') });
});

router.patch(
  '/technicians/:id',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const current = get('SELECT * FROM technicians WHERE id = ?', [id]);
    if (!current) throw new HttpError(404, 'Técnico no encontrado.');
    const schema = technicianSchema.partial().extend({ active: z.boolean().optional() });
    const data = parse(schema, req.body);
    const fields = [];
    const params = [];
    for (const field of ['name', 'phone', 'specialty']) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(data[field] || null);
      }
    }
    if (data.active !== undefined) {
      fields.push('active = ?');
      params.push(data.active ? 1 : 0);
    }
    if (!fields.length) throw new HttpError(400, 'No hay cambios para guardar.');
    params.push(id);
    run(`UPDATE technicians SET ${fields.join(', ')} WHERE id = ?`, params);
    audit(req, 'TECHNICIAN_UPDATE', 'technician', id, `Se actualizó el técnico ${current.name}.`);
    res.json({ ok: true, message: 'Técnico actualizado.', technician: get('SELECT * FROM technicians WHERE id = ?', [id]) });
  }),
);

export default router;
