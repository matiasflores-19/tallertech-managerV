import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'node:url';
import { config, DEFAULT_SETTINGS } from './config.js';
import { nowIso } from './utils.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const schema = fs.readFileSync(path.join(here, 'schema.sql'), 'utf8');

export const db = new DatabaseSync(config.dbPath);
db.exec(schema);

// Migración incremental: las fotos ahora se guardan dentro de la base para que
// Litestream/Supabase Storage las replique junto con el resto de los datos.
const photoColumns = db.prepare('PRAGMA table_info(order_photos)').all().map((column) => column.name);
if (!photoColumns.includes('data')) {
  db.exec('ALTER TABLE order_photos ADD COLUMN data BLOB');
}

export function all(sql, params = []) {
  return db.prepare(sql).all(...normalizeParams(params));
}

export function get(sql, params = []) {
  return db.prepare(sql).get(...normalizeParams(params));
}

export function run(sql, params = []) {
  return db.prepare(sql).run(...normalizeParams(params));
}

export function insert(sql, params = []) {
  const result = db.prepare(sql).run(...normalizeParams(params));
  return Number(result.lastInsertRowid);
}

function normalizeParams(params) {
  return params.map((value) => (value === undefined ? null : value));
}

export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // El rollback puede fallar si la transacción ya se cerró.
    }
    throw error;
  }
}

export function getSettings() {
  const rows = all('SELECT key, value FROM settings');
  const result = { ...DEFAULT_SETTINGS };
  for (const row of rows) result[row.key] = row.value;
  return result;
}

export function setSettings(values) {
  const statement = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null) statement.run(key, String(value));
  }
}

export function logActivity({ userId = null, username = null, action, entityType = null, entityId = null, description }) {
  try {
    run(
      `INSERT INTO activity_log (user_id, username, action, entity_type, entity_id, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, username, action, entityType, entityId, description],
    );
  } catch (error) {
    console.error('Error al registrar actividad:', error.message);
  }
}

export function nextOrderNumber() {
  const year = new Date().getFullYear();
  const row = get(
    `SELECT order_number FROM orders
     WHERE order_number LIKE ? ORDER BY id DESC LIMIT 1`,
    [`OT-${year}-%`],
  );
  let sequence = 1;
  if (row) {
    const match = row.order_number.match(/(\d+)$/);
    if (match) sequence = Number(match[1]) + 1;
  }
  return `OT-${year}-${String(sequence).padStart(4, '0')}`;
}

export function ensureBaseData() {
  const count = get('SELECT COUNT(*) AS count FROM users').count;
  if (!count) {
    const username = process.env.ADMIN_USER || 'admin';
    const password = process.env.ADMIN_PASSWORD || 'Admin1234!';
    insert(
      `INSERT INTO users (username, password_hash, full_name, role, active, created_at)
       VALUES (?, ?, ?, 'admin', 1, ?)`,
      [username, bcrypt.hashSync(password, 12), 'Administrador del taller', nowIso()],
    );
    console.log(`Usuario administrador creado: ${username}`);
  }

  const settingsCount = get('SELECT COUNT(*) AS count FROM settings').count;
  if (!settingsCount) setSettings(DEFAULT_SETTINGS);

  const types = [
    ['PC de escritorio', 'monitor'],
    ['Notebook', 'laptop'],
    ['Netbook', 'laptop'],
    ['All in One', 'monitor'],
    ['Consola PlayStation', 'gamepad'],
    ['Consola Xbox', 'gamepad'],
    ['Celular', 'smartphone'],
    ['Tablet', 'tablet'],
    ['Monitor', 'monitor'],
    ['Impresora', 'printer'],
    ['Componente informático', 'cpu'],
    ['Otro dispositivo electrónico', 'circuit-board'],
  ];
  if (!get('SELECT COUNT(*) AS count FROM equipment_types').count) {
    const statement = db.prepare('INSERT INTO equipment_types (name, icon) VALUES (?, ?)');
    for (const [name, icon] of types) statement.run(name, icon);
  }

  const categories = [
    'Almacenamiento',
    'Memorias RAM',
    'Placas y motherboards',
    'Fuentes y carga',
    'Pantallas y displays',
    'Baterías',
    'Periféricos',
    'Insumos de limpieza',
    'Cables y adaptadores',
    'Refrigeración',
    'Consolas y móviles',
    'Otros',
  ];
  if (!get('SELECT COUNT(*) AS count FROM product_categories').count) {
    const statement = db.prepare('INSERT INTO product_categories (name) VALUES (?)');
    for (const name of categories) statement.run(name);
  }

  run('INSERT OR REPLACE INTO schema_meta (key, value) VALUES (?, ?)', ['version', '1']);
  return { created: !count };
}

export function closeDb() {
  db.close();
}
