import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4000';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifacts = path.resolve('artifacts');
fs.mkdirSync(artifacts, { recursive: true });

const browser = await chromium.launch({
  executablePath: EDGE,
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
});

const errors = [];
const failedRequests = [];
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-AR', timezoneId: 'America/Argentina/Buenos_Aires' });
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(`PAGE: ${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`CONSOLE: ${message.text()}`); });
page.on('response', (response) => { if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url()}`); });

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.screenshot({ path: path.join(artifacts, '01-login.png'), fullPage: true });
await page.fill('#username', 'admin');
await page.fill('#password', 'Admin1234!');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard', { timeout: 15000 });
await page.waitForTimeout(1800);
await page.screenshot({ path: path.join(artifacts, '02-dashboard-desktop.png'), fullPage: true });

const pages = [
  ['/ordenes', '03-ordenes-desktop'],
  ['/ordenes/nueva', '04-ingreso-desktop'],
  ['/ordenes/1', '05-orden-detalle-desktop'],
  ['/clientes', '06-clientes-desktop'],
  ['/inventario', '07-inventario-desktop'],
  ['/finanzas', '08-finanzas-desktop'],
  ['/reportes', '09-reportes-desktop'],
  ['/configuracion', '10-configuracion-desktop'],
  ['/reparaciones', '11-tablero-desktop'],
];
for (const [route, name] of pages) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(artifacts, `${name}.png`), fullPage: true });
}

// Probar interacciones clave: modal de estado, pestañas de historial y descarga PDF
await page.goto(`${BASE}/ordenes/1`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Cambiar estado/i }).click();
await page.waitForTimeout(350);
await page.screenshot({ path: path.join(artifacts, '12-modal-estado.png') });
await page.getByRole('button', { name: 'Cancelar' }).click();
await page.getByRole('button', { name: /Pagos/i }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(artifacts, '13-orden-pagos.png'), fullPage: true });

const cookies = await context.cookies();
const receipt = await context.request.get(`${BASE}/api/orders/1/receipt.pdf`, { headers: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; ') } });
const pdfBuffer = await receipt.body();
fs.writeFileSync(path.join(artifacts, 'comprobante-prueba.pdf'), pdfBuffer);

// Vista móvil con la misma sesión
const mobileContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'es-AR',
  timezoneId: 'America/Argentina/Buenos_Aires',
  storageState: await context.storageState(),
});
const mobile = await mobileContext.newPage();
await mobile.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
await mobile.waitForTimeout(1500);
await mobile.screenshot({ path: path.join(artifacts, '20-dashboard-mobile.png'), fullPage: true });
await mobile.goto(`${BASE}/ordenes`, { waitUntil: 'networkidle' });
await mobile.waitForTimeout(800);
await mobile.screenshot({ path: path.join(artifacts, '21-ordenes-mobile.png'), fullPage: true });
await mobile.goto(`${BASE}/ordenes/nueva`, { waitUntil: 'networkidle' });
await mobile.waitForTimeout(800);
await mobile.screenshot({ path: path.join(artifacts, '22-ingreso-mobile.png'), fullPage: true });
await mobile.goto(`${BASE}/inventario`, { waitUntil: 'networkidle' });
await mobile.waitForTimeout(800);
await mobile.screenshot({ path: path.join(artifacts, '23-inventario-mobile.png'), fullPage: true });
await mobile.goto(`${BASE}/finanzas`, { waitUntil: 'networkidle' });
await mobile.waitForTimeout(900);
await mobile.screenshot({ path: path.join(artifacts, '24-finanzas-mobile.png'), fullPage: true });

console.log(JSON.stringify({
  title: await page.title(),
  receiptStatus: receipt.status(),
  receiptBytes: pdfBuffer.length,
  errors: [...new Set(errors)],
  failedRequests: [...new Set(failedRequests)].filter((item) => !item.includes('/api/inventory/alerts')),
}, null, 2));

await browser.close();
