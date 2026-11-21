import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Filter,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useApiQuery, useDocumentTitle } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthProvider.jsx';
import { useUI } from '../context/UIProvider.jsx';
import { api } from '../lib/api.js';
import { formatDate, formatMoney } from '../lib/format.js';
import { ACTIVE_STATUSES, ORDER_STATUSES, STATUS_META, PRIORITIES } from '../lib/constants.js';
import {
  EmptyState,
  PageHeader,
  Pagination,
  PriorityBadge,
  SearchInput,
  StatusBadge,
  TableSkeleton,
} from '../components/ui.jsx';

const SORT_OPTIONS = [
  { value: 'recent', label: 'Más recientes' },
  { value: 'oldest', label: 'Más antiguas' },
  { value: 'updated', label: 'Última actualización' },
  { value: 'delivery', label: 'Entrega estimada' },
  { value: 'priority', label: 'Prioridad' },
];

export default function Orders() {
  useDocumentTitle('Órdenes de reparación');
  const { isAdmin } = useAuth();
  const { toast, confirm } = useUI();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState([]);
  const [deleting, setDeleting] = useState(false);
  const { data: meta } = useApiQuery('/meta');

  const filters = useMemo(
    () => ({
      search: searchParams.get('search') || '',
      status: searchParams.get('status') || '',
      equipment_type_id: searchParams.get('equipment_type_id') || '',
      technician_id: searchParams.get('technician_id') || '',
      priority: searchParams.get('priority') || '',
      from: searchParams.get('from') || '',
      to: searchParams.get('to') || '',
      sort: searchParams.get('sort') || 'recent',
      page: Number(searchParams.get('page') || 1),
    }),
    [searchParams],
  );

  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (searchInput !== filters.search) {
        updateParams({ search: searchInput || undefined, page: undefined });
      }
    }, 380);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function updateParams(changes) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(changes)) {
      if (value === undefined || value === null || value === '' || value === false) next.delete(key);
      else next.set(key, String(value));
    }
    setSearchParams(next, { replace: true });
  }

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', '15');
    params.set('page', String(filters.page));
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    if (filters.equipment_type_id) params.set('equipment_type_id', filters.equipment_type_id);
    if (filters.technician_id) params.set('technician_id', filters.technician_id);
    if (filters.priority) params.set('priority', filters.priority);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);
    if (filters.sort) params.set('sort', filters.sort);
    return params.toString();
  }, [filters]);

  const { data, loading, refetch } = useApiQuery(`/orders?${queryString}`);
  const orders = data?.orders || [];
  const allSelected = orders.length > 0 && orders.every((order) => selected.includes(order.id));
  const someSelected = selected.length > 0;

  useEffect(() => {
    setSelected([]);
  }, [queryString]);

  const toggleSelected = (id) => {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  const toggleAll = () => {
    setSelected(allSelected ? [] : orders.map((order) => order.id));
  };

  const deleteSelected = async () => {
    if (!selected.length) return;
    const accepted = await confirm({
      title: 'Eliminar órdenes',
      message: `Se eliminarán ${selected.length} ${selected.length === 1 ? 'orden' : 'órdenes'} de forma definitiva. Si tienen pagos, esos ingresos se anularán y los repuestos volverán al inventario. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar definitivamente',
      tone: 'danger',
    });
    if (!accepted) return;
    setDeleting(true);
    try {
      const response = await api.post('/orders/bulk-delete', { order_ids: selected });
      toast.success(response.message);
      setSelected([]);
      refetch();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setDeleting(false);
    }
  };

  const activeFilterCount = [
    filters.search,
    filters.status,
    filters.equipment_type_id,
    filters.technician_id,
    filters.priority,
    filters.from,
    filters.to,
  ].filter(Boolean).length;

  const statusOptions = useMemo(() => {
    if (filters.status && !ORDER_STATUSES.includes(filters.status)) {
      return [{ value: filters.status, label: 'Filtro de estado combinado' }];
    }
    return [];
  }, [filters.status]);

  const resetFilters = () => {
    setSearchInput('');
    setSearchParams({}, { replace: true });
  };

  const setQuickStatus = (statuses) => {
    updateParams({ status: statuses || undefined, page: undefined });
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Operaciones"
        title="Órdenes de reparación"
        subtitle="Consultá, filtrá y seguí cada equipo desde el ingreso hasta la entrega."
        icon={ClipboardList}
        actions={
          <>
            <button type="button" className="btn-secondary md:hidden" onClick={() => setShowFilters((value) => !value)}>
              <SlidersHorizontal size={16} /> Filtros
              {activeFilterCount > 0 && <span className="rounded-md bg-tech-500/20 px-1.5 text-[10px] text-tech-300">{activeFilterCount}</span>}
            </button>
            <Link to="/reparaciones" className="btn-secondary hidden sm:inline-flex">
              <Wrench size={16} /> Tablero
            </Link>
            <Link to="/ordenes/nueva" className="btn-primary">
              <Plus size={17} /> Nuevo ingreso
            </Link>
          </>
        }
      />

      <div className="card mb-4 p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Buscar por N° de orden, cliente, teléfono, marca, modelo o serie…"
              className="flex-1"
            />
            <div className="hidden items-center gap-2 md:flex">
              <select
                className="select w-auto min-w-[160px]"
                value={filters.status}
                onChange={(event) => updateParams({ status: event.target.value || undefined, page: undefined })}
                aria-label="Filtrar por estado"
              >
                <option value="">Todos los estados</option>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
                {ORDER_STATUSES.map((status) => (
                  <option key={status} value={status}>{STATUS_META[status].label}</option>
                ))}
              </select>
              <button
                type="button"
                className={`btn-secondary ${activeFilterCount > 0 ? 'border-tech-500/30 text-tech-300' : ''}`}
                onClick={() => setShowFilters((value) => !value)}
              >
                <Filter size={15} /> Filtros
                {activeFilterCount > 0 && <span className="rounded-md bg-tech-500/20 px-1.5 text-[10px]">{activeFilterCount}</span>}
              </button>
            </div>
          </div>

          <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setQuickStatus('')}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${!filters.status ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'}`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setQuickStatus(ACTIVE_STATUSES.join(','))}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${filters.status && filters.status.includes(',') ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'}`}
            >
              Activas
            </button>
            {['RECIBIDO', 'EN_DIAGNOSTICO', 'ESPERANDO_REPUESTOS', 'EN_REPARACION', 'LISTO_PARA_RETIRAR', 'ENTREGADO'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setQuickStatus(status)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition ${filters.status === status ? 'bg-white/[0.08] text-white' : 'text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'}`}
              >
                {STATUS_META[status].label}
              </button>
            ))}
          </div>

          {showFilters && (
            <div className="grid gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label className="label" htmlFor="filter-type">Tipo de equipo</label>
                <select
                  id="filter-type"
                  className="select"
                  value={filters.equipment_type_id}
                  onChange={(event) => updateParams({ equipment_type_id: event.target.value || undefined, page: undefined })}
                >
                  <option value="">Todos</option>
                  {(meta?.equipmentTypes || []).map((type) => (
                    <option key={type.id} value={type.id}>{type.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="filter-tech">Técnico</label>
                <select
                  id="filter-tech"
                  className="select"
                  value={filters.technician_id}
                  onChange={(event) => updateParams({ technician_id: event.target.value || undefined, page: undefined })}
                >
                  <option value="">Todos</option>
                  {(meta?.technicians || []).map((technician) => (
                    <option key={technician.id} value={technician.id}>{technician.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="filter-priority">Prioridad</label>
                <select
                  id="filter-priority"
                  className="select"
                  value={filters.priority}
                  onChange={(event) => updateParams({ priority: event.target.value || undefined, page: undefined })}
                >
                  <option value="">Todas</option>
                  {PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>{priority}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="filter-from">Ingreso desde</label>
                <input
                  id="filter-from"
                  type="date"
                  className="input"
                  value={filters.from}
                  onChange={(event) => updateParams({ from: event.target.value || undefined, page: undefined })}
                />
              </div>
              <div>
                <label className="label" htmlFor="filter-to">Ingreso hasta</label>
                <input
                  id="filter-to"
                  type="date"
                  className="input"
                  value={filters.to}
                  onChange={(event) => updateParams({ to: event.target.value || undefined, page: undefined })}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-5 flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <CalendarDays size={13} /> Los filtros se aplican a la fecha de ingreso.
                </div>
                <div className="flex gap-2">
                  <button type="button" className="btn-ghost btn-sm" onClick={resetFilters}>
                    <RotateCcw size={13} /> Limpiar filtros
                  </button>
                  <button type="button" className="btn-secondary btn-sm" onClick={() => setShowFilters(false)}>
                    <X size={13} /> Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
          <p className="text-xs text-slate-500">
            {loading ? 'Buscando órdenes…' : <><span className="font-semibold text-slate-300">{data?.total || 0}</span> órdenes encontradas</>}
          </p>
          <div className="flex items-center gap-2">
            <select
              className="select min-h-[34px] w-auto rounded-lg py-1.5 text-xs"
              value={filters.sort}
              onChange={(event) => updateParams({ sort: event.target.value, page: undefined })}
              aria-label="Ordenar"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <button type="button" onClick={refetch} className="icon-btn h-8 w-8" title="Actualizar">
              <RotateCcw size={14} />
            </button>
          </div>
        </div>

        {isAdmin && orders.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-tech-500/[0.035] px-4 py-2.5">
            <label className="inline-flex cursor-pointer items-center gap-2 text-[11px] font-medium text-slate-400">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="h-4 w-4 cursor-pointer rounded border-white/20 bg-slate-900 accent-tech-500"
              />
              Seleccionar página
            </label>
            <div className="flex items-center gap-2">
              {someSelected ? (
                <>
                  <span className="text-[11px] font-medium text-slate-400">{selected.length} seleccionadas</span>
                  <button
                    type="button"
                    className="btn-ghost btn-sm text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                    onClick={deleteSelected}
                    disabled={deleting}
                  >
                    <Trash2 size={13} /> {deleting ? 'Eliminando…' : 'Eliminar seleccionadas'}
                  </button>
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setSelected([])} disabled={deleting}>
                    <X size={13} /> Limpiar
                  </button>
                </>
              ) : (
                <span className="text-[11px] text-slate-600">Marcá órdenes para eliminarlas en lote.</span>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <TableSkeleton rows={7} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No hay órdenes con esos filtros"
            description="Probá con otra búsqueda, limpiá los filtros o registrá un nuevo ingreso."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" className="btn-secondary" onClick={resetFilters}><RotateCcw size={15} /> Limpiar filtros</button>
                <Link to="/ordenes/nueva" className="btn-primary"><Plus size={15} /> Nuevo ingreso</Link>
              </div>
            }
          />
        ) : (
          <>
            <div className="table-wrapper hidden md:block">
              <table className="data-table min-w-[900px]">
                <thead>
                  <tr>
                    {isAdmin && (
                      <th className="w-10">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          aria-label="Seleccionar todas las órdenes de la página"
                          className="h-4 w-4 cursor-pointer rounded border-white/20 bg-slate-900 accent-tech-500"
                        />
                      </th>
                    )}
                    <th>Orden</th>
                    <th>Cliente</th>
                    <th>Equipo</th>
                    <th>Estado</th>
                    <th>Ingreso</th>
                    <th className="text-right">Facturado</th>
                    <th className="text-right">Saldo</th>
                    <th className="w-12" />
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id} className="group">
                      {isAdmin && (
                        <td>
                          <input
                            type="checkbox"
                            checked={selected.includes(order.id)}
                            onChange={() => toggleSelected(order.id)}
                            aria-label={`Seleccionar ${order.order_number}`}
                            className="h-4 w-4 cursor-pointer rounded border-white/20 bg-slate-900 accent-tech-500"
                          />
                        </td>
                      )}
                      <td>
                        <Link to={`/ordenes/${order.id}`} className="font-mono text-xs font-semibold text-tech-400 transition hover:text-tech-300">
                          {order.order_number}
                        </Link>
                        {order.priority !== 'NORMAL' && <div className="mt-1"><PriorityBadge priority={order.priority} /></div>}
                      </td>
                      <td>
                        <p className="text-xs font-medium text-slate-200">{order.client_name}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">{order.client_phone}</p>
                      </td>
                      <td>
                        <p className="max-w-[210px] truncate text-xs text-slate-200">{order.brand} {order.model}</p>
                        <p className="mt-0.5 text-[10px] text-slate-500">{order.equipment_type_name}</p>
                      </td>
                      <td><StatusBadge status={order.status} /></td>
                      <td className="whitespace-nowrap"><p className="text-xs">{formatDate(order.intake_at)}</p><p className="mt-0.5 text-[10px] text-slate-500">{order.technician_name || 'Sin técnico'}</p></td>
                      <td className="whitespace-nowrap text-right text-xs font-medium text-slate-300">{formatMoney(order.billable)}</td>
                      <td className={`whitespace-nowrap text-right text-xs font-semibold ${order.balance > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>{formatMoney(order.balance)}</td>
                      <td>
                        <Link to={`/ordenes/${order.id}`} className="icon-btn h-8 w-8 opacity-50 group-hover:opacity-100" aria-label={`Ver ${order.order_number}`}>
                          <ChevronRight size={16} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-white/[0.05] md:hidden">
              {orders.map((order) => (
                <div key={order.id} className="flex items-start gap-2 px-3 py-3.5 transition active:bg-white/[0.03]">
                  {isAdmin && (
                    <input
                      type="checkbox"
                      checked={selected.includes(order.id)}
                      onChange={() => toggleSelected(order.id)}
                      aria-label={`Seleccionar ${order.order_number}`}
                      className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-white/20 bg-slate-900 accent-tech-500"
                    />
                  )}
                  <Link to={`/ordenes/${order.id}`} className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-semibold text-tech-400">{order.order_number}</span>
                          <PriorityBadge priority={order.priority} />
                        </div>
                        <p className="mt-1.5 truncate text-sm font-semibold text-slate-100">{order.client_name}</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">{order.brand} {order.model} · {order.equipment_type_name}</p>
                      </div>
                      <StatusBadge status={order.status} className="shrink-0" />
                    </div>
                    <div className="mt-3 flex items-end justify-between gap-3">
                      <p className="text-[10px] text-slate-600">Ingreso {formatDate(order.intake_at)} · {order.technician_name || 'Sin técnico'}</p>
                      <div className="text-right">
                        <p className={`text-xs font-semibold ${order.balance > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>{formatMoney(order.balance)}</p>
                        <p className="text-[9px] uppercase tracking-wider text-slate-600">saldo</p>
                      </div>
                    </div>
                  </Link>
                </div>
              ))}
            </div>

            <div className="border-t border-white/[0.06] px-4 py-3">
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                total={data.total}
                onChange={(page) => updateParams({ page, })}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
