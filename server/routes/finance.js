import { Router } from 'express';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth.js';
import { all, get, insert, run } from '../db.js';
import {
  asyncHandler,
  audit,
  dateRangeFromQuery,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  HttpError,
  isoDate,
  monthRange,
  nowIso,
  optionalDaySchema,
  optionalString,
  pagination,
  parse,
  PAYMENT_METHODS,
  requiredString,
  roundMoney,
} from '../utils.js';

const router = Router();
router.use(requireAuth);

const billableExpr = `COALESCE(NULLIF(o.final_price, 0), o.estimated_budget)`;
const paidExpr = `COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id AND p.deleted_at IS NULL), 0)`;
const partsCostExpr = `COALESCE((SELECT SUM(op.quantity * op.unit_cost) FROM order_parts op WHERE op.order_id = o.id AND op.removed_at IS NULL), 0)`;

function buildSeries(from, to) {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
  const monthly = days > 62;
  const points = [];
  if (monthly) {
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
      points.push({
        key: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
        label: new Intl.DateTimeFormat('es-AR', { month: 'short', year: '2-digit' }).format(cursor).replace('.', ''),
      });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  } else {
    const cursor = new Date(start);
    while (cursor <= end) {
      points.push({
        key: isoDate(cursor),
        label: new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit' }).format(cursor),
      });
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return { points, monthly };
}

router.get(
  '/summary',
  asyncHandler((req, res) => {
    const { from, to } = dateRangeFromQuery(req.query);
    const income = get(
      `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM transactions
       WHERE type = 'INGRESO' AND deleted_at IS NULL AND date(transaction_date) BETWEEN date(?) AND date(?)`,
      [from, to],
    );
    const expense = get(
      `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count FROM transactions
       WHERE type = 'EGRESO' AND deleted_at IS NULL AND date(transaction_date) BETWEEN date(?) AND date(?)`,
      [from, to],
    );
    const billing = get(
      `SELECT COUNT(*) AS count, COALESCE(SUM(${billableExpr}), 0) AS billed,
        COALESCE(SUM(${partsCostExpr}), 0) AS parts_cost,
        COALESCE(SUM(o.labor_cost), 0) AS labor_cost
       FROM orders o WHERE o.status = 'ENTREGADO' AND date(o.delivered_at) BETWEEN date(?) AND date(?)`,
      [from, to],
    );
    const receivables = get(
      `SELECT COALESCE(SUM(balance), 0) AS total, COUNT(*) AS count FROM (
        SELECT MAX(${billableExpr} - ${paidExpr}, 0) AS balance FROM orders o
        WHERE o.status NOT IN ('ENTREGADO','CANCELADO','SIN_REPARACION')
      ) WHERE balance > 0.009`,
    );
    const incomeByCategory = all(
      `SELECT category, COALESCE(SUM(amount), 0) AS total FROM transactions
       WHERE type = 'INGRESO' AND deleted_at IS NULL AND date(transaction_date) BETWEEN date(?) AND date(?)
       GROUP BY category ORDER BY total DESC`,
      [from, to],
    );
    const expenseByCategory = all(
      `SELECT category, COALESCE(SUM(amount), 0) AS total FROM transactions
       WHERE type = 'EGRESO' AND deleted_at IS NULL AND date(transaction_date) BETWEEN date(?) AND date(?)
       GROUP BY category ORDER BY total DESC`,
      [from, to],
    );
    const methods = all(
      `SELECT method, type, COALESCE(SUM(amount), 0) AS total FROM transactions
       WHERE deleted_at IS NULL AND date(transaction_date) BETWEEN date(?) AND date(?)
       GROUP BY method, type ORDER BY method`,
      [from, to],
    );

    const { points, monthly } = buildSeries(from, to);
    const incomeRows = all(
      `SELECT ${monthly ? "substr(transaction_date, 1, 7)" : 'transaction_date'} AS key, COALESCE(SUM(amount), 0) AS total
       FROM transactions WHERE type = 'INGRESO' AND deleted_at IS NULL
         AND date(transaction_date) BETWEEN date(?) AND date(?) GROUP BY key`,
      [from, to],
    );
    const expenseRows = all(
      `SELECT ${monthly ? "substr(transaction_date, 1, 7)" : 'transaction_date'} AS key, COALESCE(SUM(amount), 0) AS total
       FROM transactions WHERE type = 'EGRESO' AND deleted_at IS NULL
         AND date(transaction_date) BETWEEN date(?) AND date(?) GROUP BY key`,
      [from, to],
    );
    const incomeMap = Object.fromEntries(incomeRows.map((row) => [row.key, Number(row.total)]));
    const expenseMap = Object.fromEntries(expenseRows.map((row) => [row.key, Number(row.total)]));
    const series = points.map((point) => ({
      label: point.label,
      ingresos: incomeMap[point.key] || 0,
      gastos: expenseMap[point.key] || 0,
      resultado: roundMoney((incomeMap[point.key] || 0) - (expenseMap[point.key] || 0)),
    }));

    const estimatedProfit = roundMoney(
      Number(billing.billed) - Number(billing.parts_cost) - Number(billing.labor_cost),
    );
    const summary = {
      billing: roundMoney(billing.billed),
      deliveredOrders: billing.count,
      collected: roundMoney(income.total),
      expenses: roundMoney(expense.total),
      cashResult: roundMoney(Number(income.total) - Number(expense.total)),
      estimatedProfit,
      partsCost: roundMoney(billing.parts_cost),
      laborCost: roundMoney(billing.labor_cost),
      receivables: roundMoney(receivables.total),
      receivableOrders: receivables.count,
      averageTicket: billing.count ? roundMoney(Number(billing.billed) / billing.count) : 0,
      incomeTransactions: income.count,
      expenseTransactions: expense.count,
      period: { from, to },
    };

    const today = isoDate();
    const todayCash = get(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'INGRESO' THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'EGRESO' THEN amount ELSE 0 END), 0) AS expenses
       FROM transactions WHERE deleted_at IS NULL AND date(transaction_date) = date(?)`,
      [today],
    );
    const month = monthRange();
    const monthCash = get(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'INGRESO' THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'EGRESO' THEN amount ELSE 0 END), 0) AS expenses
       FROM transactions WHERE deleted_at IS NULL AND date(transaction_date) BETWEEN date(?) AND date(?)`,
      [month.from, month.to],
    );
    const cash = {
      today: {
        date: today,
        income: roundMoney(todayCash.income),
        expenses: roundMoney(todayCash.expenses),
        balance: roundMoney(Number(todayCash.income) - Number(todayCash.expenses)),
      },
      month: {
        ...month,
        income: roundMoney(monthCash.income),
        expenses: roundMoney(monthCash.expenses),
        balance: roundMoney(Number(monthCash.income) - Number(monthCash.expenses)),
      },
    };

    res.json({
      summary,
      series,
      monthly,
      incomeByCategory,
      expenseByCategory,
      methods,
      cash,
      categories: { income: INCOME_CATEGORIES, expense: EXPENSE_CATEGORIES },
      paymentMethods: PAYMENT_METHODS,
    });
  }),
);

router.get(
  '/transactions',
  asyncHandler((req, res) => {
    const { page, limit, offset } = pagination(req.query);
    const where = ['1 = 1'];
    const params = [];
    if (req.query.type) {
      where.push('t.type = ?');
      params.push(String(req.query.type).toUpperCase());
    }
    if (req.query.category) {
      where.push('t.category = ?');
      params.push(req.query.category);
    }
    if (req.query.method) {
      where.push('t.method = ?');
      params.push(String(req.query.method).toUpperCase());
    }
    if (req.query.from) {
      where.push('date(t.transaction_date) >= date(?)');
      params.push(req.query.from);
    }
    if (req.query.to) {
      where.push('date(t.transaction_date) <= date(?)');
      params.push(req.query.to);
    }
    const search = String(req.query.search || '').trim();
    if (search) {
      const like = `%${search.toLowerCase()}%`;
      where.push(
        `(lower(t.description) LIKE ? OR lower(t.category) LIKE ? OR lower(COALESCE(o.order_number,'')) LIKE ? OR lower(COALESCE(u.full_name,'')) LIKE ?)`,
      );
      params.push(like, like, like, like);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const total = get(
      `SELECT COUNT(*) AS count FROM transactions t LEFT JOIN orders o ON o.id = t.order_id
       LEFT JOIN users u ON u.id = t.created_by ${whereSql}`,
      params,
    ).count;
    const transactions = all(
      `SELECT t.*, o.order_number, u.full_name AS created_by_name,
        c.first_name, c.last_name
       FROM transactions t LEFT JOIN orders o ON o.id = t.order_id
       LEFT JOIN users u ON u.id = t.created_by
       LEFT JOIN clients c ON c.id = o.client_id
       ${whereSql} ORDER BY t.transaction_date DESC, t.id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    res.json({ transactions, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) });
  }),
);

router.get(
  '/receivables',
  asyncHandler((req, res) => {
    const orders = all(
      `SELECT * FROM (
        SELECT o.id, o.order_number, o.status, o.created_at, o.estimated_delivery,
          o.final_price, o.estimated_budget, c.id AS client_id, c.first_name, c.last_name,
          c.phone, et.name AS equipment_type_name, t.name AS technician_name,
          ${paidExpr} AS paid, ${billableExpr} AS billable,
          MAX(${billableExpr} - ${paidExpr}, 0) AS balance
        FROM orders o JOIN clients c ON c.id = o.client_id
        JOIN equipment_types et ON et.id = o.equipment_type_id
        LEFT JOIN technicians t ON t.id = o.technician_id
        WHERE o.status NOT IN ('CANCELADO','SIN_REPARACION')
      ) WHERE balance > 0.009
      ORDER BY balance DESC, created_at ASC`,
    );
    const total = orders.reduce((sum, order) => sum + Number(order.balance), 0);
    res.json({
      receivables: orders.map((order) => ({
        ...order,
        client_name: `${order.first_name} ${order.last_name}`,
        paid: roundMoney(order.paid),
        billable: roundMoney(order.billable),
        balance: roundMoney(order.balance),
      })),
      total: roundMoney(total),
      count: orders.length,
    });
  }),
);

const transactionSchema = z.object({
  type: z.enum(['INGRESO', 'EGRESO']),
  category: requiredString('La categoría', 2, 80),
  description: requiredString('La descripción', 3, 300),
  amount: z.coerce.number().positive('El importe debe ser mayor a cero.').max(999999999),
  method: z.enum(PAYMENT_METHODS),
  transaction_date: optionalDaySchema.optional(),
  order_id: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
    z.number().int().positive().nullable(),
  ).optional(),
  supplier_id: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? null : Number(value)),
    z.number().int().positive().nullable(),
  ).optional(),
  notes: optionalString(500),
});

router.post(
  '/transactions',
  asyncHandler((req, res) => {
    const data = parse(transactionSchema, req.body);
    if (data.order_id && !get('SELECT id FROM orders WHERE id = ?', [data.order_id])) {
      throw new HttpError(422, 'La orden indicada no existe.');
    }
    if (data.supplier_id && !get('SELECT id FROM suppliers WHERE id = ?', [data.supplier_id])) {
      throw new HttpError(422, 'El proveedor indicado no existe.');
    }
    const id = insert(
      `INSERT INTO transactions (type, category, description, amount, method, transaction_date, order_id, supplier_id, notes, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.type,
        data.category,
        data.description,
        data.amount,
        data.method,
        data.transaction_date || isoDate(),
        data.order_id || null,
        data.supplier_id || null,
        data.notes,
        req.user.id,
        nowIso(),
      ],
    );
    audit(req, 'TRANSACTION_CREATE', 'transaction', id, `Se registró un ${data.type.toLowerCase()} de $${data.amount} (${data.category}).`);
    res.status(201).json({
      ok: true,
      message: `${data.type === 'INGRESO' ? 'Ingreso' : 'Egreso'} registrado correctamente.`,
      transaction: get('SELECT * FROM transactions WHERE id = ?', [id]),
    });
  }),
);

router.delete(
  '/transactions/:id',
  requireRole('admin'),
  asyncHandler((req, res) => {
    const id = Number(req.params.id);
    const transaction = get('SELECT * FROM transactions WHERE id = ? AND deleted_at IS NULL', [id]);
    if (!transaction) throw new HttpError(404, 'Movimiento no encontrado.');
    if (transaction.payment_id) {
      throw new HttpError(409, 'Este ingreso proviene de un pago de reparación. Anulá el pago desde la orden.');
    }
    run('UPDATE transactions SET deleted_at = ? WHERE id = ?', [nowIso(), id]);
    audit(req, 'TRANSACTION_DELETE', 'transaction', id, `Se anuló el movimiento “${transaction.description}” por $${transaction.amount}.`);
    res.json({ ok: true, message: 'Movimiento anulado. Seguirá visible en el historial como anulado.' });
  }),
);

router.get(
  '/cash',
  asyncHandler((req, res) => {
    const date = req.query.date || isoDate();
    const transactions = all(
      `SELECT t.*, o.order_number, u.full_name AS created_by_name
       FROM transactions t LEFT JOIN orders o ON o.id = t.order_id
       LEFT JOIN users u ON u.id = t.created_by
       WHERE t.deleted_at IS NULL AND date(t.transaction_date) = date(?)
       ORDER BY t.created_at DESC`,
      [date],
    );
    const methods = all(
      `SELECT method, type, COALESCE(SUM(amount),0) AS total FROM transactions
       WHERE deleted_at IS NULL AND date(transaction_date) = date(?) GROUP BY method, type`,
      [date],
    );
    const income = transactions.filter((item) => item.type === 'INGRESO').reduce((sum, item) => sum + Number(item.amount), 0);
    const expenses = transactions.filter((item) => item.type === 'EGRESO').reduce((sum, item) => sum + Number(item.amount), 0);
    res.json({
      date,
      transactions,
      methods,
      summary: { income: roundMoney(income), expenses: roundMoney(expenses), balance: roundMoney(income - expenses) },
    });
  }),
);

export default router;
