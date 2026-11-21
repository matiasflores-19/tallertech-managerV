import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ChevronRight,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react';
import { useApiQuery, useDebounced, useDocumentTitle } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthProvider.jsx';
import { useUI } from '../context/UIProvider.jsx';
import { api } from '../lib/api.js';
import { formatDate, formatMoney } from '../lib/format.js';
import { Avatar, EmptyState, PageHeader, Pagination, TableSkeleton } from '../components/ui.jsx';
import Modal from '../components/Modal.jsx';

const EMPTY = { first_name: '', last_name: '', phone: '', email: '', dni: '', address: '', notes: '' };

export function ClientModal({ open, onClose, client, onSaved }) {
  const { toast } = useUI();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (open) {
      setForm(client ? {
        first_name: client.first_name || '',
        last_name: client.last_name || '',
        phone: client.phone || '',
        email: client.email || '',
        dni: client.dni || '',
        address: client.address || '',
        notes: client.notes || '',
      } : EMPTY);
      setError('');
      setFieldErrors({});
    }
  }, [open, client]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    setSaving(true);
    try {
      const data = client
        ? await api.patch(`/clients/${client.id}`, form)
        : await api.post('/clients', form);
      toast.success(data.message);
      onSaved();
      onClose();
    } catch (requestError) {
      setError(requestError.message);
      if (Array.isArray(requestError.details)) {
        setFieldErrors(Object.fromEntries(requestError.details.map((detail) => [detail.field, detail.message])));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={client ? 'Editar cliente' : 'Nuevo cliente'}
      subtitle={client ? 'Actualizá los datos de contacto del cliente.' : 'Registrá los datos básicos. Podés completar el resto luego.'}
      size="md"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="client-form" className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : client ? 'Guardar cambios' : 'Registrar cliente'}</button>
        </div>
      }
    >
      <form id="client-form" onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Nombre *</label><input className="input" value={form.first_name} onChange={(event) => setForm({ ...form, first_name: event.target.value })} required /></div>
          <div><label className="label">Apellido *</label><input className="input" value={form.last_name} onChange={(event) => setForm({ ...form, last_name: event.target.value })} required /></div>
          <div><label className="label">Teléfono *</label><input className="input" type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required /></div>
          <div><label className="label">Correo electrónico</label><input className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
          <div><label className="label">DNI</label><input className="input" value={form.dni} onChange={(event) => setForm({ ...form, dni: event.target.value })} /></div>
          <div><label className="label">Dirección</label><input className="input" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></div>
        </div>
        <div><label className="label">Observaciones</label><textarea className="textarea" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Preferencias de contacto, datos útiles…" /></div>
      </form>
    </Modal>
  );
}

export default function Clients() {
  useDocumentTitle('Clientes');
  const { isAdmin } = useAuth();
  const { toast, confirm } = useUI();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounced(search, 350);
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const query = `/clients?limit=15&page=${page}${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`;
  const { data, loading, refetch } = useApiQuery(query);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const removeClient = async (client) => {
    const accepted = await confirm({
      title: 'Eliminar cliente',
      message: `Se eliminará a ${client.first_name} ${client.last_name}. Solo es posible si no tiene órdenes asociadas.`,
      confirmLabel: 'Eliminar cliente',
    });
    if (!accepted) return;
    try {
      const response = await api.delete(`/clients/${client.id}`);
      toast.success(response.message);
      refetch();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Base de datos"
        title="Clientes"
        subtitle="Historial de equipos, deudas y pagos de cada cliente del taller."
        icon={Users}
        actions={<button type="button" className="btn-primary" onClick={() => setModal({ type: 'new' })}><Plus size={17} /> Nuevo cliente</button>}
      />

      <div className="card mb-4 flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="input pl-10"
            placeholder="Buscar por nombre, teléfono, correo o DNI…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <span className="hidden rounded-lg bg-white/[0.03] px-3 py-2 text-xs text-slate-500 sm:block">
          {data?.total ?? '—'} clientes
        </span>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <TableSkeleton rows={7} />
        ) : !data?.clients?.length ? (
          <EmptyState
            icon={UserRound}
            title={debouncedSearch ? 'Sin resultados' : 'Todavía no hay clientes'}
            description={debouncedSearch ? 'Probá con otro nombre, teléfono o DNI.' : 'Registrá el primer cliente o creá uno desde el ingreso de un equipo.'}
            action={!debouncedSearch && <button type="button" className="btn-primary" onClick={() => setModal({ type: 'new' })}><Plus size={15} /> Nuevo cliente</button>}
          />
        ) : (
          <>
            <div className="table-wrapper hidden md:block">
              <table className="data-table min-w-[850px]">
                <thead><tr><th>Cliente</th><th>Contacto</th><th className="text-center">Órdenes</th><th className="text-right">Facturado</th><th className="text-right">Saldo</th><th>Última visita</th><th className="w-20" /></tr></thead>
                <tbody>
                  {data.clients.map((client) => (
                    <tr key={client.id}>
                      <td>
                        <Link to={`/clientes/${client.id}`} className="flex items-center gap-2.5">
                          <Avatar firstName={client.first_name} lastName={client.last_name} size="sm" />
                          <div><p className="text-xs font-semibold text-slate-200">{client.first_name} {client.last_name}</p><p className="mt-0.5 text-[10px] text-slate-500">{client.dni ? `DNI ${client.dni}` : 'Sin DNI'}</p></div>
                        </Link>
                      </td>
                      <td><p className="text-xs">{client.phone}</p>{client.email && <p className="mt-0.5 max-w-[190px] truncate text-[10px] text-slate-500">{client.email}</p>}</td>
                      <td className="text-center"><span className="badge border-white/[0.08] bg-white/[0.03] text-slate-300">{client.orders_count}</span></td>
                      <td className="text-right text-xs">{formatMoney(client.billed)}</td>
                      <td className={`text-right text-xs font-semibold ${client.debt > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>{formatMoney(client.debt)}</td>
                      <td className="text-[10px] text-slate-500">{client.last_visit ? formatDate(client.last_visit) : '—'}</td>
                      <td>
                        <div className="flex justify-end gap-0.5">
                          <button type="button" className="icon-btn h-8 w-8" onClick={() => setModal({ type: 'edit', client })} title="Editar"><Pencil size={13} /></button>
                          {isAdmin && <button type="button" className="icon-btn h-8 w-8 hover:text-rose-400" onClick={() => removeClient(client)} title="Eliminar"><Trash2 size={13} /></button>}
                          <Link to={`/clientes/${client.id}`} className="icon-btn h-8 w-8" aria-label="Ver ficha"><ChevronRight size={15} /></Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-white/[0.05] md:hidden">
              {data.clients.map((client) => (
                <div key={client.id} className="p-4">
                  <Link to={`/clientes/${client.id}`} className="flex items-center gap-3">
                    <Avatar firstName={client.first_name} lastName={client.last_name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-100">{client.first_name} {client.last_name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{client.phone}</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-600" />
                  </Link>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-white/[0.025] p-2"><p className="text-[9px] uppercase tracking-wider text-slate-600">Órdenes</p><p className="mt-0.5 text-sm font-semibold text-slate-200">{client.orders_count}</p></div>
                    <div className="rounded-lg bg-white/[0.025] p-2"><p className="text-[9px] uppercase tracking-wider text-slate-600">Facturado</p><p className="mt-0.5 truncate text-xs font-semibold text-slate-300">{formatMoney(client.billed, { compact: true })}</p></div>
                    <div className="rounded-lg bg-white/[0.025] p-2"><p className="text-[9px] uppercase tracking-wider text-slate-600">Saldo</p><p className={`mt-0.5 truncate text-xs font-semibold ${client.debt > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>{formatMoney(client.debt, { compact: true })}</p></div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Link to={`/ordenes/nueva?client_id=${client.id}`} className="btn-secondary btn-sm flex-1"><Plus size={13} /> Nuevo ingreso</Link>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setModal({ type: 'edit', client })}><Pencil size={13} /> Editar</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-white/[0.06] px-4 py-3">
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onChange={setPage} />
            </div>
          </>
        )}
      </div>

      <ClientModal open={modal?.type === 'new' || modal?.type === 'edit'} onClose={() => setModal(null)} client={modal?.client} onSaved={refetch} />
    </div>
  );
}
