import { z } from 'zod';

export class HttpError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    throw new HttpError(422, 'Revisá los datos ingresados.', details);
  }
  return result.data;
}

export const nowIso = () => new Date().toISOString();

export function normalizePhone(value = '') {
  return String(value).replace(/\D/g, '');
}

export function normalizeText(value = '') {
  return String(value).trim().replace(/\s+/g, ' ');
}

export function toCents(value) {
  return Math.round(Number(value || 0) * 100);
}

export function fromCents(value) {
  return Math.round(Number(value || 0)) / 100;
}

export function isoDate(value = new Date()) {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10);
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function monthRange(reference = new Date()) {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  return { from: isoDate(from), to: isoDate(to) };
}

export function dateRangeFromQuery(query = {}) {
  if (query.from && query.to) return { from: query.from, to: query.to };
  const range = monthRange(new Date());
  return { from: query.from || range.from, to: query.to || range.to };
}

export function pagination(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, offset: (page - 1) * limit };
}

export function audit(req, action, entityType, entityId, description) {
  const user = req.user || {};
  try {
    req.db
      ?.prepare(
        `INSERT INTO activity_log (user_id, username, action, entity_type, entity_id, description)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(user.id || null, user.username || null, action, entityType || null, entityId || null, description);
  } catch (error) {
    console.error('No se pudo registrar la actividad:', error.message);
  }
}

export const idSchema = z.coerce.number().int().positive();

export const optionalString = (max = 500) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => {
      if (value === null || value === undefined) return null;
      const trimmed = String(value).trim();
      return trimmed === '' ? null : trimmed;
    })
    .refine((value) => value === null || value.length <= max, {
      message: `El texto no puede superar ${max} caracteres.`,
    });

export const requiredString = (label, min = 1, max = 500) =>
  z
    .string({ required_error: `${label} es obligatorio.`, invalid_type_error: `${label} es obligatorio.` })
    .trim()
    .min(min, `${label} es obligatorio.`)
    .max(max, `${label} no puede superar ${max} caracteres.`);

export const moneySchema = z.coerce
  .number({ invalid_type_error: 'Ingresá un importe válido.' })
  .min(0, 'El importe no puede ser negativo.')
  .max(999999999, 'El importe es demasiado alto.');

export const phoneSchema = z
  .string({ required_error: 'El teléfono es obligatorio.' })
  .trim()
  .min(6, 'Ingresá un teléfono válido.')
  .max(40, 'El teléfono es demasiado largo.')
  .refine((value) => normalizePhone(value).length >= 6, 'Ingresá un teléfono válido.');

export const optionalDateSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'INVALID_DATE';
    return date.toISOString();
  })
  .refine((value) => value !== 'INVALID_DATE', { message: 'La fecha ingresada no es válida.' });

export const optionalDaySchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (!value) return null;
    const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
    if (Number.isNaN(date.getTime())) return 'INVALID_DATE';
    return isoDate(date);
  })
  .refine((value) => value !== 'INVALID_DATE', { message: 'La fecha ingresada no es válida.' });

export const emailSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => (value ? String(value).trim() : null))
  .refine((value) => value === null || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), {
    message: 'Ingresá un correo electrónico válido.',
  });

export function roundMoney(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function clientName(client) {
  return `${client.first_name} ${client.last_name}`.trim();
}

export const ORDER_STATUSES = [
  'RECIBIDO',
  'PENDIENTE_DIAGNOSTICO',
  'EN_DIAGNOSTICO',
  'PRESUPUESTADO',
  'ESPERANDO_APROBACION',
  'ESPERANDO_REPUESTOS',
  'EN_REPARACION',
  'EN_PRUEBAS',
  'REPARADO',
  'LISTO_PARA_RETIRAR',
  'ENTREGADO',
  'SIN_REPARACION',
  'CANCELADO',
];

export const STATUS_META = {
  RECIBIDO: { label: 'Recibido', tone: 'slate' },
  PENDIENTE_DIAGNOSTICO: { label: 'Pendiente de diagnóstico', tone: 'amber' },
  EN_DIAGNOSTICO: { label: 'En diagnóstico', tone: 'sky' },
  PRESUPUESTADO: { label: 'Presupuestado', tone: 'indigo' },
  ESPERANDO_APROBACION: { label: 'Esperando aprobación', tone: 'violet' },
  ESPERANDO_REPUESTOS: { label: 'Esperando repuestos', tone: 'orange' },
  EN_REPARACION: { label: 'En reparación', tone: 'blue' },
  EN_PRUEBAS: { label: 'En pruebas', tone: 'cyan' },
  REPARADO: { label: 'Reparado', tone: 'emerald' },
  LISTO_PARA_RETIRAR: { label: 'Listo para retirar', tone: 'green' },
  ENTREGADO: { label: 'Entregado', tone: 'teal' },
  SIN_REPARACION: { label: 'Sin reparación', tone: 'rose' },
  CANCELADO: { label: 'Cancelado', tone: 'red' },
};

export const PAYMENT_METHODS = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MERCADO_PAGO', 'OTRO'];
export const PAYMENT_TYPES = ['SENA', 'PAGO_PARCIAL', 'PAGO_FINAL', 'OTRO'];
export const PRIORITIES = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE'];
export const INCOME_CATEGORIES = [
  'Cobro de reparación',
  'Seña de reparación',
  'Pago de reparación',
  'Venta de repuestos',
  'Venta de accesorios',
  'Otros ingresos',
];
export const EXPENSE_CATEGORIES = [
  'Compra de repuestos',
  'Herramientas',
  'Servicios',
  'Alquiler',
  'Gastos operativos',
  'Sueldos',
  'Impuestos',
  'Otros gastos',
];
