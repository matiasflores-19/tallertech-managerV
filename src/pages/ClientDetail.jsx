import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  ClipboardList,
  CreditCard,
  Mail,
  MapPin,
  NotebookText,
  Pencil,
  Phone,
  Plus,
  Receipt,
  UserRound,
  Wallet,
} from 'lucide-react';
import { useApiQuery, useDocumentTitle } from '../hooks/useApi.js';
import { formatDate, formatDateTime, formatMoney } from '../lib/format.js';
import { ClientModal } from './Clients.jsx';
import {
  Avatar,
  EmptyState,
  LoadingScreen,
  PageHeader,
  StatCard,
  StatusBadge,
} from '../components/ui.jsx';

export default function ClientDetail() {
  const { id } = useParams();
  const { data, loading, error, refetch } = useApiQuery(`/clients/${id}`);
  const [editOpen, setEditOpen] = useState(false);

  useDocumentTitle(data ? `${data.client.first_name} ${data.client.last_name}` : 'Cliente');

  if (loading && !data) return <LoadingScreen label="Cargando ficha del cliente…" />;
  if (error && !data) {
    return <EmptyState icon={AlertTriangle} title="No se pudo cargar el cliente" description={error.message} action={<button className="btn-primary" onClick={refetch}>Reintentar</button>} />;
  }

  const { client, orders, payments, stats } = data;

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Ficha de cliente"
        title={`${client.first_name} ${client.last_name}`}
        subtitle={client.dni ? `DNI ${client.dni} · Cliente desde ${formatDate(client.created_at)}` : `Cliente desde ${formatDate(client.created_at)}`}
        backTo="/clientes"
        icon={UserRound}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditOpen(true)}><Pencil size={16} /> Editar</button>
            <Link to={`/ordenes/nueva?client_id=${client.id}`} className="btn-primary"><Plus size={16} /> Nuevo ingreso</Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <StatCard label="Órdenes totales" value={stats.orders_count} icon={ClipboardList} tone="blue" />
        <StatCard label="Trabajos activos" value={stats.active_orders} icon={NotebookText} tone="amber" />
        <StatCard label="Facturado" value={formatMoney(stats.billed, { compact: true })} icon={Receipt} tone="violet" hint={`Cobrado ${formatMoney(stats.paid, { compact: true })}`} />
        <StatCard label="Saldo pendiente" value={formatMoney(stats.debt, { compact: true })} icon={Wallet} tone={stats.debt > 0 ? 'rose' : 'emerald'} hint={stats.debt > 0 ? 'Requiere seguimiento' : 'Sin deudas pendientes'} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <div className="card">
            <div className="flex flex-col items-center p-5 text-center">
              <Avatar firstName={client.first_name} lastName={client.last_name} size="lg" className="h-16 w-16 text-xl" />
              <h2 className="mt-3 text-lg font-bold text-white">{client.first_name} {client.last_name}</h2>
              <p className="text-xs text-slate-500">{client.email || 'Sin correo registrado'}</p>
              <div className="mt-4 flex w-full flex-col gap-2 text-left">
                <a href={`tel:${client.phone}`} className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs text-slate-300 transition hover:border-white/10 hover:bg-white/[0.04]"><Phone size={14} className="text-tech-400" /> {client.phone}</a>
                {client.email && <a href={`mailto:${client.email}`} className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs text-slate-300 transition hover:border-white/10 hover:bg-white/[0.04]"><Mail size={14} className="text-tech-400" /> <span className="truncate">{client.email}</span></a>}
                {client.address && <p className="flex items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-xs text-slate-400"><MapPin size={14} className="mt-0.5 shrink-0 text-slate-500" /> {client.address}</p>}
              </div>
            </div>
            {client.notes && <div className="border-t border-white/[0.06] p-4"><p className="eyebrow mb-1">Observaciones</p><p className="text-xs leading-relaxed text-slate-400">{client.notes}</p></div>}
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3.5"><h2 className="text-sm font-semibold text-slate-100">Últimos pagos</h2><Link to="/finanzas" className="text-[11px] font-semibold text-tech-400">Finanzas</Link></div>
            {payments.length === 0 ? (
              <p className="p-4 text-xs text-slate-500">Sin pagos registrados.</p>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {payments.slice(0, 6).map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div><p className="font-mono text-[10px] text-tech-400">{payment.order_number}</p><p className="mt-0.5 text-[10px] text-slate-500">{formatDateTime(payment.received_at)}</p></div>
                    <div className="text-right"><p className="text-xs font-semibold text-emerald-400">{formatMoney(payment.amount)}</p><p className="text-[9px] uppercase tracking-wider text-slate-600">{payment.method}</p></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-4 sm:px-5">
              <div><h2 className="text-sm font-semibold text-slate-100">Equipos y reparaciones</h2><p className="mt-0.5 text-xs text-slate-500">{orders.length} órdenes registradas</p></div>
              <Link to={`/ordenes/nueva?client_id=${client.id}`} className="btn-secondary btn-sm"><Plus size={13} /> Ingreso</Link>
            </div>
            {orders.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Sin órdenes registradas" description="Cuando ingrese un equipo de este cliente aparecerá aquí." action={<Link to={`/ordenes/nueva?client_id=${client.id}`} className="btn-primary btn-sm">Registrar ingreso</Link>} />
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {orders.map((order) => (
                  <Link key={order.id} to={`/ordenes/${order.id}`} className="block p-4 transition hover:bg-white/[0.025] sm:px-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[11px] font-semibold text-tech-400">{order.order_number}</span>
                          <StatusBadge status={order.status} />
                        </div>
                        <p className="mt-1.5 text-sm font-medium text-slate-200">{order.brand} {order.model}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">{order.equipment_type_name} · Ingreso {formatDate(order.intake_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-200">{formatMoney(order.billable)}</p>
                        <p className={`mt-0.5 text-[10px] ${order.balance > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>{order.balance > 0 ? `Saldo ${formatMoney(order.balance)}` : 'Pagado'}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-600">
                      <span className="flex items-center gap-1"><CalendarDays size={11} /> {order.delivered_at ? `Entregado ${formatDate(order.delivered_at)}` : order.estimated_delivery ? `Entrega estimada ${formatDate(order.estimated_delivery)}` : 'Sin fecha estimada'}</span>
                      <span className="flex items-center gap-1 font-semibold text-tech-500">Ver orden <ArrowUpRight size={11} /></span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="card p-4 sm:p-5">
            <div className="flex items-center gap-2"><CreditCard size={16} className="text-slate-500" /><h2 className="text-sm font-semibold text-slate-100">Resumen de cuenta</h2></div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-white/[0.025] p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Total facturado</p><p className="mt-1 text-lg font-bold text-white">{formatMoney(stats.billed)}</p></div>
              <div className="rounded-xl bg-emerald-500/[0.05] p-3"><p className="text-[10px] uppercase tracking-wider text-emerald-500/80">Pagos realizados</p><p className="mt-1 text-lg font-bold text-emerald-300">{formatMoney(stats.paid)}</p></div>
              <div className="rounded-xl bg-amber-500/[0.05] p-3"><p className="text-[10px] uppercase tracking-wider text-amber-500/80">Deuda pendiente</p><p className="mt-1 text-lg font-bold text-amber-300">{formatMoney(stats.debt)}</p></div>
            </div>
          </div>
        </div>
      </div>

      <ClientModal open={editOpen} onClose={() => setEditOpen(false)} client={client} onSaved={refetch} />
    </div>
  );
}
