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
  args: ['--no-sandbox', '--disable-gpu'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  locale: 'es-AR',
  timezoneId: 'America/Argentina/Buenos_Aires',
  acceptDownloads: true,
});
const errors = [];
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(`PAGE: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('401')) errors.push(`CONSOLE: ${message.text()}`);
});

const stamp = Date.now().toString().slice(-6);
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#username', 'admin');
await page.fill('#password', 'Admin1234!');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard');

// Crear una orden completa desde la interfaz
await page.goto(`${BASE}/ordenes/nueva`, { waitUntil: 'networkidle' });
await page.getByPlaceholder('Ej. Juan').fill('Lucía');
await page.getByPlaceholder('Ej. Pérez').fill(`Prueba ${stamp}`);
await page.getByPlaceholder('Ej. 11 5555-1234').fill(`11 88${stamp}`);
await page.getByPlaceholder('cliente@correo.com').fill(`lucia${stamp}@example.com`);
const selects = page.locator('#new-order-form select');
await selects.nth(0).selectOption({ index: 2 });
await page.getByPlaceholder('Ej. Lenovo').fill('Lenovo');
await page.getByPlaceholder('Ej. IdeaPad 3').fill('ThinkBook 14');
await page.getByPlaceholder('Ej. No enciende después de un corte de luz').fill('No enciende luego de una descarga eléctrica.');
const numberInputs = page.locator('#new-order-form input[type="number"]');
await numberInputs.nth(0).fill('120000');
await numberInputs.nth(1).fill('20000');
await page.locator('#new-order-form button[type="submit"]').first().click();
await page.waitForURL(/\/ordenes\/\d+$/, { timeout: 15000 });
await page.waitForTimeout(700);
const createdOrderUrl = page.url();
const orderNumber = await page.locator('h1').first().innerText();
await page.screenshot({ path: path.join(artifacts, '30-orden-creada.png'), fullPage: true });

// Descargar comprobante
const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
await page.getByRole('button', { name: /Comprobante PDF/i }).click();
const download = await downloadPromise;
const receiptPath = path.join(artifacts, 'comprobante-desde-ui.pdf');
await download.saveAs(receiptPath);

// Cambiar estado
await page.getByRole('button', { name: /Cambiar estado/i }).click();
await page.locator('#status-form select').selectOption('EN_DIAGNOSTICO');
await page.locator('#status-form textarea').fill('Diagnóstico iniciado en prueba E2E.');
await page.getByRole('button', { name: 'Actualizar estado' }).click();
await page.waitForTimeout(900);

// Registrar pago
await page.getByRole('button', { name: /Registrar pago/i }).first().click();
await page.locator('#payment-form input[type="number"]').fill('10000');
await page.getByRole('button', { name: 'Registrar pago' }).last().click();
await page.waitForTimeout(900);
await page.getByRole('button', { name: /Pagos/i }).click();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(artifacts, '31-orden-con-pago.png'), fullPage: true });

// Configuración: pestañas
await page.goto(`${BASE}/configuracion`, { waitUntil: 'networkidle' });
for (const tab of ['Usuarios y técnicos', 'Tipos de equipo', 'Respaldos']) {
  await page.getByRole('button', { name: tab }).click();
  await page.waitForTimeout(450);
}
await page.getByRole('button', { name: 'Usuarios y técnicos' }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(artifacts, '32-config-usuarios.png'), fullPage: true });

// Móvil: menú lateral y navegación
const mobileContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
  locale: 'es-AR',
  timezoneId: 'America/Argentina/Buenos_Aires',
  storageState: await context.storageState(),
});
const mobile = await mobileContext.newPage();
await mobile.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' });
await mobile.getByRole('button', { name: 'Abrir menú' }).click();
await mobile.waitForTimeout(400);
await mobile.screenshot({ path: path.join(artifacts, '33-menu-movil.png') });
await mobile.getByRole('link', { name: 'Clientes' }).click();
await mobile.waitForURL('**/clientes');
await mobile.waitForTimeout(700);
await mobile.screenshot({ path: path.join(artifacts, '34-clientes-movil.png'), fullPage: true });

console.log(JSON.stringify({
  createdOrderUrl,
  orderNumber,
  receiptBytes: fs.statSync(receiptPath).size,
  receiptPages: (fs.readFileSync(receiptPath).toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length,
  errors,
}, null, 2));

await browser.close();
