import fs from 'node:fs';
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { requireAuth, requireRole, destroySession } from '../auth.js';
import { all, get, getSettings, setSettings } from '../db.js';
import { config } from '../config.js';
import {
  asyncHandler,
  audit,
  HttpError,
  optionalString,
  parse,
  requiredString,
} from '../utils.js';
import {
  backupFilePath,
  buildJsonBackup,
  createAutomaticBackup,
  listBackups,
  restoreJsonBackup,
} from '../services/backup.js';

const router = Router();
router.use(requireAuth);

const settingsSchema = z
  .object({
    workshop_name: requiredString('El nombre del taller', 2, 120),
    workshop_address: optionalString(200),
    workshop_phone: optionalString(40),
    workshop_email: optionalString(120),
    workshop_cuit: optionalString(30),
    workshop_website: optionalString(150),
    currency: z.enum(['ARS', 'USD', 'EUR']).default('ARS'),
    receipt_footer: optionalString(500),
    warranty_days: z.coerce.number().int().min(0).max(3650).optional(),
    low_stock_global: z.coerce.number().int().min(0).max(10000).optional(),
  })
  .partial();

router.get('/', (req, res) => {
  const databaseSize = fs.existsSync(config.dbPath) ? fs.statSync(config.dbPath).size : 0;
  const counts = {
    clients: get('SELECT COUNT(*) AS count FROM clients').count,
    orders: get('SELECT COUNT(*) AS count FROM orders').count,
    products: get('SELECT COUNT(*) AS count FROM products WHERE active = 1').count,
    users: get('SELECT COUNT(*) AS count FROM users WHERE active = 1').count,
    transactions: get('SELECT COUNT(*) AS count FROM transactions WHERE deleted_at IS NULL').count,
  };
  res.json({
    settings: getSettings(),
    system: {
      appName: 'TallerTech Manager',
      version: '1.2.0',
      node: process.version,
      database: 'SQLite',
      databaseSize,
      environment: config.env,
      backupDirectory: 'data/backups',
      counts,
    },
    backups: req.user.role === 'admin' ? listBackups() : [],
  });
});

router.patch(
  '/',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const data = parse(settingsSchema, req.body);
    const values = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined && value !== null) values[key] = value;
    }
    if (!Object.keys(values).length) throw new HttpError(400, 'No hay cambios para guardar.');
    setSettings(values);
    audit(req, 'SETTINGS_UPDATE', 'settings', null, 'Se actualizaron los datos del taller.');
    res.json({ ok: true, message: 'ConfiguraciÃ³n guardada.', settings: getSettings() });
  }),
);

router.get(
  '/backup',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const includeImages = req.query.images !== 'false';
    const backup = buildJsonBackup({ includeImages });
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="tallertech-respaldo-${stamp}.json"`);
    audit(req, 'BACKUP_EXPORT', 'backup', null, `Se descargÃ³ un respaldo JSON (imÃ¡genes: ${includeImages ? 'sÃ­' : 'no'}).`);
    res.send(JSON.stringify(backup, null, 2));
  }),
);

router.post(
  '/backup',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const file = createAutomaticBackup();
    if (!file) throw new HttpError(500, 'No se pudo crear el respaldo de la base de datos.');
    audit(req, 'BACKUP_CREATE', 'backup', null, 'Se creÃ³ un respaldo manual de la base de datos.');
    res.status(201).json({ ok: true, message: 'Respaldo de base de datos creado.', backups: listBackups() });
  }),
);

router.get(
  '/backups',
  requireRole('admin'),
  asyncHandler((req, res) => {
    res.json({ backups: listBackups() });
  }),
);

router.get(
  '/backups/:file',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const file = backupFilePath(req.params.file);
    if (!fs.existsSync(file)) throw new HttpError(404, 'Respaldo no encontrado.');
    res.download(file, req.params.file);
  }),
);

router.post(
  '/restore',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const schema = z.object({
      password: z.string().min(1, 'IngresÃ¡ tu contraseÃ±a para confirmar.'),
      confirmation: z.string().refine((value) => value === 'RESTAURAR', {
        message: 'EscribÃ­ RESTAURAR para confirmar.',
      }),
      backup: z.object({}).passthrough(),
    });
    const data = parse(schema, req.body);
    const user = get('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (!user || !bcrypt.compareSync(data.password, user.password_hash)) {
      throw new HttpError(403, 'La contraseÃ±a no es correcta.');
    }
    let result;
    try {
      result = restoreJsonBackup(data.backup);
    } catch (error) {
      throw new HttpError(422, `No se pudo restaurar el respaldo: ${error.message}`);
    }
    destroySession(res);
    res.json({
      ok: true,
      message: 'Respaldo restaurado correctamente. Por seguridad, iniciÃ¡ sesiÃ³n nuevamente.',
      result,
    });
  }),
);

export default router;
