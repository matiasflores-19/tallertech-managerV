import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, '..');

dotenv.config({ path: path.join(ROOT_DIR, '.env'), quiet: true });

export const DATA_DIR = path.resolve(ROOT_DIR, process.env.DATA_DIR || 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const SECRETS_FILE = path.join(DATA_DIR, '.secrets.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function loadSecrets() {
  if (process.env.JWT_SECRET && process.env.ENCRYPTION_KEY) {
    return {
      jwtSecret: process.env.JWT_SECRET,
      encryptionKey: process.env.ENCRYPTION_KEY,
    };
  }

  if (fs.existsSync(SECRETS_FILE)) {
    try {
      const saved = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8'));
      if (saved.jwtSecret && saved.encryptionKey) {
        return {
          jwtSecret: process.env.JWT_SECRET || saved.jwtSecret,
          encryptionKey: process.env.ENCRYPTION_KEY || saved.encryptionKey,
        };
      }
    } catch {
      // Se regenera debajo si el archivo está corrupto.
    }
  }

  const generated = {
    jwtSecret: crypto.randomBytes(48).toString('hex'),
    encryptionKey: crypto.randomBytes(32).toString('hex'),
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(SECRETS_FILE, JSON.stringify(generated, null, 2), { mode: 0o600 });
  return {
    jwtSecret: process.env.JWT_SECRET || generated.jwtSecret,
    encryptionKey: process.env.ENCRYPTION_KEY || generated.encryptionKey,
  };
}

const secrets = loadSecrets();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  dbPath: path.resolve(DATA_DIR, 'tallertech.db'),
  uploadDir: UPLOAD_DIR,
  jwtSecret: secrets.jwtSecret,
  encryptionKey: secrets.encryptionKey,
  cookieName: 'tt_session',
  sessionHours: Number(process.env.SESSION_HOURS || 12),
  demoSeed: process.env.SEED_DEMO !== 'false',
  appName: 'TallerTech Manager',
};

export const DEFAULT_SETTINGS = {
  workshop_name: 'TallerTech Service',
  workshop_address: 'Av. Tecnología 1420, CABA',
  workshop_phone: '+54 11 4555-9080',
  workshop_email: 'contacto@tallertech.com',
  workshop_cuit: '30-71234567-8',
  workshop_website: 'www.tallertech.com',
  currency: 'ARS',
  receipt_footer: 'Gracias por confiar en TallerTech. Conservá este comprobante para retirar el equipo.',
  warranty_days: '90',
  low_stock_global: '5',
};
