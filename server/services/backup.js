import fs from 'node:fs';
import path from 'node:path';
import { db, all, insert, run, get, getSettings } from '../db.js';
import { config, DATA_DIR } from '../config.js';
import { nowIso } from '../utils.js';
import { photoPath } from './uploads.js';

const BACKUP_DIR = path.join(DATA_DIR, 'backups');
fs.mkdirSync(BACKUP_DIR, { recursive: true });

const TABLES = {
  users: ['id', 'username', 'password_hash', 'full_name', 'role', 'active', 'created_at', 'last_login'],
  clients: ['id', 'first_name', 'last_name', 'phone', 'phone_normalized', 'email', 'dni', 'address', 'notes', 'created_at', 'updated_at'],
  equipment_types: ['id', 'name', 'icon', 'active', 'created_at'],
  technicians: ['id', 'name', 'phone', 'specialty', 'active', 'created_at'],
  suppliers: ['id', 'name', 'contact_name', 'phone', 'email', 'address', 'cuit', 'notes', 'active', 'created_at', 'updated_at'],
  product_categories: ['id', 'name', 'created_at'],
  products: [
    'id', 'name', 'category_id', 'brand', 'model', 'sku', 'serial_number', 'stock', 'min_stock',
    'purchase_price', 'sale_price', 'supplier_id', 'location', 'entry_date', 'active', 'created_at', 'updated_at',
  ],
  orders: [
    'id', 'order_number', 'client_id', 'equipment_type_id', 'brand', 'model', 'serial_number', 'imei',
    'color', 'accessories', 'unlock_type', 'unlock_secret_enc', 'intake_at', 'declared_issue',
    'detailed_problem', 'physical_condition', 'visible_damage', 'initial_diagnosis', 'technician_id',
    'status', 'priority', 'estimated_budget', 'estimated_delivery', 'internal_notes', 'labor_cost',
    'final_price', 'cancellation_reason', 'created_by', 'created_at', 'updated_at', 'delivered_at',
  ],
  order_status_history: ['id', 'order_id', 'from_status', 'to_status', 'note', 'changed_by', 'created_at'],
  order_interventions: ['id', 'order_id', 'type', 'description', 'technician_id', 'created_by', 'created_at'],
  order_parts: ['id', 'order_id', 'product_id', 'quantity', 'unit_cost', 'unit_price', 'notes', 'created_by', 'created_at', 'removed_at'],
  order_photos: ['id', 'order_id', 'file_name', 'mime_type', 'label', 'created_at'],
  payments: ['id', 'order_id', 'client_id', 'amount', 'method', 'payment_type', 'reference', 'notes', 'received_at', 'created_by', 'created_at', 'deleted_at'],
  inventory_movements: ['id', 'product_id', 'movement_type', 'quantity', 'stock_after', 'unit_cost', 'reason', 'reference_type', 'reference_id', 'notes', 'created_by', 'created_at'],
  transactions: ['id', 'type', 'category', 'description', 'amount', 'method', 'transaction_date', 'order_id', 'payment_id', 'supplier_id', 'notes', 'created_by', 'created_at', 'deleted_at'],
  activity_log: ['id', 'user_id', 'username', 'action', 'entity_type', 'entity_id', 'description', 'created_at'],
  settings: ['key', 'value'],
};

const INSERT_ORDER = [
  'users',
  'clients',
  'equipment_types',
  'technicians',
  'suppliers',
  'product_categories',
  'products',
  'orders',
  'order_status_history',
  'order_interventions',
  'order_parts',
  'order_photos',
  'payments',
  'inventory_movements',
  'transactions',
  'activity_log',
  'settings',
];

export function createAutomaticBackup() {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(BACKUP_DIR, `tallertech-${stamp}.db`);
    db.exec('PRAGMA wal_checkpoint(FULL)');
    run(`VACUUM INTO ?`, [file]);
    pruneBackups();
    return file;
  } catch (error) {
    console.error('No se pudo crear el respaldo automático:', error.message);
    return null;
  }
}

export function pruneBackups(keep = 12) {
  const files = fs
    .readdirSync(BACKUP_DIR)
    .filter((file) => file.endsWith('.db'))
    .map((file) => ({ file, time: fs.statSync(path.join(BACKUP_DIR, file)).mtimeMs }))
    .sort((a, b) => b.time - a.time);
  for (const item of files.slice(keep)) {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, item.file));
    } catch {
      // Ignorar archivos que no se pueden borrar.
    }
  }
}

export function listBackups() {
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((file) => file.endsWith('.db'))
    .map((file) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, file));
      return { file, size: stat.size, created_at: stat.mtime.toISOString() };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export function backupFilePath(file) {
  return path.join(BACKUP_DIR, path.basename(file));
}

export function buildJsonBackup({ includeImages = true } = {}) {
  const backup = {
    app: 'TallerTech Manager',
    formatVersion: 1,
    createdAt: nowIso(),
    workshop: getSettings(),
    tables: {},
  };

  for (const [table, columns] of Object.entries(TABLES)) {
    const rows = all(`SELECT ${columns.join(', ')} FROM ${table}`);
    if (table === 'order_photos' && includeImages) {
      backup.tables[table] = rows.map((row) => {
        let data = null;
        try {
          const file = photoPath(row.order_id, row.file_name);
          if (fs.existsSync(file)) data = fs.readFileSync(file).toString('base64');
        } catch {
          data = null;
        }
        return { ...row, data_base64: data };
      });
    } else {
      backup.tables[table] = rows;
    }
  }
  backup.imagesIncluded = includeImages;
  return backup;
}

export function validateBackup(data) {
  if (!data || data.app !== 'TallerTech Manager' || !data.tables) {
    throw new Error('El archivo no es un respaldo válido de TallerTech Manager.');
  }
  if (data.formatVersion !== 1) {
    throw new Error('La versión del respaldo no es compatible con esta instalación.');
  }
  if (!Array.isArray(data.tables.users) || !data.tables.users.some((user) => user.role === 'admin')) {
    throw new Error('El respaldo no contiene un usuario administrador válido.');
  }
  return true;
}

export function restoreJsonBackup(data) {
  validateBackup(data);
  const photoRecords = data.tables.order_photos || [];
  const imageData = new Map(
    photoRecords
      .filter((photo) => photo.data_base64)
      .map((photo) => [`${photo.order_id}/${photo.file_name}`, photo.data_base64]),
  );

  db.exec('PRAGMA foreign_keys = OFF');
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const table of [...INSERT_ORDER].reverse()) {
      db.exec(`DELETE FROM ${table}`);
    }
    for (const table of INSERT_ORDER) {
      const columns = TABLES[table];
      const rows = data.tables[table] || [];
      if (!rows.length) continue;
      const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
      const statement = db.prepare(sql);
      for (const row of rows) {
        statement.run(...columns.map((column) => (row[column] === undefined ? null : row[column])));
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Ignorar.
    }
    db.exec('PRAGMA foreign_keys = ON');
    throw error;
  }
  db.exec('PRAGMA foreign_keys = ON');

  for (const [key, base64] of imageData) {
    try {
      const [orderId, fileName] = key.split('/');
      const directory = path.dirname(photoPath(orderId, fileName));
      fs.mkdirSync(directory, { recursive: true });
      fs.writeFileSync(photoPath(orderId, fileName), Buffer.from(base64, 'base64'));
    } catch (error) {
      console.warn('No se pudo restaurar una fotografía:', error.message);
    }
  }

  return {
    restoredAt: nowIso(),
    tables: Object.fromEntries(Object.entries(data.tables).map(([table, rows]) => [table, rows.length])),
    imagesRestored: imageData.size,
  };
}
