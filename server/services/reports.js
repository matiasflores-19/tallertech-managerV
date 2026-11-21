import { all, get } from '../db.js';
import { STATUS_META, roundMoney } from '../utils.js';

const money = (value) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(
    Number(value || 0),
  );

const number = (value) => new Intl.NumberFormat('es-AR').format(Number(value || 0));

const dateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
};

const dateOnly = (value) => {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short' }).format(date);
};

const statusLabel = (status) => STATUS_META[status]?.label || status;

function orderFilters(query, alias = 'o') {
  const where = [];
  const params = [];
  if (query.status) {
    where.push(`${alias}.status = ?`);
    params.push(query.status);
  }
  if (query.equipment_type_id) {
    where.push(`${alias}.equipment_type_id = ?`);
    params.push(Number(query.equipment_type_id));
  }
  if (query.technician_id) {
    where.push(`${alias}.technician_id = ?`);
    params.push(Number(query.technician_id));
  }
  if (query.search) {
    const like = `%${String(query.search).toLowerCase()}%`;
    where.push(
      `(lower(${alias}.order_number) LIKE ? OR lower(c.first_name || ' ' || c.last_name) LIKE ? OR c.phone LIKE ? OR lower(${alias}.brand) LIKE ? OR lower(${alias}.model) LIKE ? OR lower(COALESCE(${alias}.serial_number,'')) LIKE ?)`,
    );
    params.push(like, like, `%${query.search}%`, like, like, like);
  }
  return { where, params };
}

const billableExpr = 'COALESCE(NULLIF(o.final_price, 0), o.estimated_budget)';
const paidExpr = 'COALESCE((SELECT SUM(p.amount) FROM payments p WHERE p.order_id = o.id AND p.deleted_at IS NULL), 0)';
const partsCostExpr = 'COALESCE((SELECT SUM(op.quantity * op.unit_cost) FROM order_parts op WHERE op.order_id = o.id AND op.removed_at IS NULL), 0)';

function orderRows(query, dateField = 'o.created_at') {
  const { where, params } = orderFilters(query);
  where.unshift(`date(${dateField}) BETWEEN date(?) AND date(?)`);
  params.unshift(query.from, query.to);
  return all(
    `SELECT o.id, o.order_number, o.intake_at, o.delivered_at, o.status, o.brand, o.model,
      c.first_name, c.last_name, c.phone, et.name AS equipment_type_name, t.name AS technician_name,
      ${billableExpr} AS billable, ${paidExpr} AS paid, ${partsCostExpr} AS parts_cost, o.labor_cost,
      MAX(${billableExpr} - ${paidExpr}, 0) AS balance
     FROM orders o JOIN clients c ON c.id = o.client_id
     JOIN equipment_types et ON et.id = o.equipment_type_id
     LEFT JOIN technicians t ON t.id = o.technician_id
     WHERE ${where.join(' AND ')}
     ORDER BY ${dateField} DESC`,
    params,
  );
}

function mapOrderRow(row) {
  return {
    orden: row.order_number,
    fecha: dateOnly(row.intake_at),
    cliente: `${row.first_name} ${row.last_name}`,
    telefono: row.phone,
    equipo: `${row.equipment_type_name} · ${row.brand} ${row.model}`,
    tecnico: row.technician_name || 'Sin asignar',
    estado: statusLabel(row.status),
    presupuesto: money(row.billable),
    cobrado: money(row.paid),
    saldo: money(row.balance),
  };
}

export function buildReport(kind, query = {}) {
  const from = query.from || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);
  const to = query.to || new Date().toISOString().slice(0, 10);
  const base = { kind, from, to, generatedAt: new Date().toISOString() };

  if (kind === 'reparaciones' || kind === 'pendientes' || kind === 'entregados') {
    let rows;
    if (kind === 'reparaciones') {
      rows = orderRows({ ...query, from, to });
    } else if (kind === 'pendientes') {
      const { where, params } = orderFilters(query);
      where.push("o.status NOT IN ('ENTREGADO','CANCELADO','SIN_REPARACION')");
      where.push('date(o.created_at) <= date(?)');
      params.push(to);
      rows = all(
        `SELECT o.id, o.order_number, o.intake_at, o.delivered_at, o.status, o.brand, o.model,
          c.first_name, c.last_name, c.phone, et.name AS equipment_type_name, t.name AS technician_name,
          ${billableExpr} AS billable, ${paidExpr} AS paid, ${partsCostExpr} AS parts_cost, o.labor_cost,
          MAX(${billableExpr} - ${paidExpr}, 0) AS balance
         FROM orders o JOIN clients c ON c.id = o.client_id
         JOIN equipment_types et ON et.id = o.equipment_type_id
         LEFT JOIN technicians t ON t.id = o.technician_id
         WHERE ${where.join(' AND ')} ORDER BY o.created_at ASC`,
        params,
      );
    } else {
      rows = orderRows({ ...query, from, to }, 'o.delivered_at');
    }
    const mapped = rows.map(mapOrderRow);
    const billed = rows.reduce((sum, row) => sum + Number(row.billable), 0);
    const paid = rows.reduce((sum, row) => sum + Number(row.paid), 0);
    const balance = rows.reduce((sum, row) => sum + Number(row.balance), 0);
    const title =
      kind === 'reparaciones'
        ? 'Reporte de reparaciones'
        : kind === 'pendientes'
          ? 'Reparaciones pendientes'
          : 'Equipos entregados';
    return {
      ...base,
      title,
      summary: [
        { label: kind === 'pendientes' ? 'Órdenes pendientes' : 'Órdenes', value: number(rows.length) },
        { label: 'Importe facturado', value: money(billed) },
        { label: 'Cobrado', value: money(paid) },
        { label: 'Saldo pendiente', value: money(balance) },
      ],
      columns: [
        { key: 'orden', label: 'Orden', width: 1.1 },
        { key: 'fecha', label: 'Ingreso/entrega', width: 1 },
        { key: 'cliente', label: 'Cliente', width: 1.6 },
        { key: 'telefono', label: 'Teléfono', width: 1.1 },
        { key: 'equipo', label: 'Equipo', width: 2.1 },
        { key: 'tecnico', label: 'Técnico', width: 1.2 },
        { key: 'estado', label: 'Estado', width: 1.3 },
        { key: 'presupuesto', label: 'Facturado', width: 1, align: 'right' },
        { key: 'cobrado', label: 'Cobrado', width: 1, align: 'right' },
        { key: 'saldo', label: 'Saldo', width: 1, align: 'right' },
      ],
      rows: mapped,
      note: 'Los importes corresponden al precio final acordado y a los pagos efectivamente cobrados. Una seña no se considera pago total.',
    };
  }

  if (kind === 'finanzas') {
    const transactions = all(
      `SELECT t.*, o.order_number FROM transactions t LEFT JOIN orders o ON o.id = t.order_id
       WHERE t.deleted_at IS NULL AND date(t.transaction_date) BETWEEN date(?) AND date(?)
       ORDER BY t.transaction_date DESC, t.id DESC`,
      [from, to],
    );
    const income = transactions.filter((row) => row.type === 'INGRESO').reduce((sum, row) => sum + Number(row.amount), 0);
    const expenses = transactions.filter((row) => row.type === 'EGRESO').reduce((sum, row) => sum + Number(row.amount), 0);
    const rows = transactions.map((row) => ({
      fecha: dateOnly(row.transaction_date),
      tipo: row.type === 'INGRESO' ? 'Ingreso' : 'Egreso',
      categoria: row.category,
      descripcion: row.description,
      orden: row.order_number || '—',
      metodo: row.method,
      importe: `${row.type === 'EGRESO' ? '−' : ''}${money(row.amount)}`,
    }));
    return {
      ...base,
      title: 'Ingresos y egresos',
      summary: [
        { label: 'Ingresos cobrados', value: money(income) },
        { label: 'Egresos', value: money(expenses) },
        { label: 'Resultado de caja', value: money(income - expenses) },
        { label: 'Movimientos', value: number(transactions.length) },
      ],
      columns: [
        { key: 'fecha', label: 'Fecha', width: 1 },
        { key: 'tipo', label: 'Tipo', width: 0.8 },
        { key: 'categoria', label: 'Categoría', width: 1.4 },
        { key: 'descripcion', label: 'Descripción', width: 2.3 },
        { key: 'orden', label: 'Orden', width: 1 },
        { key: 'metodo', label: 'Método', width: 1 },
        { key: 'importe', label: 'Importe', width: 1.1, align: 'right' },
      ],
      rows,
      note: 'El resultado de caja refleja dinero efectivamente cobrado y pagado. No es equivalente a la facturación devengada.',
    };
  }

  if (kind === 'repuestos') {
    const rows = all(
      `SELECT op.quantity, op.unit_cost, op.unit_price, op.created_at, o.order_number,
        p.name, p.sku, p.brand, p.model
       FROM order_parts op JOIN products p ON p.id = op.product_id
       JOIN orders o ON o.id = op.order_id
       WHERE op.removed_at IS NULL AND date(op.created_at) BETWEEN date(?) AND date(?)
       ORDER BY op.created_at DESC`,
      [from, to],
    );
    const units = rows.reduce((sum, row) => sum + Number(row.quantity), 0);
    const cost = rows.reduce((sum, row) => sum + Number(row.quantity) * Number(row.unit_cost), 0);
    const sale = rows.reduce((sum, row) => sum + Number(row.quantity) * Number(row.unit_price), 0);
    return {
      ...base,
      title: 'Repuestos utilizados',
      summary: [
        { label: 'Unidades utilizadas', value: number(units) },
        { label: 'Costo de repuestos', value: money(cost) },
        { label: 'Valor de venta', value: money(sale) },
        { label: 'Margen bruto', value: money(sale - cost) },
      ],
      columns: [
        { key: 'fecha', label: 'Fecha', width: 1 },
        { key: 'orden', label: 'Orden', width: 1.1 },
        { key: 'producto', label: 'Repuesto', width: 2.2 },
        { key: 'sku', label: 'SKU', width: 1 },
        { key: 'cantidad', label: 'Cant.', width: 0.6, align: 'right' },
        { key: 'costo', label: 'Costo unit.', width: 1, align: 'right' },
        { key: 'precio', label: 'Precio unit.', width: 1, align: 'right' },
        { key: 'total', label: 'Subtotal', width: 1, align: 'right' },
      ],
      rows: rows.map((row) => ({
        fecha: dateOnly(row.created_at),
        orden: row.order_number,
        producto: `${row.name}${row.brand ? ` · ${row.brand}` : ''}${row.model ? ` ${row.model}` : ''}`,
        sku: row.sku || '—',
        cantidad: number(row.quantity),
        costo: money(row.unit_cost),
        precio: money(row.unit_price),
        total: money(Number(row.quantity) * Number(row.unit_price)),
      })),
      note: 'Solo se incluyen repuestos activos en órdenes; las reversiones no se contabilizan.',
    };
  }

  if (kind === 'stock') {
    const rows = all(
      `SELECT p.*, pc.name AS category_name, s.name AS supplier_name FROM products p
       LEFT JOIN product_categories pc ON pc.id = p.category_id
       LEFT JOIN suppliers s ON s.id = p.supplier_id
       WHERE p.active = 1 ORDER BY (p.stock <= p.min_stock) DESC, p.name COLLATE NOCASE`,
    );
    const units = rows.reduce((sum, row) => sum + Number(row.stock), 0);
    const cost = rows.reduce((sum, row) => sum + Number(row.stock) * Number(row.purchase_price), 0);
    const sale = rows.reduce((sum, row) => sum + Number(row.stock) * Number(row.sale_price), 0);
    const low = rows.filter((row) => Number(row.stock) <= Number(row.min_stock)).length;
    return {
      ...base,
      title: 'Stock disponible',
      summary: [
        { label: 'Productos', value: number(rows.length) },
        { label: 'Unidades en stock', value: number(units) },
        { label: 'Valor a costo', value: money(cost) },
        { label: 'Alertas de stock', value: number(low) },
      ],
      columns: [
        { key: 'producto', label: 'Producto', width: 2.1 },
        { key: 'sku', label: 'SKU', width: 1 },
        { key: 'categoria', label: 'Categoría', width: 1.3 },
        { key: 'stock', label: 'Stock', width: 0.7, align: 'right' },
        { key: 'minimo', label: 'Mínimo', width: 0.7, align: 'right' },
        { key: 'costo', label: 'Costo', width: 1, align: 'right' },
        { key: 'venta', label: 'Venta', width: 1, align: 'right' },
        { key: 'valor', label: 'Valor stock', width: 1.1, align: 'right' },
        { key: 'ubicacion', label: 'Ubicación', width: 1.1 },
      ],
      rows: rows.map((row) => ({
        producto: row.name,
        sku: row.sku || '—',
        categoria: row.category_name || 'Sin categoría',
        stock: number(row.stock),
        minimo: number(row.min_stock),
        costo: money(row.purchase_price),
        venta: money(row.sale_price),
        valor: money(Number(row.stock) * Number(row.purchase_price)),
        ubicacion: row.location || '—',
      })),
      note: `Valor de venta potencial del stock: ${money(sale)}. Generado como fotografía del inventario actual.`,
    };
  }

  if (kind === 'ganancias') {
    const delivered = all(
      `SELECT substr(o.delivered_at, 1, 7) AS month, COUNT(*) AS orders,
        COALESCE(SUM(${billableExpr}), 0) AS billed,
        COALESCE(SUM(${partsCostExpr}), 0) AS parts_cost,
        COALESCE(SUM(o.labor_cost), 0) AS labor_cost,
        COALESCE(SUM(${paidExpr}), 0) AS collected
       FROM orders o WHERE o.status = 'ENTREGADO' AND date(o.delivered_at) BETWEEN date(?) AND date(?)
       GROUP BY month ORDER BY month`,
      [from, to],
    );
    const cash = all(
      `SELECT substr(transaction_date, 1, 7) AS month,
        COALESCE(SUM(CASE WHEN type = 'INGRESO' THEN amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'EGRESO' THEN amount ELSE 0 END), 0) AS expenses
       FROM transactions WHERE deleted_at IS NULL AND date(transaction_date) BETWEEN date(?) AND date(?)
       GROUP BY month ORDER BY month`,
      [from, to],
    );
    const cashMap = Object.fromEntries(cash.map((row) => [row.month, row]));
    const rows = delivered.map((row) => {
      const cashRow = cashMap[row.month] || { income: 0, expenses: 0 };
      const profit = Number(row.billed) - Number(row.parts_cost) - Number(row.labor_cost);
      return {
        periodo: row.month,
        ordenes: number(row.orders),
        facturado: money(row.billed),
        cobrado: money(row.collected),
        costo_repuestos: money(row.parts_cost),
        mano_obra: money(row.labor_cost),
        ganancia_estimada: money(profit),
        caja: money(Number(cashRow.income) - Number(cashRow.expenses)),
      };
    });
    const totals = delivered.reduce(
      (accumulator, row) => {
        accumulator.billed += Number(row.billed);
        accumulator.parts += Number(row.parts_cost);
        accumulator.labor += Number(row.labor_cost);
        accumulator.collected += Number(row.collected);
        return accumulator;
      },
      { billed: 0, parts: 0, labor: 0, collected: 0 },
    );
    return {
      ...base,
      title: 'Ganancias y rentabilidad',
      summary: [
        { label: 'Facturación entregada', value: money(totals.billed) },
        { label: 'Costo de repuestos', value: money(totals.parts) },
        { label: 'Ganancia estimada', value: money(totals.billed - totals.parts - totals.labor) },
        { label: 'Cobrado', value: money(totals.collected) },
      ],
      columns: [
        { key: 'periodo', label: 'Período', width: 1 },
        { key: 'ordenes', label: 'Órdenes', width: 0.8, align: 'right' },
        { key: 'facturado', label: 'Facturado', width: 1.2, align: 'right' },
        { key: 'cobrado', label: 'Cobrado', width: 1.2, align: 'right' },
        { key: 'costo_repuestos', label: 'Costo repuestos', width: 1.2, align: 'right' },
        { key: 'mano_obra', label: 'Mano de obra', width: 1.1, align: 'right' },
        { key: 'ganancia_estimada', label: 'Ganancia estimada', width: 1.3, align: 'right' },
        { key: 'caja', label: 'Resultado caja', width: 1.2, align: 'right' },
      ],
      rows,
      note: 'Ganancia estimada = precio final − costo de repuestos − costo de mano de obra registrado. El resultado de caja es cobros menos gastos.',
    };
  }

  throw new Error(`Tipo de reporte desconocido: ${kind}`);
}

export function reportKinds() {
  return [
    { value: 'reparaciones', label: 'Reparaciones realizadas', description: 'Órdenes ingresadas en el período con estado, facturación y saldo.' },
    { value: 'pendientes', label: 'Reparaciones pendientes', description: 'Trabajos activos que todavía no fueron entregados.' },
    { value: 'entregados', label: 'Equipos entregados', description: 'Equipos entregados en el período seleccionado.' },
    { value: 'finanzas', label: 'Ingresos y egresos', description: 'Movimientos de caja con categoría y método de pago.' },
    { value: 'repuestos', label: 'Repuestos utilizados', description: 'Consumo de inventario aplicado a órdenes de reparación.' },
    { value: 'stock', label: 'Stock disponible', description: 'Fotografía actual del inventario y su valuación.' },
    { value: 'ganancias', label: 'Ganancias por período', description: 'Facturación, costos, ganancia estimada y caja.' },
  ];
}

export function round(value) {
  return roundMoney(value);
}
