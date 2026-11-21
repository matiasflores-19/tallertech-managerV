import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4000';
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const artifacts = path.resolve('artifacts');
fs.mkdirSync(artifacts, { recursive: true });
const stamp = Date.now().toString().slice(-6);
const errors = [];

const browser = await chromium.launch({ executablePath: EDGE, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'es-AR',
  timezoneId: 'America/Argentina/Buenos_Aires',
  acceptDownloads: true,
});
const page = await context.newPage();
page.on('pageerror', (error) => errors.push(`PAGE: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error' && !message.text().includes('401')) errors.push(`CONSOLE: ${message.text()}`);
});

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.fill('#username', 'admin');
await page.fill('#password', 'Admin1234!');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard');
await page.waitForTimeout(1500);

const manifest = await page.evaluate(async () => {
  const link = document.querySelector('link[rel="manifest"]');
  const response = await fetch(link.href);
  const json = await response.json();
  return { href: link.href, status: response.status, name: json.short_name, icons: json.icons.length };
});

const serviceWorker = await page.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return { supported: false };
  const registration = await navigator.serviceWorker.getRegistration();
  return { supported: true, registered: Boolean(registration), scope: registration?.scope || null };
});

await page.waitForTimeout(4500);
const installBanner = await page.getByText('Instalá TallerTech en el celular').isVisible().catch(() => false);
if (installBanner) {
  await page.screenshot({ path: path.join(artifacts, '40-pwa-instalar.png') });
  await page.getByRole('button', { name: 'Instalar' }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(artifacts, '41-pwa-instrucciones.png') });
  await page.getByRole('button', { name: 'Cerrar' }).first().click();
}

// Recepción rápida desde el celular
await page.goto(`${BASE}/recepcion`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(artifacts, '42-recepcion-paso1.png'), fullPage: true });
await page.getByPlaceholder('Ej. Juan').fill('Recepción');
await page.getByPlaceholder('Ej. Pérez').fill(`Móvil ${stamp}`);
await page.getByPlaceholder('Ej. 11 5555-1234').fill(`11 55${stamp}`);
await page.getByRole('button', { name: /Continuar/ }).click();
await page.waitForTimeout(300);
await page.locator('select').first().selectOption({ label: 'Notebook' });
await page.getByPlaceholder('Ej. Samsung').fill('Lenovo');
await page.getByPlaceholder('Ej. Galaxy A54').fill('ThinkPad E14');
await page.getByPlaceholder('Ej. No enciende después de una descarga').fill('No enciende después de un corte de luz.');
const cameraCount = await page.locator('input[type="file"][capture="environment"]').count();
await page.screenshot({ path: path.join(artifacts, '43-recepcion-paso2.png'), fullPage: true });
await page.getByRole('button', { name: /Continuar/ }).click();
await page.waitForTimeout(300);
const numbers = page.locator('input[type="number"]');
await numbers.nth(0).fill('100000');
await numbers.nth(1).fill('20000');
await page.screenshot({ path: path.join(artifacts, '44-recepcion-paso3.png'), fullPage: true });
await page.getByRole('button', { name: /Confirmar ingreso/ }).click();
await page.waitForURL(/\/ordenes\/\d+$/, { timeout: 15000 });
await page.waitForTimeout(900);
const orderNumber = await page.locator('h1').first().innerText();
await page.screenshot({ path: path.join(artifacts, '45-recepcion-creada.png'), fullPage: true });

console.log(JSON.stringify({
  manifest,
  serviceWorker,
  installBanner,
  cameraCount,
  orderNumber,
  errors: [...new Set(errors)],
}, null, 2));

await browser.close();
