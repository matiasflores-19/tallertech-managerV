import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Clock3,
  DollarSign,
  PackageSearch,
  Plus,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
  Wrench,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApiQuery, useDocumentTitle } from '../hooks/useApi.js';
import { formatDate, formatMoney, formatNumber, relativeTime } from '../lib/format.js';
import { STATUS_META } from '../lib/constants.js';
import { EmptyState, LoadingScreen, PageHeader, StatCard, StatusBadge } from '../components/ui.jsx';

const STATUS_COLORS = {
  RECIBIDO: '#64748b',
  PENDIENTE_DIAGNOSTICO: '#f59e0b',
  EN_DIAGNOSTICO: '#0ea5e9',
  PRESUPUESTADO: '#6366f1',
  ESPERANDO_APROBACION: '#8b5cf6',
  ESPERANDO_REPUESTOS: '#f97316',
  EN_REPARACION: '#3b82f6',
  EN_PRUEBAS: '#06b6d4',
  REPARADO: '#10b981',
  LISTO_PARA_RETIRAR: '#22c55e',
  ENTREGADO: '#14b8a6',
  SIN_REPARACION: '#f43f5e',
  CANCELADO: '#ef4444',
};

function MoneyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="mb-1 font-semibold text-slate-200">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="flex items-center justify-between gap-4 py-0.5 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.name}
          </span>
          <span className="font-semibold text-slate-200">{formatMoney(item.value)}</span>
        </p>
      ))}
    </div>
  );
}

function CountTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <p className="mb-1 font-semibold text-slate-200">{label}</p>
      {payload.map((item) => (
        <p key={item.dataKey} className="flex items-center gap-2 py-0.5 text-[11px] text-slate-400">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: item.color }} />
          {item.name}: <span className="font-semibold text-slate-200">{item.value}</span>
        </p>
      ))}
    </div>
  );
}

function ChartCard({ title, subtitle, badge, children, className = '', action }) {
  return (
    <div className={`card overflow-hidden ${className}`}>
      <div className="flex items-start justify-between gap-3 px-4 pb-1 pt-4 sm:px-5 sm:pt-5">
        <div>
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {badge && <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold text-slate-400">{badge}</span>}
        {action}
      </div>
      {children}
    </div>
  );
}

const ACTIVITY_ICONS = {
  ORDER_CREATE: ClipboardList,
  ORDER_STATUS: RefreshCw,
  PAYMENT_CREATE: Wallet,
  CLIENT_CREATE: Plus,
  INVENTORY_MOVEMENT: Boxes,
  BACKUP_CREATE: PackageSearch,
  USER_CREATE: Plus,
  LOGIN: CheckCircle2,
};

export default function Dashboard() {
  useDocumentTitle('Panel general');
  const { data, loading, error, refetch } = useApiQuery('/dashboard');

  if (loading && !data) return <LoadingScreen label="Preparando el panel del taller…" />;
  if (error && !data) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No se pudo cargar el panel"
        description={error.message}
        action={<button className="btn-primary" onClick={refetch}>Reintentar</button>}
      />
    );
  }

  const stats = data.stats;
  const chart = data.chart;
  const statusData = data.statusDistribution.map((item) => ({
    name: STATUS_META[item.status]?.label || item.status,
    value: item.count,
    status: item.status,
    color: STATUS_COLORS[item.status] || '#64748b',
  }));
  const totalStatus = statusData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Vista general"
        title="Panel de control"
        subtitle="El estado completo del taller, la caja del mes y las reparaciones que necesitan atención."
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={refetch} title="Actualizar datos">
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Actualizar</span>
            </button>
            <Link to="/recepcion" className="btn-primary">
              <Zap size={17} /> Recepción rápida
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-5">
        <StatCard label="Equipos ingresados" value={formatNumber(stats.totalEquipment)} hint="Historial total del taller" icon={ClipboardList} tone="blue" to="/ordenes" />
        <StatCard label="Pend. diagnóstico" value={formatNumber(stats.pendingDiagnosis)} hint="Esperan revisión técnica" icon={Clock3} tone="amber" to="/ordenes?status=RECIBIDO,PENDIENTE_DIAGNOSTICO" />
        <StatCard label="En reparación" value={formatNumber(stats.inRepair)} hint="Trabajo técnico activo" icon={Wrench} tone="cyan" to="/ordenes?status=EN_REPARACION" />
        <StatCard label="Esperando repuestos" value={formatNumber(stats.waitingParts)} hint="Dependen de un proveedor" icon={PackageSearch} tone="violet" to="/ordenes?status=ESPERANDO_REPUESTOS" />
        <StatCard label="Listos para entregar" value={formatNumber(stats.readyToDeliver)} hint="Reparados y avisados" icon={CheckCircle2} tone="emerald" to="/ordenes?status=REPARADO,LISTO_PARA_RETIRAR" />
        <StatCard label="Entregados" value={formatNumber(stats.delivered)} hint="Equipos ya retirados" icon={Truck} tone="teal" to="/ordenes?status=ENTREGADO" />
        <StatCard label="Ingresos del mes" value={formatMoney(stats.incomeMonth, { compact: true })} hint="Dinero efectivamente cobrado" icon={TrendingUp} tone="emerald" to="/finanzas" />
        <StatCard label="Gastos del mes" value={formatMoney(stats.expensesMonth, { compact: true })} hint="Egresos registrados" icon={TrendingDown} tone="rose" to="/finanzas" />
        <StatCard label="Ganancia neta" value={formatMoney(stats.netProfit, { compact: true })} hint={`Facturado ${formatMoney(stats.billingMonth, { compact: true })}`} icon={DollarSign} tone={stats.netProfit >= 0 ? 'blue' : 'rose'} to="/finanzas" />
        <StatCard label="Reparaciones pendientes" value={formatNumber(stats.pendingRepairs)} hint="Todas las órdenes activas" icon={AlertTriangle} tone="amber" to="/reparaciones" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Ingresos, gastos y resultado"
          subtitle="Cobros y egresos de los últimos 6 meses"
          badge={data.period.from?.slice(0, 7) === data.period.to?.slice(0, 7) ? 'Mes actual' : '6 meses'}
        >
          <div className="h-[290px] w-full px-1 pb-3 pt-4 sm:px-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 10, right: 12, left: -3, bottom: 0 }}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.22} />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                <XAxis dataKey="month" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} dy={8} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round(value / 1000)}k`} width={42} />
                <Tooltip content={<MoneyTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }} iconType="circle" iconSize={7} />
                <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#10b981" strokeWidth={2.2} fill="url(#incomeGradient)" />
                <Area type="monotone" dataKey="gastos" name="Gastos" stroke="#f43f5e" strokeWidth={2} fill="url(#expenseGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Estado de las órdenes" subtitle={`${formatNumber(totalStatus)} órdenes registradas`} badge="Distribución">
          <div className="flex h-[290px] flex-col">
            <div className="relative min-h-0 flex-1 px-2 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={90} paddingAngle={2} stroke="none">
                    {statusData.map((entry) => (
                      <Cell key={entry.status} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CountTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white">{formatNumber(totalStatus)}</span>
                <span className="text-[10px] uppercase tracking-wider text-slate-500">órdenes</span>
              </div>
            </div>
            <div className="max-h-[88px] overflow-y-auto px-4 pb-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {[...statusData].sort((a, b) => b.value - a.value).slice(0, 8).map((item) => (
                  <div key={item.status} className="flex items-center justify-between gap-2 text-[10px] text-slate-500">
                    <span className="flex min-w-0 items-center gap-1.5 truncate">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: item.color }} />
                      <span className="truncate">{item.name}</span>
                    </span>
                    <span className="font-semibold text-slate-300">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Reparaciones por mes"
          subtitle="Equipos ingresados versus equipos entregados"
          badge="Últimos 6 meses"
        >
          <div className="h-[250px] w-full px-1 pb-3 pt-4 sm:px-3">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} margin={{ top: 5, right: 12, left: -12, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.08)" vertical={false} />
                <XAxis dataKey="month" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} dy={8} />
                <YAxis stroke="#475569" fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip content={<CountTooltip />} cursor={{ fill: 'rgba(148,163,184,0.05)' }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }} iconType="circle" iconSize={7} />
                <Bar dataKey="reparaciones" name="Ingresos" fill="#339bff" radius={[5, 5, 0, 0]} maxBarSize={30} />
                <Bar dataKey="entregados" name="Entregados" fill="#14b8a6" radius={[5, 5, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard
          title="Stock bajo"
          subtitle={`${stats.lowStockCount} productos requieren reposición`}
          action={<Link to="/inventario" className="text-[11px] font-semibold text-tech-400 hover:text-tech-300">Ver todo</Link>}
        >
          <div className="px-4 pb-4 pt-2">
            {data.lowStock.length === 0 ? (
              <EmptyState icon={Boxes} title="Stock saludable" description="No hay productos por debajo del mínimo." className="!py-8" />
            ) : (
              <div className="space-y-2">
                {data.lowStock.slice(0, 5).map((product) => (
                  <Link
                    key={product.id}
                    to={`/inventario?search=${encodeURIComponent(product.name)}`}
                    className="flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5 transition hover:border-white/10 hover:bg-white/[0.045]"
                  >
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${product.stock <= 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'}`}>
                      <Boxes size={15} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-200">{product.name}</p>
                      <p className="truncate text-[10px] text-slate-500">{product.category_name || 'Sin categoría'} · mínimo {product.min_stock}</p>
                    </div>
                    <span className={`badge ${product.stock <= 0 ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300'}`}>
                      {product.stock} u.
                    </span>
                  </Link>
                ))}
                <Link to="/inventario?lowStock=1" className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 py-2.5 text-[11px] font-semibold text-slate-500 transition hover:border-tech-500/30 hover:text-tech-300">
                  Ver los {stats.lowStockCount} productos con alerta <ArrowUpRight size={12} />
                </Link>
              </div>
            )}
          </div>
        </ChartCard>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="card overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-4 sm:px-5">
            <div>
              <h2 className="section-title">Últimas reparaciones</h2>
              <p className="mt-0.5 text-xs text-slate-500">Ingresos más recientes al taller</p>
            </div>
            <Link to="/ordenes" className="btn-secondary btn-sm">
              Ver órdenes <ArrowUpRight size={13} />
            </Link>
          </div>

          <div className="hidden md:block">
            <table className="data-table min-w-0">
              <thead>
                <tr>
                  <th>Orden / Cliente</th>
                  <th>Equipo</th>
                  <th>Estado</th>
                  <th>Ingreso</th>
                  <th className="text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {data.recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link to={`/ordenes/${order.id}`} className="font-mono text-xs font-semibold text-tech-400 hover:text-tech-300">
                        {order.order_number}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-400">{order.client_name}</p>
                    </td>
                    <td>
                      <p className="text-xs text-slate-200">{order.brand} {order.model}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">{order.equipment_type_name}</p>
                    </td>
                    <td><StatusBadge status={order.status} /></td>
                    <td className="whitespace-nowrap text-xs">{formatDate(order.created_at)}</td>
                    <td className={`whitespace-nowrap text-right text-xs font-semibold ${order.balance > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>
                      {formatMoney(order.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-white/[0.05] md:hidden">
            {data.recentOrders.slice(0, 6).map((order) => (
              <Link key={order.id} to={`/ordenes/${order.id}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.025]">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-slate-400">
                  <Wrench size={15} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[11px] font-semibold text-tech-400">{order.order_number}</p>
                    <span className="text-[10px] text-slate-500">{formatDate(order.created_at)}</span>
                  </div>
                  <p className="mt-0.5 truncate text-xs font-medium text-slate-200">{order.client_name} · {order.brand} {order.model}</p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <StatusBadge status={order.status} />
                    <span className={`text-[11px] font-semibold ${order.balance > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>
                      {formatMoney(order.balance)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-white/[0.06] px-4 py-4 sm:px-5">
            <h2 className="section-title">Actividad reciente</h2>
            <p className="mt-0.5 text-xs text-slate-500">Movimientos registrados en el sistema</p>
          </div>
          <div className="p-4">
            <div className="relative space-y-4 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-white/[0.06]">
              {data.recentActivity.map((activity) => {
                const Icon = ACTIVITY_ICONS[activity.action] || CheckCircle2;
                return (
                  <div key={activity.id} className="relative flex gap-3">
                    <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-ink-850 text-slate-500">
                      <Icon size={14} />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-xs leading-snug text-slate-300">{activity.description}</p>
                      <p className="mt-0.5 text-[10px] text-slate-600">{activity.username || 'Sistema'} · {relativeTime(activity.created_at)}</p>
                    </div>
                  </div>
                );
              })}
              {data.recentActivity.length === 0 && <p className="text-xs text-slate-500">Todavía no hay actividad registrada.</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
