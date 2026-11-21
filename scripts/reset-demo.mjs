import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.resolve(root, process.env.DATA_DIR || 'data');

if (fs.existsSync(dataDir)) {
  const dbFiles = fs.readdirSync(dataDir).filter((file) => file.startsWith('tallertech.db'));
  for (const file of dbFiles) {
    fs.rmSync(path.join(dataDir, file), { force: true });
  }
  fs.rmSync(path.join(dataDir, 'uploads'), { recursive: true, force: true });
  console.log('Base de datos y fotografías eliminadas. Los respaldos de data/backups se conservan.');
}

const { seedDemoData } = await import('../server/seed.js');
const { closeDb } = await import('../server/db.js');
const result = seedDemoData();
console.log(
  result.seeded
    ? `Sistema reiniciado con datos de demostración: ${result.orders} órdenes, ${result.clients} clientes.`
    : `No se pudo reiniciar: ${result.reason}`,
);
closeDb();
