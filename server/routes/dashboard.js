import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { all, get, getSettings } from '../db.js';
import { asyncHandler, isoDate, monthRange, roundMoney } from '../utils.js';

const router = Router();
router.use(requireAuth);

function monthSequence(count = 6) {
  const now = new Date();
  const months = [];
  for (let index = count - 1; index >= 0; index -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - index, 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    months.push({
      key,
      label: new Intl.DateTimeFormat('es-AR', { month: 'short' }).format(date).replace('.', ''),
      fullLabel: new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(date),
    });
  }
  return months;
}

router.get(
  '/',
  asyncHandler((req, res) => {
    const settings = getSettings();
    const { from, to } = monthRange(new Date());
    const activeStatuses = `'RECIBIDO','PENDIENTE_DIAGNOSTICO','EN_DIAGNOSTICO','PRESUPUESTADO','ESPERANDO_APROBACION','ESPERANDO_REPUESTOS','EN_REPARACION','EN_PRUEBAS','REPARADO','LISTO_PARA_RETIRAR'`;
    const billableExpr = `COALESCE(NULLIF(o.final_price, 0), o.estimated_budget)`;
    const paidExpr = `COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id AND p.deleted_at IS NULL), 0)`;

    const statusCounts = Object.fromEntries(
      all('SELECT status, COUNT(*) AS count FROM orders GROUP BY status').map((row) => [row.status, row.count]),
    );
    const totalEquipment = get('SELECT COUNT(*) AS count FROM orders').count;
    const pendingDiagnosis = (statusCounts.RECIBIDO || 0) + (statusCounts.PENDIENTE_DIAGNOSTICO || 0);
    const inRepair = statusCounts.EN_REPARACION || 0;
    const waitingParts = statusCounts.ESPERANDO_REPUESTOS || 0;
    const readyToDeliver = (statusCounts.REPARADO || 0) + (statusCounts.LISTO_PARA_RETIRAR || 0);
    const delivered = statusCounts.ENTREGADO || 0;
    const pendingRepairs = get(
      `SELECT COUNT(*) AS count FROM orders WHERE status IN (${activeStatuses})`,
    ).count;

    const finances = get(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'INGRESO' AND deleted_at IS NULL THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'EGRESO' AND deleted_at IS NULL THEN amount ELSE 0 END), 0) AS expenses
       FROM transactions WHERE date(transaction_date) BETWEEN date(?) AND date(?)`,
      [from, to],
    );
    const incomeMonth = roundMoney(finances.income);
    const expensesMonth = roundMoney(finances.expenses);
    const netProfit = roundMoney(incomeMonth - expensesMonth);

    const billing = get(
      `SELECT COALESCE(SUM(${billableExpr}), 0) AS billed
       FROM orders o
       WHERE o.status NOT IN ('CANCELADO','SIN_REPARACION')
         AND date(o.created_at) BETWEEN date(?) AND date(?)`,
      [from, to],
    );
    const collectedMonth = get(
      `SELECT COALESCE(SUM(amount), 0) AS paid FROM payments
       WHERE deleted_at IS NULL AND date(received_at) BETWEEN date(?) AND date(?)`,
      [from, to],
    );
    const receivables = get(
      `SELECT COALESCE(SUM(MAX(${billableExpr} - ${paidExpr}, 0)), 0) AS debt
       FROM orders o WHERE o.status IN (${activeStatuses})`,
    ).debt;
    const lowStock = all(
      `SELECT p.id, p.name, p.stock, p.min_stock, pc.name AS category_name
       FROM products p LEFT JOIN product_categories pc ON pc.id = p.category_id
       WHERE p.active = 1 AND p.stock <= p.min_stock
       ORDER BY (p.stock = 0) DESC, p.stock ASC, p.name LIMIT 8`,
    );
    const outOfStock = get('SELECT COUNT(*) AS count FROM products WHERE active = 1 AND stock <= 0').count;
    const lowStockCount = get(
      'SELECT COUNT(*) AS count FROM products WHERE active = 1 AND stock <= min_stock',
    ).count;

    const months = monthSequence(6);
    const incomeRows = all(
      `SELECT substr(transaction_date, 1, 7) AS month, COALESCE(SUM(amount), 0) AS total
       FROM transactions WHERE type = 'INGRESO' AND deleted_at IS NULL
       GROUP BY month`,
    );
    const expenseRows = all(
      `SELECT substr(transaction_date, 1, 7) AS month, COALESCE(SUM(amount), 0) AS total
       FROM transactions WHERE type = 'EGRESO' AND deleted_at IS NULL
       GROUP BY month`,
    );
    const orderRows = all(
      `SELECT substr(created_at, 1, 7) AS month, COUNT(*) AS total FROM orders GROUP BY month`,
    );
    const deliveredRows = all(
      `SELECT substr(delivered_at, 1, 7) AS month, COUNT(*) AS total FROM orders
       WHERE delivered_at IS NOT NULL GROUP BY month`,
    );
    const incomeMap = Object.fromEntries(incomeRows.map((row) => [row.month, Number(row.total)]));
    const expenseMap = Object.fromEntries(expenseRows.map((row) => [row.month, Number(row.total)]));
    const orderMap = Object.fromEntries(orderRows.map((row) => [row.month, Number(row.total)]));
    const deliveredMap = Object.fromEntries(deliveredRows.map((row) => [row.month, Number(row.total)]));
    const chart = months.map((month) => ({
      month: month.label,
      fullLabel: month.fullLabel,
      ingresos: incomeMap[month.key] || 0,
      gastos: expenseMap[month.key] || 0,
      ganancia: roundMoney((incomeMap[month.key] || 0) - (expenseMap[month.key] || 0)),
      reparaciones: orderMap[month.key] || 0,
      entregados: deliveredMap[month.key] || 0,
    }));

    const recentOrders = all(
      `SELECT o.id, o.order_number, o.status, o.priority, o.brand, o.model, o.created_at, o.estimated_delivery,
        c.first_name, c.last_name, c.phone, et.name AS equipment_type_name,
        ${paidExpr} AS paid_total, ${billableExpr} AS billable
       FROM orders o JOIN clients c ON c.id = o.client_id
       JOIN equipment_types et ON et.id = o.equipment_type_id
       ORDER BY o.created_at DESC LIMIT 8`,
    ).map((order) => ({
      ...order,
      client_name: `${order.first_name} ${order.last_name}`,
      balance: roundMoney(Math.max(Number(order.billable) - Number(order.paid_total), 0)),
    }));

    const recentActivity = all(
      `SELECT id, username, action, entity_type, entity_id, description, created_at
       FROM activity_log ORDER BY created_at DESC LIMIT 8`,
    );

    const statusDistribution = all(
      `SELECT status, COUNT(*) AS count FROM orders GROUP BY status ORDER BY count DESC`,
    );

    res.json({
      generatedAt: new Date().toISOString(),
      period: { from, to },
      currency: settings.currency || 'ARS',
      stats: {
        totalEquipment,
        pendingDiagnosis,
        inRepair,
        waitingParts,
        readyToDeliver,
        delivered,
        incomeMonth,
        expensesMonth,
        netProfit,
        pendingRepairs,
        billingMonth: roundMoney(billing.billed),
        collectedMonth: roundMoney(collectedMonth.paid),
        receivables: roundMoney(receivables),
        outOfStock,
        lowStockCount,
      },
      chart,
      recentOrders,
      recentActivity,
      lowStock,
      statusDistribution,
    });
  }),
);

export default router;
