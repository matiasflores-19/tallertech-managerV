import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  PackageSearch,
  Plus,
  Search,
  Wrench,
} from 'lucide-react';
import { useApiQuery, useDocumentTitle } from '../hooks/useApi.js';
import { formatDate, formatMoney } from '../lib/format.js';
import { PriorityBadge, StatusBadge, EmptyState, PageHeader } from '../components/ui.jsx';

const COLUMNS = [
  { key: 'recepcion', title: 'Recepción y diagnóstico', statuses: ['RECIBIDO', 'PENDIENTE_DIAGNOSTICO', 'EN_DIAGNOSTICO'], icon: ClipboardList, color: 'text-sky-400', border: 'border-sky-500/20' },
  { key: 'presupuesto', title: 'Presupuesto', statuses: ['PRESUPUESTADO', 'ESPERANDO_APROBACION'], icon: Clock3, color: 'text-violet-400', border: 'border-violet-500/20' },
  { key: 'espera', title: 'Esperando repuestos', statuses: ['ESPERANDO_REPUESTOS'], icon: PackageSearch, color: 'text-orange-400', border: 'border-orange-500/20' },
  { key: 'reparacion', title: 'En reparación / pruebas', statuses: ['EN_REPARACION', 'EN_PRUEBAS'], icon: Wrench, color: 'text-tech-400', border: 'border-tech-500/20' },
  { key: 'listo', title: 'Listos para entregar', statuses: ['REPARADO', 'LISTO_PARA_RETIRAR'], icon: CheckCircle2, color: 'text-emerald-400', border: 'border-emerald-500/20' },
];

export default function Repairs() {
  useDocumentTitle('Tablero de taller');
  const { data, loading, refetch } = useApiQuery('/orders?active=1&limit=200&sort=priority');
  const { data: statsData } = useApiQuery('/orders/stats');
  const [search, setSearch] = useState('');
  const [technician, setTechnician] = useState('');
  const orders = data?.orders || [];

  const technicians = useMemo(() => {
    const unique = new Map();
    for (const order of orders) if (order.technician_id) unique.set(order.technician_id, order.technician_name);
    return [...unique.entries()].map(([id, name]) => ({ id, name }));
  }, [orders]);

  const filtered = orders.filter((order) => {
    if (technician && String(order.technician_id) !== technician) return false;
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return `${order.order_number} ${order.client_name} ${order.brand} ${order.model} ${order.equipment_type_name} ${order.client_phone}`.toLowerCase().includes(term);
  });

  const counts = statsData?.counts || {};
  const activeCount = orders.length;
  const urgent = orders.filter((order) => order.priority === 'URGENTE' || (order.estimated_delivery && new Date(order.estimated_delivery) < new Date() && !['ENTREGADO', 'CANCELADO'].includes(order.status))).length;

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Taller en vivo"
        title="Tablero de reparaciones"
        subtitle="Visualizá el flujo de trabajo por etapas y detectá rápidamente qué equipos requieren atención."
        icon={Wrench}
        actions={<Link to="/ordenes/nueva" className="btn-primary"><Plus size={17} /> Nuevo ingreso</Link>}
      />

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="card p-3.5"><p className="text-[10px] uppercase tracking-wider text-slate-500">Órdenes activas</p><p className="mt-1 text-xl font-bold text-white">{activeCount}</p></div>
        <div className="card p-3.5"><p className="text-[10px] uppercase tracking-wider text-slate-500">En reparación</p><p className="mt-1 text-xl font-bold text-tech-300">{counts.EN_REPARACION || 0}</p></div>
        <div className="card p-3.5"><p className="text-[10px] uppercase tracking-wider text-slate-500">Listos para retirar</p><p className="mt-1 text-xl font-bold text-emerald-300">{(counts.REPARADO || 0) + (counts.LISTO_PARA_RETIRAR || 0)}</p></div>
        <div className="card p-3.5"><p className="text-[10px] uppercase tracking-wider text-slate-500">Atención prioritaria</p><p className="mt-1 text-xl font-bold text-amber-300">{urgent}</p></div>
      </div>

      <div className="card mb-4 flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar orden, cliente, equipo o teléfono…" />
        </div>
        <select className="select sm:w-[220px]" value={technician} onChange={(event) => setTechnician(event.target.value)}>
          <option value="">Todos los técnicos</option>
          {technicians.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <button type="button" className="btn-secondary btn-sm" onClick={refetch}>Actualizar</button>
      </div>

      {loading && !data ? (
        <div className="flex gap-3 overflow-hidden">{[0, 1, 2, 3, 4].map((index) => <div key={index} className="min-w-[240px] flex-1 space-y-2"><div className="skeleton h-10 w-full" /><div className="skeleton h-28 w-full" /><div className="skeleton h-28 w-full" /></div>)}</div>
      ) : filtered.length === 0 ? (
        <div className="card"><EmptyState icon={Wrench} title="No hay reparaciones activas" description="Todas las órdenes fueron entregadas o no coinciden con el filtro." action={<Link to="/ordenes/nueva" className="btn-primary"><Plus size={15} /> Registrar ingreso</Link>} /></div>
      ) : (
        <div className="no-scrollbar -mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-3 sm:-mx-5 sm:px-5 lg:mx-0 lg:px-0">
          {COLUMNS.map((column) => {
            const items = filtered.filter((order) => column.statuses.includes(order.status));
            return (
              <div key={column.key} className="min-w-[calc(100vw-2.5rem)] snap-start sm:min-w-[300px] lg:min-w-0 lg:flex-1">
                <div className="mb-2 flex items-center justify-between px-0.5">
                  <div className="flex items-center gap-2">
                    <column.icon size={15} className={column.color} />
                    <h2 className="text-xs font-semibold text-slate-200">{column.title}</h2>
                    <span className="rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{items.length}</span>
                  </div>
                </div>
                <div className={`min-h-[200px] space-y-2 rounded-2xl border border-white/[0.05] bg-white/[0.015] p-2 ${column.border}`}>
                  {items.length === 0 ? (
                    <div className="flex h-28 flex-col items-center justify-center gap-1 text-center text-[11px] text-slate-600"><CheckCircle2 size={20} className="opacity-40" />Sin equipos en esta etapa</div>
                  ) : (
                    items.map((order) => {
                      const overdue = order.estimated_delivery && new Date(order.estimated_delivery) < new Date();
                      return (
                        <Link key={order.id} to={`/ordenes/${order.id}`} className="group block rounded-xl border border-white/[0.07] bg-ink-850 p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-tech-500/30 hover:shadow-glow">
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-mono text-[10px] font-semibold text-tech-400">{order.order_number}</span>
                            <PriorityBadge priority={order.priority} />
                          </div>
                          <p className="mt-2 text-xs font-semibold leading-snug text-slate-100">{order.brand} {order.model}</p>
                          <p className="mt-0.5 text-[10px] text-slate-500">{order.equipment_type_name}</p>
                          <p className="mt-2 truncate text-[10px] text-slate-300">{order.client_name}</p>
                          <p className="mt-0.5 truncate text-[9px] text-slate-600">{order.technician_name || 'Sin técnico'}</p>
                          <div className="mt-2 flex items-center justify-between gap-2 border-t border-white/[0.05] pt-2">
                            <StatusBadge status={order.status} dot={false} className="!px-1.5 !py-0.5 !text-[9px]" />
                            <span className={order.balance > 0 ? 'text-[9px] font-semibold text-amber-400' : 'text-[9px] font-semibold text-emerald-500'}>{formatMoney(order.balance, { compact: true })}</span>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-[9px] text-slate-600">
                            <span className={overdue ? 'text-amber-400' : ''}>{overdue ? <span className="inline-flex items-center gap-1"><AlertTriangle size={10} /> Vencida</span> : `Ingreso ${formatDate(order.intake_at)}`}</span>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
