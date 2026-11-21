import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';
import { fileURLToPath } from 'node:url';
import { config, ROOT_DIR } from './config.js';
import { closeDb, db, ensureBaseData } from './db.js';
import { seedDemoData } from './seed.js';
import { createAutomaticBackup } from './services/backup.js';
import authRoutes from './routes/auth.js';
import metaRoutes from './routes/meta.js';
import dashboardRoutes from './routes/dashboard.js';
import clientRoutes from './routes/clients.js';
import orderRoutes from './routes/orders.js';
import inventoryRoutes from './routes/inventory.js';
import financeRoutes from './routes/finance.js';
import reportRoutes from './routes/reports.js';
import settingsRoutes from './routes/settings.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'", 'ws:', 'wss:'],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '90mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
if (config.env !== 'test') app.use(morgan(config.env === 'development' ? 'dev' : 'combined'));

app.use((req, res, next) => {
  req.db = db;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, app: 'TallerTech Manager', version: '1.0.0', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/meta', metaRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta de API no encontrada.' });
});

const distDirectory = path.join(ROOT_DIR, 'dist');
const indexFile = path.join(distDirectory, 'index.html');
if (fs.existsSync(indexFile)) {
  app.use(express.static(distDirectory, { maxAge: '1h', index: false }));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) return res.sendFile(indexFile);
    return next();
  });
}

app.use((req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado.' });
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  const status = error.status || error.statusCode || 500;
  if (status >= 500) console.error(error);
  let message = error.message || 'Ocurrió un error inesperado.';
  if (error.type === 'entity.too.large') message = 'El archivo es demasiado grande.';
  if (message.includes('UNIQUE constraint failed')) message = 'Ya existe un registro con un dato único repetido.';
  if (message.includes('FOREIGN KEY constraint failed')) {
    message = 'No se puede completar la operación porque el registro está relacionado con otros datos.';
  }
  if (message.includes('CHECK constraint failed')) message = 'Alguno de los datos no cumple las reglas de validación.';
  const payload = { error: message };
  if (error.details) payload.details = error.details;
  if (config.env === 'development' && status >= 500) payload.stack = error.stack;
  res.status(status).json(payload);
});

let server = null;
let backupTimer = null;

export function start() {
  ensureBaseData();
  const seed = seedDemoData();
  if (seed.seeded) {
    console.log(`Datos demo cargados: ${seed.orders} órdenes y ${seed.clients} clientes.`);
  }
  // En Render Free + Litestream el respaldo durable lo maneja Supabase Storage.
  // Los snapshots locales solo tienen sentido en un servidor con disco persistente.
  if (!process.env.LITESTREAM_REPLICA_URL) {
    createAutomaticBackup();
    backupTimer = setInterval(createAutomaticBackup, 24 * 60 * 60 * 1000);
    backupTimer.unref?.();
  }

  server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`\nTallerTech Manager API escuchando en http://localhost:${config.port}`);
    console.log(`Entorno: ${config.env} · Base de datos: ${config.dbPath}`);
    if (config.env === 'development') console.log('Frontend de desarrollo: http://localhost:5173\n');
  });
  return server;
}

function shutdown() {
  if (backupTimer) clearInterval(backupTimer);
  if (server) {
    server.close(() => {
      try {
        closeDb();
      } finally {
        process.exit(0);
      }
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) start();

export default app;
