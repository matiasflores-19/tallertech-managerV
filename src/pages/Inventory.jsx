import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  ClipboardList,
  History,
  Package,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Truck,
  Warehouse,
} from 'lucide-react';
import { useApiQuery, useDebounced, useDocumentTitle } from '../hooks/useApi.js';
import { useAuth } from '../context/AuthProvider.jsx';
import { useUI } from '../context/UIProvider.jsx';
import { api } from '../lib/api.js';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '../lib/format.js';
import {
  EmptyState,
  PageHeader,
  Pagination,
  StatCard,
  TableSkeleton,
  Tabs,
} from '../components/ui.jsx';
import Modal from '../components/Modal.jsx';

const EMPTY_PRODUCT = {
  name: '', category_id: '', brand: '', model: '', sku: '', serial_number: '', stock: 0,
  min_stock: 2, purchase_price: '', sale_price: '', supplier_id: '', location: '', entry_date: '',
};

const EMPTY_SUPPLIER = { name: '', contact_name: '', phone: '', email: '', address: '', cuit: '', notes: '' };

function ProductModal({ open, onClose, product, meta, onSaved }) {
  const { toast } = useUI();
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(product ? {
        name: product.name || '', category_id: product.category_id || '', brand: product.brand || '', model: product.model || '',
        sku: product.sku || '', serial_number: product.serial_number || '', stock: product.stock || 0,
        min_stock: product.min_stock ?? 0, purchase_price: product.purchase_price ?? '', sale_price: product.sale_price ?? '',
        supplier_id: product.supplier_id || '', location: product.location || '', entry_date: product.entry_date || '',
      } : EMPTY_PRODUCT);
      setError('');
    }
  }, [open, product]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        category_id: form.category_id || null,
        supplier_id: form.supplier_id || null,
        entry_date: form.entry_date || null,
        purchase_price: Number(form.purchase_price) || 0,
        sale_price: Number(form.sale_price) || 0,
        min_stock: Number(form.min_stock) || 0,
        stock: Number(form.stock) || 0,
      };
      if (product) delete payload.stock;
      const data = product
        ? await api.patch(`/inventory/products/${product.id}`, payload)
        : await api.post('/inventory/products', payload);
      toast.success(data.message);
      onSaved();
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? 'Editar producto' : 'Nuevo producto'}
      subtitle={product ? 'Modificá precios, stock mínimo y datos del repuesto.' : 'Agregá un repuesto o componente al inventario.'}
      size="lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="product-form" className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : product ? 'Guardar cambios' : 'Crear producto'}</button>
        </div>
      }
    >
      <form id="product-form" onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div>}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="lg:col-span-2"><label className="label">Nombre *</label><input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required placeholder="Ej. SSD Kingston NV2 1TB" /></div>
          <div><label className="label">Categoría</label><select className="select" value={form.category_id} onChange={(event) => setForm({ ...form, category_id: event.target.value })}><option value="">Sin categoría</option>{(meta?.categories || []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></div>
          <div><label className="label">Marca</label><input className="input" value={form.brand} onChange={(event) => setForm({ ...form, brand: event.target.value })} /></div>
          <div><label className="label">Modelo</label><input className="input" value={form.model} onChange={(event) => setForm({ ...form, model: event.target.value })} /></div>
          <div><label className="label">Código interno / SKU</label><input className="input" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="Único" /></div>
          <div><label className="label">Número de serie</label><input className="input" value={form.serial_number} onChange={(event) => setForm({ ...form, serial_number: event.target.value })} /></div>
          <div><label className="label">Proveedor</label><select className="select" value={form.supplier_id} onChange={(event) => setForm({ ...form, supplier_id: event.target.value })}><option value="">Sin proveedor</option>{(meta?.suppliers || []).map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
          <div><label className="label">Ubicación física</label><input className="input" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Ej. Estante A2" /></div>
          {!product && <div><label className="label">Stock inicial</label><input type="number" min="0" step="1" className="input" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} /></div>}
          <div><label className="label">Stock mínimo</label><input type="number" min="0" step="1" className="input" value={form.min_stock} onChange={(event) => setForm({ ...form, min_stock: event.target.value })} /></div>
          <div><label className="label">Precio de compra</label><input type="number" min="0" step="0.01" className="input" value={form.purchase_price} onChange={(event) => setForm({ ...form, purchase_price: event.target.value })} /></div>
          <div><label className="label">Precio de venta</label><input type="number" min="0" step="0.01" className="input" value={form.sale_price} onChange={(event) => setForm({ ...form, sale_price: event.target.value })} /></div>
          <div><label className="label">Fecha de ingreso</label><input type="date" className="input" value={form.entry_date} onChange={(event) => setForm({ ...form, entry_date: event.target.value })} /></div>
        </div>
        {product && <p className="rounded-xl border border-sky-500/15 bg-sky-500/[0.04] p-3 text-[11px] leading-relaxed text-sky-200/70">El stock no se modifica desde la edición. Usá “Movimiento” para registrar entradas, salidas o ajustes con trazabilidad.</p>}
      </form>
    </Modal>
  );
}

function MovementModal({ open, onClose, product, onSaved }) {
  const { toast } = useUI();
  const { isAdmin } = useAuth();
  const [form, setForm] = useState({ movement_type: 'ENTRADA', quantity: 1, unit_cost: '', reason: '', notes: '', allow_negative: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && product) {
      setForm({ movement_type: 'ENTRADA', quantity: 1, unit_cost: product.purchase_price || '', reason: '', notes: '', allow_negative: false });
      setError('');
    }
  }, [open, product]);

  if (!product) return null;
  const quantity = Number(form.quantity) || 0;
  const delta = form.movement_type === 'SALIDA' ? -Math.abs(quantity) : form.movement_type === 'ENTRADA' ? Math.abs(quantity) : quantity;
  const after = Number(product.stock) + delta;

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = await api.post('/inventory/movements', {
        product_id: product.id,
        movement_type: form.movement_type,
        quantity: Number(form.quantity),
        unit_cost: form.unit_cost !== '' ? Number(form.unit_cost) : undefined,
        reason: form.reason,
        notes: form.notes || null,
        allow_negative: form.allow_negative,
      });
      toast.success(data.message);
      if (data.warning) toast.warning(data.warning);
      onSaved();
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Movimiento de inventario" subtitle={product.name} size="sm" footer={
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" form="movement-form" className="btn-primary" disabled={saving}>{saving ? 'Registrando…' : 'Registrar movimiento'}</button>
      </div>
    }>
      <form id="movement-form" onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div>}
        <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <div><p className="text-[10px] uppercase tracking-wider text-slate-500">Stock actual</p><p className="mt-1 text-xl font-bold text-white">{product.stock}</p></div>
          <ArrowUpRight size={20} className="text-slate-600" />
          <div className="text-right"><p className="text-[10px] uppercase tracking-wider text-slate-500">Stock resultante</p><p className={`mt-1 text-xl font-bold ${after < 0 ? 'text-rose-400' : 'text-tech-300'}`}>{after}</p></div>
        </div>
        <div><label className="label">Tipo de movimiento</label><div className="grid grid-cols-3 gap-1.5">{['ENTRADA', 'SALIDA', 'AJUSTE'].map((type) => <button key={type} type="button" onClick={() => setForm({ ...form, movement_type: type })} className={`rounded-lg border px-2 py-2 text-[11px] font-semibold transition ${form.movement_type === type ? 'border-tech-500/40 bg-tech-500/15 text-tech-300' : 'border-white/[0.08] text-slate-500 hover:text-slate-300'}`}>{type === 'ENTRADA' ? 'Entrada' : type === 'SALIDA' ? 'Salida' : 'Ajuste'}</button>)}</div></div>
        <div><label className="label">{form.movement_type === 'AJUSTE' ? 'Diferencia (+ / −)' : 'Cantidad'}</label><input type="number" step="1" className="input" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} required /><p className="mt-1 text-[10px] text-slate-500">{form.movement_type === 'AJUSTE' ? 'Usá un número positivo para sumar stock o negativo para restarlo.' : 'La cantidad debe ser positiva.'}</p></div>
        <div><label className="label">Motivo *</label><input className="input" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} required placeholder="Ej. Compra a proveedor, merma, corrección de conteo…" /></div>
        {form.movement_type === 'ENTRADA' && <div><label className="label">Costo unitario</label><input type="number" min="0" step="0.01" className="input" value={form.unit_cost} onChange={(event) => setForm({ ...form, unit_cost: event.target.value })} /></div>}
        <div><label className="label">Notas</label><textarea className="textarea" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
        {after < 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
            <p className="text-[11px] leading-relaxed text-amber-200/80">Quedaría stock negativo. Se requiere autorización explícita de un administrador.</p>
            {isAdmin && <label className="mt-2 flex items-center gap-2 text-xs text-amber-200"><input type="checkbox" className="checkbox" checked={form.allow_negative} onChange={(event) => setForm({ ...form, allow_negative: event.target.checked })} /> Autorizar stock negativo</label>}
          </div>
        )}
      </form>
    </Modal>
  );
}

function SupplierModal({ open, onClose, supplier, onSaved }) {
  const { toast } = useUI();
  const [form, setForm] = useState(EMPTY_SUPPLIER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm(supplier ? { name: supplier.name || '', contact_name: supplier.contact_name || '', phone: supplier.phone || '', email: supplier.email || '', address: supplier.address || '', cuit: supplier.cuit || '', notes: supplier.notes || '' } : EMPTY_SUPPLIER);
      setError('');
    }
  }, [open, supplier]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = supplier ? await api.patch(`/inventory/suppliers/${supplier.id}`, form) : await api.post('/inventory/suppliers', form);
      toast.success(data.message);
      onSaved();
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={supplier ? 'Editar proveedor' : 'Nuevo proveedor'} size="md" footer={
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" form="supplier-form" className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : supplier ? 'Guardar cambios' : 'Crear proveedor'}</button>
      </div>
    }>
      <form id="supplier-form" onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="label">Nombre / Razón social *</label><input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></div>
          <div><label className="label">Contacto</label><input className="input" value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} /></div>
          <div><label className="label">Teléfono</label><input className="input" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></div>
          <div><label className="label">Correo</label><input className="input" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></div>
          <div><label className="label">CUIT</label><input className="input" value={form.cuit} onChange={(event) => setForm({ ...form, cuit: event.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">Dirección</label><input className="input" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></div>
          <div className="sm:col-span-2"><label className="label">Notas</label><textarea className="textarea" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></div>
        </div>
      </form>
    </Modal>
  );
}

export default function Inventory() {
  useDocumentTitle('Inventario');
  const { isAdmin } = useAuth();
  const { toast, confirm } = useUI();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState('products');
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const debouncedSearch = useDebounced(search, 350);
  const [lowStockOnly, setLowStockOnly] = useState(searchParams.get('lowStock') === '1');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const { data: meta } = useApiQuery('/meta');
  const { data: statsData, refetch: refetchStats } = useApiQuery('/inventory/stats');
  const productsQuery = `/inventory/products?${new URLSearchParams({ ...(debouncedSearch ? { search: debouncedSearch } : {}), ...(lowStockOnly ? { low_stock: '1' } : {}), ...(category ? { category_id: category } : {}) }).toString()}`;
  const { data: productsData, loading: productsLoading, refetch: refetchProducts } = useApiQuery(productsQuery, { enabled: tab === 'products' });
  const movementsQuery = `/inventory/movements?limit=100${debouncedSearch ? `&search=${encodeURIComponent(debouncedSearch)}` : ''}`;
  const { data: movementsData, loading: movementsLoading, refetch: refetchMovements } = useApiQuery(movementsQuery, { enabled: tab === 'movements' });
  const { data: suppliersData, loading: suppliersLoading, refetch: refetchSuppliers } = useApiQuery('/inventory/suppliers', { enabled: tab === 'suppliers' });

  const products = productsData?.products || [];
  const filteredProducts = useMemo(() => {
    if (!debouncedSearch) return products;
    const term = debouncedSearch.toLowerCase();
    return products.filter((product) => `${product.name} ${product.sku || ''} ${product.brand || ''} ${product.model || ''}`.toLowerCase().includes(term));
  }, [products, debouncedSearch]);

  const refreshAll = () => { refetchProducts(); refetchStats(); };

  const deleteProduct = async (product) => {
    const accepted = await confirm({ title: 'Dar de baja producto', message: `“${product.name}” dejará de estar disponible para nuevas reparaciones, pero se conservará su historial.`, confirmLabel: 'Dar de baja' });
    if (!accepted) return;
    try {
      const response = await api.delete(`/inventory/products/${product.id}`);
      toast.success(response.message);
      refreshAll();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const deleteSupplier = async (supplier) => {
    const accepted = await confirm({ title: 'Dar de baja proveedor', message: `Se dará de baja a “${supplier.name}”.`, confirmLabel: 'Dar de baja' });
    if (!accepted) return;
    try {
      const response = await api.delete(`/inventory/suppliers/${supplier.id}`);
      toast.success(response.message);
      refetchSuppliers();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const stats = statsData?.stats || {};

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Recursos"
        title="Inventario"
        subtitle="Controlá repuestos, stock mínimo, movimientos y proveedores del taller."
        icon={Boxes}
        actions={<button type="button" className="btn-primary" onClick={() => setModal({ type: 'product' })}><Plus size={17} /> Nuevo producto</button>}
      />

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <StatCard label="Productos activos" value={formatNumber(stats.products)} icon={Package} tone="blue" />
        <StatCard label="Unidades en stock" value={formatNumber(stats.units)} icon={Warehouse} tone="cyan" />
        <StatCard label="Valor a costo" value={formatMoney(stats.purchase_value, { compact: true })} icon={Boxes} tone="violet" hint={`Venta potencial ${formatMoney(stats.sale_value, { compact: true })}`} />
        <StatCard label="Alertas de stock" value={formatNumber(stats.low_stock)} icon={AlertTriangle} tone={stats.low_stock > 0 ? 'amber' : 'emerald'} hint={`${stats.out_of_stock || 0} agotados`} onClick={() => { setTab('products'); setLowStockOnly(true); setPage(1); }} />
      </div>

      <div className="mt-4">
        <Tabs
          tabs={[
            { value: 'products', label: 'Productos', icon: Package, count: stats.products },
            { value: 'movements', label: 'Movimientos', icon: History },
            { value: 'suppliers', label: 'Proveedores', icon: Truck, count: suppliersData?.suppliers?.length },
          ]}
          active={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'products' && (
        <>
          {(stats.low_stock > 0) && (
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3.5">
              <AlertTriangle size={17} className="mt-0.5 shrink-0 text-amber-400" />
              <div className="flex-1"><p className="text-xs font-semibold text-amber-200">{stats.low_stock} productos necesitan reposición</p><p className="mt-0.5 text-[11px] text-amber-200/60">Hay {stats.out_of_stock || 0} productos agotados. Revisá las alertas y registrá entradas de mercadería.</p></div>
              <button type="button" className="btn-secondary btn-sm shrink-0" onClick={() => setLowStockOnly(true)}>Ver alertas</button>
            </div>
          )}

          <div className="mt-3 card p-3 sm:p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1"><Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" /><input className="input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nombre, SKU, marca o serie…" /></div>
              <select className="select sm:w-[210px]" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas las categorías</option>{(statsData?.categories || []).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.products})</option>)}</select>
              <button type="button" className={`btn-secondary ${lowStockOnly ? 'border-amber-500/30 text-amber-300' : ''}`} onClick={() => setLowStockOnly((value) => !value)}><SlidersHorizontal size={15} /> Stock bajo</button>
            </div>
          </div>

          <div className="mt-3 card overflow-hidden">
            {productsLoading ? <TableSkeleton rows={7} /> : filteredProducts.length === 0 ? (
              <EmptyState icon={Package} title="No hay productos" description="Agregá repuestos al inventario o ajustá los filtros." action={<button className="btn-primary" onClick={() => setModal({ type: 'product' })}><Plus size={15} /> Nuevo producto</button>} />
            ) : (
              <>
                <div className="table-wrapper hidden md:block">
                  <table className="data-table min-w-[1000px]">
                    <thead><tr><th>Producto</th><th>Categoría</th><th>Ubicación</th><th className="text-right">Stock</th><th className="text-right">Costo</th><th className="text-right">Venta</th><th className="text-right">Valor</th><th className="w-28" /></tr></thead>
                    <tbody>
                      {filteredProducts.map((product) => (
                        <tr key={product.id}>
                          <td><p className="text-xs font-semibold text-slate-200">{product.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{product.sku || 'Sin SKU'} · {product.brand || ''} {product.model || ''}</p></td>
                          <td className="text-xs text-slate-400">{product.category_name || '—'}</td>
                          <td className="text-xs text-slate-400">{product.location || '—'}</td>
                          <td className="text-right">
                            <span className={`badge ${product.stock <= 0 ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : product.stock <= product.min_stock ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'}`}>{product.stock} u.</span>
                            <p className="mt-1 text-[9px] text-slate-600">mín. {product.min_stock}</p>
                          </td>
                          <td className="text-right text-xs">{formatMoney(product.purchase_price)}</td>
                          <td className="text-right text-xs">{formatMoney(product.sale_price)}</td>
                          <td className="text-right text-xs text-slate-400">{formatMoney(product.stock_value)}</td>
                          <td><div className="flex justify-end gap-0.5">
                            <button type="button" className="icon-btn h-8 w-8" title="Movimiento" onClick={() => setModal({ type: 'movement', product })}><ClipboardList size={14} /></button>
                            <button type="button" className="icon-btn h-8 w-8" title="Editar" onClick={() => setModal({ type: 'product', product })}><Pencil size={14} /></button>
                            {isAdmin && <button type="button" className="icon-btn h-8 w-8 hover:text-rose-400" title="Dar de baja" onClick={() => deleteProduct(product)}><Trash2 size={14} /></button>}
                          </div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="divide-y divide-white/[0.05] md:hidden">
                  {filteredProducts.map((product) => (
                    <div key={product.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0"><p className="text-sm font-semibold text-slate-100">{product.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{product.sku || 'Sin SKU'} · {product.category_name || 'Sin categoría'}</p></div>
                        <span className={`badge shrink-0 ${product.stock <= 0 ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : product.stock <= product.min_stock ? 'border-amber-500/20 bg-amber-500/10 text-amber-300' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'}`}>{product.stock} u.</span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px]">
                        <div><p className="text-slate-600">Costo</p><p className="mt-0.5 font-semibold text-slate-300">{formatMoney(product.purchase_price)}</p></div>
                        <div><p className="text-slate-600">Venta</p><p className="mt-0.5 font-semibold text-slate-300">{formatMoney(product.sale_price)}</p></div>
                        <div><p className="text-slate-600">Ubicación</p><p className="mt-0.5 truncate font-semibold text-slate-300">{product.location || '—'}</p></div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button type="button" className="btn-secondary btn-sm flex-1" onClick={() => setModal({ type: 'movement', product })}><ArrowDownLeft size={13} /> Movimiento</button>
                        <button type="button" className="btn-ghost btn-sm" onClick={() => setModal({ type: 'product', product })}><Pencil size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-white/[0.06] px-4 py-3 text-xs text-slate-500">{filteredProducts.length} productos</div>
              </>
            )}
          </div>
        </>
      )}

      {tab === 'movements' && (
        <div className="mt-3 card overflow-hidden">
          <div className="border-b border-white/[0.06] p-4"><div className="relative max-w-md"><Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" /><input className="input pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar producto…" /></div></div>
          {movementsLoading ? <TableSkeleton rows={7} /> : (movementsData?.movements || []).length === 0 ? (
            <EmptyState icon={History} title="Sin movimientos" description="Las entradas, salidas y ajustes de inventario aparecerán aquí." />
          ) : (
            <div className="table-wrapper">
              <table className="data-table min-w-[850px]">
                <thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th className="text-right">Cantidad</th><th className="text-right">Stock final</th><th>Motivo</th><th>Usuario</th></tr></thead>
                <tbody>
                  {movementsData.movements.map((movement) => (
                    <tr key={movement.id}>
                      <td className="whitespace-nowrap text-[10px] text-slate-500">{formatDateTime(movement.created_at)}</td>
                      <td><p className="text-xs font-medium text-slate-200">{movement.product_name}</p><p className="text-[10px] text-slate-500">{movement.sku || '—'}</p></td>
                      <td><span className={`badge ${movement.movement_type === 'ENTRADA' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : movement.movement_type === 'SALIDA' ? 'border-rose-500/20 bg-rose-500/10 text-rose-300' : 'border-sky-500/20 bg-sky-500/10 text-sky-300'}`}>{movement.movement_type}</span></td>
                      <td className={`text-right text-xs font-semibold ${movement.quantity >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{movement.quantity > 0 ? '+' : ''}{movement.quantity}</td>
                      <td className="text-right text-xs">{movement.stock_after}</td>
                      <td className="max-w-[220px] truncate text-xs text-slate-400">{movement.reason}</td>
                      <td className="text-[10px] text-slate-500">{movement.created_by_name || 'Sistema'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'suppliers' && (
        <div className="mt-3 space-y-3">
          {isAdmin && <div className="flex justify-end"><button type="button" className="btn-primary" onClick={() => setModal({ type: 'supplier' })}><Plus size={16} /> Nuevo proveedor</button></div>}
          <div className="card overflow-hidden">
            {suppliersLoading ? <TableSkeleton rows={5} /> : (suppliersData?.suppliers || []).length === 0 ? (
              <EmptyState icon={Truck} title="Sin proveedores" description="Registrá los proveedores de repuestos para asociarlos al inventario." action={isAdmin ? <button className="btn-primary" onClick={() => setModal({ type: 'supplier' })}>Nuevo proveedor</button> : null} />
            ) : (
              <div className="table-wrapper">
                <table className="data-table min-w-[800px]">
                  <thead><tr><th>Proveedor</th><th>Contacto</th><th>Teléfono / Correo</th><th>CUIT</th><th className="text-center">Productos</th>{isAdmin && <th className="w-20" />}</tr></thead>
                  <tbody>
                    {suppliersData.suppliers.map((supplier) => (
                      <tr key={supplier.id}>
                        <td><p className="text-xs font-semibold text-slate-200">{supplier.name}</p><p className="text-[10px] text-slate-500">{supplier.address || '—'}</p></td>
                        <td className="text-xs text-slate-400">{supplier.contact_name || '—'}</td>
                        <td><p className="text-xs">{supplier.phone || '—'}</p><p className="text-[10px] text-slate-500">{supplier.email || ''}</p></td>
                        <td className="text-xs text-slate-500">{supplier.cuit || '—'}</td>
                        <td className="text-center text-xs">{supplier.products_count}</td>
                        {isAdmin && <td><div className="flex justify-end gap-0.5"><button type="button" className="icon-btn h-8 w-8" onClick={() => setModal({ type: 'supplier', supplier })}><Pencil size={14} /></button><button type="button" className="icon-btn h-8 w-8 hover:text-rose-400" onClick={() => deleteSupplier(supplier)}><Trash2 size={14} /></button></div></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      <ProductModal open={modal?.type === 'product'} onClose={() => setModal(null)} product={modal?.product} meta={meta} onSaved={refreshAll} />
      <MovementModal open={modal?.type === 'movement'} onClose={() => setModal(null)} product={modal?.product} onSaved={() => { refreshAll(); refetchMovements(); }} />
      <SupplierModal open={modal?.type === 'supplier'} onClose={() => setModal(null)} supplier={modal?.supplier} onSaved={refetchSuppliers} />
    </div>
  );
}
