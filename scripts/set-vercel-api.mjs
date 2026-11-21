import fs from 'node:fs';

const input = process.argv[2];
if (!input) {
  console.error('Uso: npm run vercel:api -- https://tu-api.onrender.com');
  process.exit(1);
}

let url;
try {
  url = new URL(input);
} catch {
  console.error('La URL de la API no es válida.');
  process.exit(1);
}

if (url.protocol !== 'https:') {
  console.error('La API debe usar HTTPS para que las cookies seguras funcionen.');
  process.exit(1);
}

const file = new URL('../vercel.json', import.meta.url);
const config = JSON.parse(fs.readFileSync(file, 'utf8'));
const base = url.origin + url.pathname.replace(/\/+$/, '');
const rewrite = config.rewrites?.find((item) => item.source === '/api/:path*');
if (!rewrite) {
  console.error('No se encontró el rewrite /api/:path* en vercel.json.');
  process.exit(1);
}
rewrite.destination = `${base}/api/:path*`;
fs.writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
console.log(`API de Vercel configurada en: ${rewrite.destination}`);
