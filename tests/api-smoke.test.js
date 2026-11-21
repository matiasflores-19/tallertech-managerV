import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const testDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tallertech-test-'));
process.env.DATA_DIR = testDataDir;
process.env.NODE_ENV = 'test';
process.env.SEED_DEMO = 'true';
process.env.JWT_SECRET = 'test-jwt-secret-only-for-integration-tests';
process.env.ENCRYPTION_KEY = 'test-encryption-key-only-for-integration-tests';

const { default: app } = await import('../server/index.js');
const { ensureBaseData, closeDb } = await import('../server/db.js');
const { seedDemoData } = await import('../server/seed.js');

ensureBaseData();
seedDemoData();
const server = app.listen(0);
await new Promise((resolve) => server.once('listening', resolve));
const { port } = server.address();
const base = `http://127.0.0.1:${port}/api`;
let cookie = '';

async function request(path, { method = 'GET', body, raw = false } = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (raw) return response;
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { response, data };
}

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  closeDb();
  fs.rmSync(testDataDir, { recursive: true, force: true });
});

test('rechaza el acceso sin sesión', async () => {
  const { response } = await request('/dashboard');
  assert.equal(response.status, 401);
});

test('inicia sesión y devuelve el usuario', async () => {
  const { response, data } = await request('/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'Admin1234!' },
  });
  assert.equal(response.status, 200);
  assert.equal(data.user.username, 'admin');
  assert.equal(data.user.role, 'admin');
  cookie = response.headers.getSetCookie()[0].split(';')[0];
  assert.ok(cookie.startsWith('tt_session='));
});

test('dashboard y metadatos responden con datos demo', async () => {
  const { data: dashboard } = await request('/dashboard');
  assert.ok(dashboard.stats.totalEquipment >= 30);
  assert.equal(dashboard.chart.length, 6);
  assert.ok(dashboard.recentOrders.length > 0);
  const { data: meta } = await request('/meta');
  assert.ok(meta.equipmentTypes.length >= 12);
  assert.ok(meta.technicians.length >= 3);
});

test('crea cliente, orden, repuesto, pago y cambia estado', async () => {
  const stamp = Date.now();
  const clientPayload = {
    first_name: 'Test',
    last_name: `Cliente ${stamp}`,
    phone: `11 77${String(stamp).slice(-6)}`,
    email: `test${stamp}@example.com`,
    dni: '40111222',
    address: 'Calle de prueba 123',
  };
  const { response: clientResponse, data: clientData } = await request('/clients', {
    method: 'POST',
    body: clientPayload,
  });
  assert.equal(clientResponse.status, 201);
  assert.ok(clientData.client.id);

  const equipmentTypeId = (await request('/meta')).data.equipmentTypes[0].id;
  const technicianId = (await request('/meta')).data.technicians[0].id;
  const { response: orderResponse, data: orderData } = await request('/orders', {
    method: 'POST',
    body: {
      client_id: clientData.client.id,
      equipment_type_id: equipmentTypeId,
      brand: 'Marca Test',
      model: 'Modelo Test',
      serial_number: 'SN-TEST-001',
      declared_issue: 'No enciende',
      detailed_problem: 'Equipo de prueba de integración.',
      physical_condition: 'Buen estado',
      technician_id: technicianId,
      priority: 'ALTA',
      estimated_budget: 100000,
      estimated_delivery: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 10),
      deposit_amount: 30000,
      payment_method: 'EFECTIVO',
      unlock_type: 'Contraseña',
      unlock_secret: 'secreto-123',
      photos: [],
    },
  });
  assert.equal(orderResponse.status, 201);
  assert.match(orderData.order.order_number, /^OT-\d{4}-\d{4}$/);
  assert.equal(orderData.order.has_unlock, true);
  const orderId = orderData.order.id;

  const { data: detail } = await request(`/orders/${orderId}`);
  assert.equal(detail.payments.length, 1);
  assert.equal(Number(detail.order.paid_total), 30000);
  assert.equal(Number(detail.order.balance), 70000);
  assert.equal(detail.statusHistory.length, 1);

  const { data: inventory } = await request('/inventory/products');
  const product = inventory.products.find((item) => item.stock > 0);
  const stockBefore = product.stock;
  const { response: partResponse, data: partData } = await request(`/orders/${orderId}/parts`, {
    method: 'POST',
    body: { product_id: product.id, quantity: 1, unit_price: 15000 },
  });
  assert.equal(partResponse.status, 201);
  assert.equal(partData.stock, stockBefore - 1);

  const { response: paymentResponse, data: paymentData } = await request(`/orders/${orderId}/payments`, {
    method: 'POST',
    body: { amount: 20000, method: 'TRANSFERENCIA', payment_type: 'PAGO_PARCIAL' },
  });
  assert.equal(paymentResponse.status, 201);
  assert.equal(Number(paymentData.order.paid_total), 50000);
  assert.equal(Number(paymentData.order.balance), 50000);

  const { response: statusResponse, data: statusData } = await request(`/orders/${orderId}/status`, {
    method: 'PATCH',
    body: { status: 'EN_DIAGNOSTICO', note: 'Diagnóstico iniciado en prueba.' },
  });
  assert.equal(statusResponse.status, 200);
  assert.equal(statusData.order.status, 'EN_DIAGNOSTICO');

  const { data: unlockData } = await request(`/orders/${orderId}/reveal-unlock`, { method: 'POST' });
  assert.equal(unlockData.unlock_secret, 'secreto-123');

  const { data: duplicateData, response: duplicateResponse } = await request('/clients', {
    method: 'POST',
    body: clientPayload,
  });
  assert.equal(duplicateResponse.status, 409);
  assert.ok(duplicateData.error);

  return orderId;
});

test('genera comprobante PDF y reportes PDF/Excel', async () => {
  const dashboard = (await request('/dashboard')).data;
  const orderId = dashboard.recentOrders[0].id;
  const receipt = await request(`/orders/${orderId}/receipt.pdf`, { raw: true });
  assert.equal(receipt.status, 200);
  assert.match(receipt.headers.get('content-type'), /application\/pdf/);
  const pdf = Buffer.from(await receipt.arrayBuffer());
  assert.ok(pdf.length > 2000);
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');

  const reportPdf = await request('/reports/export?kind=reparaciones&format=pdf', { raw: true });
  assert.equal(reportPdf.status, 200);
  assert.ok(Buffer.from(await reportPdf.arrayBuffer()).length > 2000);

  const reportExcel = await request('/reports/export?kind=finanzas&format=xlsx', { raw: true });
  assert.equal(reportExcel.status, 200);
  const xlsx = Buffer.from(await reportExcel.arrayBuffer());
  assert.equal(xlsx.subarray(0, 2).toString(), 'PK');
});

test('finanzas, inventario y respaldo JSON funcionan', async () => {
  const { data: finance } = await request('/finance/summary');
  assert.ok(Number(finance.summary.collected) > 0);
  assert.ok(Array.isArray(finance.series));

  const { data: receivables } = await request('/finance/receivables');
  assert.ok(receivables.total >= 0);

  const { response: movementResponse } = await request('/inventory/movements', {
    method: 'POST',
    body: { product_id: 1, movement_type: 'ENTRADA', quantity: 2, reason: 'Prueba de integración' },
  });
  assert.equal(movementResponse.status, 201);

  const backupResponse = await request('/settings/backup?images=true', { raw: true });
  assert.equal(backupResponse.status, 200);
  const backupJson = await backupResponse.json();
  assert.equal(backupJson.app, 'TallerTech Manager');
  assert.ok(backupJson.tables.orders.length >= 30);

  const report = (await request('/reports/data?kind=ganancias')).data.report;
  assert.equal(report.kind, 'ganancias');
  assert.ok(Array.isArray(report.columns));

  const restoreSource = await (await request('/settings/backup?images=false', { raw: true })).json();
  const stamp = Date.now();
  const { data: tempClient } = await request('/clients', {
    method: 'POST',
    body: { first_name: 'Temporal', last_name: `Restore ${stamp}`, phone: `11 66${String(stamp).slice(-6)}` },
  });
  assert.ok(tempClient.client.id);

  const restoreResponse = await request('/settings/restore', {
    method: 'POST',
    body: { password: 'Admin1234!', confirmation: 'RESTAURAR', backup: restoreSource },
  });
  assert.equal(restoreResponse.response.status, 200);
  assert.equal(restoreResponse.data.ok, true);

  const login = await request('/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'Admin1234!' },
  });
  cookie = login.response.headers.getSetCookie()[0].split(';')[0];
  const { data: clientsAfterRestore } = await request('/clients?search=Temporal');
  assert.equal(clientsAfterRestore.total, 0);
});
