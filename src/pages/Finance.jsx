import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Coins,
  CreditCard,
  Download,
  FileSpreadsheet,
  FileText,
  Info,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApiQuery, useDebounced, useDocumentTitle } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthProvider.jsx';
import { useUI } from '../context/UIProvider.jsx';
import { api, downloadFile } from '../lib/api.js';
import {
  daysAgoISO,
  formatDate,
  formatDateTime,
  formatMoney,
  monthStartISO,
  todayISO,
} from '../lib/format.js';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
} from '../lib/constants.js';
import {
  EmptyState,
  LoadingScreen,
  PageHeader,
  Pagination,
  StatCard,
  TableSkeleton,
  Tabs,
} from '../components/ui.jsx';
import Modal from '../components/Modal.jsx';

const EXPENSE_COLORS = ['#f43f5e', '#fb7185', '#f97316', '#f59e0b', '#eab308', '#a3a3a3', '#94a3b8', '#64748b'];
const INCOME_COLORS = ['#10b981', '#34d399', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1'];

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="mb-1 font-semibold text-slate-200">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="flex items-center justify-between gap-4 py-0.5 text-[11px]">
          <span className="flex items-center gap-1.5 text-slate-400"><span className="h-1.5 w-1.5 rounded-full" style={{ background: item.color }} />{item.name}</span>
          <span className="font-semibold text-slate-200">{formatMoney(item.value)}</span>
        </p>
      ))}
    </div>
  );
}

function TransactionModal({ open, onClose, type, categories, methods, onSaved }) {
  const { toast } = useUI();
  const [form, setForm] = useState({ type: type || 'EGRESO', category: '', description: '', amount: '', method: 'EFECTIVO', transaction_date: todayISO(), notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({
        type: type || 'EGRESO',
        category: type === 'INGRESO' ? 'Otros ingresos' : 'Gastos operativos',
        description: '',
        amount: '',
        method: 'EFECTIVO',
        transaction_date: todayISO(),
        notes: '',
      });
      setError('');
    }
  }, [open, type]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = await api.post('/finance/transactions', { ...form, amount: Number(form.amount) });
      toast.success(data.message);
      onSaved();
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const categoryOptions = type === 'INGRESO' || form.type === 'INGRESO'
    ? (categories?.income || INCOME_CATEGORIES)
    : (categories?.expense || EXPENSE_CATEGORIES);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrar movimiento"
      subtitle="Los ingresos directos y egresos se reflejan de inmediato en la caja."
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="transaction-form" className="btn-primary" disabled={saving}>{saving ? 'Registrando…' : 'Registrar movimiento'}</button>
        </div>
      }
    >
      <form id="transaction-form" onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div>}
        <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-white/[0.07] bg-ink-900/60 p-1">
          {[{ value: 'INGRESO', label: 'Ingreso', icon: TrendingUp }, { value: 'EGRESO', label: 'Egreso', icon: TrendingDown }].map((option) => (
            <button key={option.value} type="button" onClick={() => setForm({ ...form, type: option.value, category: option.value === 'INGRESO' ? 'Otros ingresos' : 'Gastos operativos' })} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${form.type === option.value ? option.value === 'INGRESO' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300' : 'text-slate-500 hover:text-slate-300'}`}><option.icon size={15} /> {option.label}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Categoría *</label><select className="select" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} required><option value="">Seleccionar…</option>{categoryOptions.map((category) => <option key={category} value={category}>{category}</option>)}</select></div>
          <div><label className="label">Importe *</label><input type="number" min="0.01" step="0.01" className="input" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></div>
          <div className="sm:col-span-2"><label className="label">Descripción *</label><input className="input" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required placeholder="Ej. Compra de repuestos a proveedor" /></div>
          <div><label className="label">Método</label><select className="select" value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>{PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></div>
          <div><label className="label">Fecha</label><input type="date" className="input" value={form.transaction_date} onChange={(event) => setForm({ ...form, transaction_date: event.target.value })} required /></div>
          <div className="sm:col-span-2"><label className="label">Notas</label><textarea className="textarea" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Opcional" /></div>
        </div>
        {form.type === 'INGRESO' && <p className="rounded-xl border border-sky-500/15 bg-sky-500/[0.04] p-3 text-[11px] leading-relaxed text-sky-200/70">Para cobrar una reparación usá el botón “Registrar pago” dentro de la orden, así se actualiza el saldo del cliente. Este formulario es para ingresos directos, como ventas de mostrador u otros ingresos.</p>}
      </form>
    </Modal>
  );
}

export default function Finance() {
  useDocumentTitle('Finanzas');
  const { isAdmin } = useAuth();
  const { toast, confirm } = useUI();
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [preset, setPreset] = useState('month');
  const [tab, setTab] = useState('movements');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 350);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [exporting, setExporting] = useState('');

  useEffect(() => {
    if (preset === 'month') { setFrom(monthStartISO()); setTo(todayISO()); }
    if (preset === '30') { setFrom(daysAgoISO(30)); setTo(todayISO()); }
    if (preset === '90') { setFrom(daysAgoISO(90)); setTo(todayISO()); }
    if (preset === 'year') { setFrom(`${new Date().getFullYear()}-01-01`); setTo(todayISO()); }
    setPage(1);
  }, [preset]);

  const rangeQuery = `from=${from}&to=${to}`;
  const { data: summaryData, loading: summaryLoading, refetch: refetchSummary } = useApiQuery(`/finance/summary?${rangeQuery}`);
  const { data: receivablesData, refetch: refetchReceivables } = useApiQuery('/finance/receivables');
  const transactionsQuery = `/finance/transactions?limit=15&page=${page}&${rangeQuery}${typeFilter ? `&type=${typeFilter}` : ''}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`;
  const { data: transactionsData, loading: transactionsLoading, refetch: refetchTransactions } = useApiQuery(transactionsQuery);

  const summary = summaryData?.summary;
  const series = summaryData?.series || [];
  const transactions = transactionsData?.transactions || [];

  const refreshAll = () => { refetchSummary(); refetchTransactions(); refetchReceivables(); };

  const deleteTransaction = async (transaction) => {
    const accepted = await confirm({ title: 'Anular movimiento', message: `Se anulará “${transaction.description}” por ${formatMoney(transaction.amount)}. El movimiento seguirá visible como anulado en el historial.`, confirmLabel: 'Anular movimiento' });
    if (!accepted) return;
    try {
      const response = await api.delete(`/finance/transactions/${transaction.id}`);
      toast.success(response.message);
      refreshAll();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const exportReport = async (format) => {
    setExporting(format);
    try {
      await downloadFile(`/reports/export?kind=finanzas&format=${format}&${rangeQuery}`, `finanzas-${from}-${to}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      toast.success(`Reporte ${format.toUpperCase()} descargado.`);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setExporting('');
    }
  };

  if (summaryLoading && !summaryData) return <LoadingScreen label="Calculando la situación financiera…" />;

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Administración"
        title="Finanzas y caja"
        subtitle="Diferenciá facturación, dinero cobrado, gastos y ganancia estimada. Cada pago de reparación actualiza el saldo."
        icon={Wallet}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => exportReport('pdf')} disabled={exporting === 'pdf'}><FileText size={16} /> <span className="hidden sm:inline">{exporting === 'pdf' ? 'Generando…' : 'PDF'}</span></button>
            <button type="button" className="btn-secondary" onClick={() => exportReport('xlsx')} disabled={exporting === 'xlsx'}><FileSpreadsheet size={16} /> <span className="hidden sm:inline">{exporting === 'xlsx' ? 'Generando…' : 'Excel'}</span></button>
            <button type="button" className="btn-primary" onClick={() => setModal({ type: 'transaction', transactionType: 'INGRESO' })}><Plus size={16} /> Movimiento</button>
          </>
        }
      />

      <div className="card mb-4 flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {[{ value: 'month', label: 'Este mes' }, { value: '30', label: '30 días' }, { value: '90', label: '90 días' }, { value: 'year', label: 'Este año' }, { value: 'custom', label: 'Personalizado' }].map((option) => (
            <button key={option.value} type="button" onClick={() => setPreset(option.value)} className={`rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${preset === option.value ? 'bg-tech-500/15 text-tech-300 ring-1 ring-inset ring-tech-500/20' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'}`}>{option.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays size={14} className="shrink-0 text-slate-500" />
          <input type="date" className="input min-h-[34px] w-auto py-1.5 text-xs" value={from} max={to} onChange={(event) => { setFrom(event.target.value); setPreset('custom'); setPage(1); }} />
          <span className="text-xs text-slate-600">a</span>
          <input type="date" className="input min-h-[34px] w-auto py-1.5 text-xs" value={to} min={from} onChange={(event) => { setTo(event.target.value); setPreset('custom'); setPage(1); }} />
          <button type="button" className="icon-btn h-8 w-8" onClick={refreshAll} title="Actualizar"><RefreshCw size={14} /></button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-6">
        <StatCard label="Facturación" value={formatMoney(summary.billing, { compact: true })} hint={`${summary.deliveredOrders} equipos entregados`} icon={Receipt} tone="violet" />
        <StatCard label="Cobrado" value={formatMoney(summary.collected, { compact: true })} hint="Dinero real ingresado" icon={TrendingUp} tone="emerald" />
        <StatCard label="Gastos" value={formatMoney(summary.expenses, { compact: true })} hint="Egresos del período" icon={TrendingDown} tone="rose" />
        <StatCard label="Resultado de caja" value={formatMoney(summary.cashResult, { compact: true })} hint="Cobrado − gastos" icon={Wallet} tone={summary.cashResult >= 0 ? 'blue' : 'rose'} />
        <StatCard label="Ganancia estimada" value={formatMoney(summary.estimatedProfit, { compact: true })} hint="Precio final − costos" icon={Coins} tone="cyan" />
        <StatCard label="Por cobrar" value={formatMoney(summary.receivables, { compact: true })} hint={`${summary.receivableOrders} órdenes con saldo`} icon={AlertTriangle} tone="amber" onClick={() => setTab('receivables')} />
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-xl border border-tech-500/15 bg-tech-500/[0.04] px-3.5 py-3">
        <Info size={15} className="mt-0.5 shrink-0 text-tech-400" />
        <p className="text-[11px] leading-relaxed text-slate-400">
          <span className="font-semibold text-slate-300">Facturación:</span> valor de reparaciones entregadas. <span className="font-semibold text-slate-300">Cobrado:</span> dinero que realmente ingresó. <span className="font-semibold text-slate-300">Ganancia estimada:</span> facturación menos costos de repuestos y mano de obra. Una seña no cuenta como pago total.
        </p>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="card overflow-hidden xl:col-span-2">
          <div className="border-b border-white/[0.06] px-4 py-4 sm:px-5">
            <h2 className="section-title">Flujo de caja</h2>
            <p className="mt-0.5 text-xs text-slate-500">Ingresos cobrados y egresos del período seleccionado</p>
          </div>
          <div className="h-[280px] w-full px-1 pb-3 pt-4 sm:px-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 10, right: 14, left: -4, bottom: 0 }}>
                <defs>
                  <linearGradient id="financeIncome" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.28} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                  <linearGradient id="financeExpense" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#f43f5e" stopOpacity={0.22} /><stop offset="100%" stopColor="#f43f5e" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                <XAxis dataKey="label" stroke="#475569" fontSize={10} tickLine={false} axisLine={false} dy={8} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(value / 1000)}k`} width={42} />
                <Tooltip content={<MoneyTooltip />} />
                <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#10b981" strokeWidth={2} fill="url(#financeIncome)" />
                <Area type="monotone" dataKey="gastos" name="Gastos" stroke="#f43f5e" strokeWidth={2} fill="url(#financeExpense)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-white/[0.06] px-4 py-4"><h2 className="section-title">Caja</h2><p className="mt-0.5 text-xs text-slate-500">Hoy y mes en curso</p></div>
          <div className="space-y-3 p-4">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Hoy · {formatDate(summaryData.cash.today.date)}</p>
              <div className="mt-2 flex items-end justify-between"><span className="text-[11px] text-slate-500">Resultado</span><span className={`text-xl font-bold ${summaryData.cash.today.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatMoney(summaryData.cash.today.balance)}</span></div>
              <div className="mt-2 flex justify-between text-[10px] text-slate-500"><span>Ingresos {formatMoney(summaryData.cash.today.income)}</span><span>Gastos {formatMoney(summaryData.cash.today.expenses)}</span></div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Mes en curso</p>
              <div className="mt-2 flex items-end justify-between"><span className="text-[11px] text-slate-500">Resultado</span><span className={`text-xl font-bold ${summaryData.cash.month.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatMoney(summaryData.cash.month.balance)}</span></div>
              <div className="mt-2 flex justify-between text-[10px] text-slate-500"><span>Ingresos {formatMoney(summaryData.cash.month.income)}</span><span>Gastos {formatMoney(summaryData.cash.month.expenses)}</span></div>
            </div>
            <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.05] p-3">
              <p className="flex items-center justify-between text-[11px] text-amber-200/80"><span>Saldo por cobrar</span><span className="font-bold text-amber-300">{formatMoney(summary.receivables)}</span></p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="card overflow-hidden">
          <div className="border-b border-white/[0.06] px-4 py-4"><h2 className="section-title">Ingresos por categoría</h2><p className="mt-0.5 text-xs text-slate-500">Distribución del dinero cobrado</p></div>
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
            <div className="h-[180px] w-full sm:w-[45%]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={summaryData.incomeByCategory} dataKey="total" nameKey="category" innerRadius={44} outerRadius={72} paddingAngle={2} stroke="none">{(summaryData.incomeByCategory || []).map((entry, index) => <Cell key={entry.category} fill={INCOME_COLORS[index % INCOME_COLORS.length]} />)}</Pie><Tooltip content={<MoneyTooltip />} /></PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-1.5">
              {(summaryData.incomeByCategory || []).slice(0, 5).map((item, index) => <div key={item.category} className="flex items-center justify-between gap-2 text-[11px]"><span className="flex min-w-0 items-center gap-1.5 text-slate-400"><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: INCOME_COLORS[index % INCOME_COLORS.length] }} /><span className="truncate">{item.category}</span></span><span className="font-semibold text-slate-200">{formatMoney(item.total, { compact: true })}</span></div>)}
              {!summaryData.incomeByCategory?.length && <p className="text-xs text-slate-500">Sin ingresos en el período.</p>}
            </div>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="border-b border-white/[0.06] px-4 py-4"><h2 className="section-title">Gastos por categoría</h2><p className="mt-0.5 text-xs text-slate-500">En qué se invirtió el dinero</p></div>
          <div className="space-y-2.5 p-4">
            {(summaryData.expenseByCategory || []).length === 0 ? <p className="text-xs text-slate-500">Sin gastos en el período.</p> : summaryData.expenseByCategory.slice(0, 6).map((item, index) => {
              const max = Math.max(...summaryData.expenseByCategory.map((entry) => entry.total), 1);
              return <div key={item.category}><div className="flex items-center justify-between gap-2 text-[11px]"><span className="truncate text-slate-400">{item.category}</span><span className="font-semibold text-slate-200">{formatMoney(item.total)}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.04]"><div className="h-full rounded-full" style={{ width: `${(item.total / max) * 100}%`, background: EXPENSE_COLORS[index % EXPENSE_COLORS.length] }} /></div></div>;
            })}
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Tabs
          tabs={[
            { value: 'movements', label: 'Movimientos', icon: Receipt, count: transactionsData?.total },
            { value: 'receivables', label: 'Cuentas por cobrar', icon: AlertTriangle, count: receivablesData?.count },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'movements' && (
        <div className="mt-3 card overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-white/[0.06] p-3 sm:flex-row sm:items-center sm:p-4">
            <div className="relative flex-1"><Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" /><input className="input min-h-[38px] py-2 pl-9 text-xs" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar descripción, orden o medio de pago…" /></div>
            <select className="select min-h-[38px] w-auto py-2 text-xs" value={typeFilter} onChange={(event) => { setTypeFilter(event.target.value); setPage(1); }}><option value="">Todos</option><option value="INGRESO">Ingresos</option><option value="EGRESO">Egresos</option></select>
            <button type="button" className="btn-primary btn-sm" onClick={() => setModal({ type: 'transaction', transactionType: 'INGRESO' })}><Plus size={14} /> Registrar</button>
          </div>
          {transactionsLoading ? <TableSkeleton rows={7} /> : transactions.length === 0 ? (
            <EmptyState icon={Receipt} title="Sin movimientos" description="No hay ingresos ni egresos en el período seleccionado." action={<button className="btn-primary" onClick={() => setModal({ type: 'transaction', transactionType: 'INGRESO' })}><Plus size={15} /> Registrar movimiento</button>} />
          ) : (
            <>
              <div className="table-wrapper hidden md:block">
                <table className="data-table min-w-[850px]">
                  <thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Método</th><th>Orden</th><th className="text-right">Importe</th>{isAdmin && <th />}</tr></thead>
                  <tbody>
                    {transactions.map((transaction) => (
                      <tr key={transaction.id} className={transaction.deleted_at ? 'opacity-50' : ''}>
                        <td className="whitespace-nowrap text-[10px] text-slate-500">{formatDate(transaction.transaction_date)}</td>
                        <td><p className="max-w-[260px] truncate text-xs font-medium text-slate-200">{transaction.description}</p><p className="mt-0.5 text-[10px] text-slate-500">{transaction.created_by_name || 'Sistema'}{transaction.first_name ? ` · ${transaction.first_name} ${transaction.last_name}` : ''}</p></td>
                        <td className="text-[11px] text-slate-400">{transaction.category}</td>
                        <td className="text-[11px] text-slate-400">{PAYMENT_METHOD_LABELS[transaction.method] || transaction.method}</td>
                        <td>{transaction.order_number ? <Link to={`/ordenes/${transaction.order_id}`} className="font-mono text-[10px] text-tech-400">{transaction.order_number}</Link> : <span className="text-[10px] text-slate-600">—</span>}</td>
                        <td className={`text-right text-xs font-semibold ${transaction.type === 'INGRESO' ? 'text-emerald-400' : 'text-rose-400'}`}>{transaction.type === 'INGRESO' ? '+' : '−'} {formatMoney(transaction.amount)}</td>
                        {isAdmin && <td>{!transaction.payment_id && !transaction.deleted_at && <button type="button" className="icon-btn h-8 w-8 hover:text-rose-400" onClick={() => deleteTransaction(transaction)} title="Anular"><Trash2 size={13} /></button>}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-white/[0.05] md:hidden">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className={`flex items-start gap-3 p-4 ${transaction.deleted_at ? 'opacity-50' : ''}`}>
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${transaction.type === 'INGRESO' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>{transaction.type === 'INGRESO' ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</div>
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-200">{transaction.description}</p><p className="mt-0.5 text-[10px] text-slate-500">{formatDate(transaction.transaction_date)} · {transaction.category} · {PAYMENT_METHOD_LABELS[transaction.method]}</p>{transaction.order_number && <Link to={`/ordenes/${transaction.order_id}`} className="mt-1 inline-block font-mono text-[9px] text-tech-400">{transaction.order_number}</Link>}</div>
                    <div className="text-right"><p className={`text-xs font-bold ${transaction.type === 'INGRESO' ? 'text-emerald-400' : 'text-rose-400'}`}>{transaction.type === 'INGRESO' ? '+' : '−'} {formatMoney(transaction.amount, { compact: true })}</p>{isAdmin && !transaction.payment_id && !transaction.deleted_at && <button type="button" className="mt-1 text-[9px] text-slate-500 hover:text-rose-400" onClick={() => deleteTransaction(transaction)}>Anular</button>}</div>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/[0.06] px-4 py-3"><Pagination page={transactionsData.page} totalPages={transactionsData.totalPages} total={transactionsData.total} onChange={setPage} /></div>
            </>
          )}
        </div>
      )}

      {tab === 'receivables' && (
        <div className="mt-3 card overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4"><div><h2 className="section-title">Cuentas por cobrar</h2><p className="mt-0.5 text-xs text-slate-500">{receivablesData?.count || 0} órdenes con saldo pendiente</p></div><span className="text-lg font-bold text-amber-300">{formatMoney(receivablesData?.total)}</span></div>
          {!receivablesData?.receivables?.length ? (
            <EmptyState icon={CheckCircle2} title="No hay deudas pendientes" description="Todas las órdenes activas están cobradas." />
          ) : (
            <>
              <div className="table-wrapper hidden md:block">
                <table className="data-table min-w-[850px]">
                  <thead><tr><th>Orden</th><th>Cliente</th><th>Equipo</th><th>Estado</th><th className="text-right">Facturado</th><th className="text-right">Cobrado</th><th className="text-right">Saldo</th><th /></tr></thead>
                  <tbody>
                    {receivablesData.receivables.map((order) => (
                      <tr key={order.id}>
                        <td><Link to={`/ordenes/${order.id}`} className="font-mono text-xs text-tech-400">{order.order_number}</Link></td>
                        <td><p className="text-xs text-slate-200">{order.client_name}</p><p className="text-[10px] text-slate-500">{order.phone}</p></td>
                        <td className="text-xs text-slate-400">{order.equipment_type_name}</td>
                        <td><span className="badge border-amber-500/20 bg-amber-500/10 text-amber-300">{order.status.replaceAll('_', ' ').toLowerCase()}</span></td>
                        <td className="text-right text-xs">{formatMoney(order.billable)}</td>
                        <td className="text-right text-xs text-emerald-400">{formatMoney(order.paid)}</td>
                        <td className="text-right text-xs font-bold text-amber-300">{formatMoney(order.balance)}</td>
                        <td><Link to={`/ordenes/${order.id}`} className="icon-btn h-8 w-8"><ChevronRight size={15} /></Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="divide-y divide-white/[0.05] md:hidden">
                {receivablesData.receivables.map((order) => (
                  <Link key={order.id} to={`/ordenes/${order.id}`} className="flex items-center gap-3 p-4">
                    <div className="min-w-0 flex-1"><p className="font-mono text-[10px] text-tech-400">{order.order_number}</p><p className="mt-1 truncate text-sm font-semibold text-slate-200">{order.client_name}</p><p className="truncate text-[10px] text-slate-500">{order.equipment_type_name} · {order.phone}</p></div>
                    <div className="text-right"><p className="text-xs font-bold text-amber-300">{formatMoney(order.balance)}</p><p className="text-[9px] text-slate-600">saldo</p></div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <TransactionModal
        open={modal?.type === 'transaction'}
        onClose={() => setModal(null)}
        type={modal?.transactionType}
        categories={summaryData?.categories}
        methods={summaryData?.paymentMethods}
        onSaved={refreshAll}
      />
    </div>
  );
}
