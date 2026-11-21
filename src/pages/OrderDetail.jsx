import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRightLeft,
  BadgeCheck,
  Box,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Clock3,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  FileText,
  History,
  ImagePlus,
  LockKeyhole,
  Mail,
  MapPin,
  MoreHorizontal,
  Package,
  Pencil,
  Phone,
  Plus,
  Printer,
  Receipt,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserRound,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../context/AuthProvider.jsx';
import { useUI } from '../context/UIProvider.jsx';
import { useApiQuery, useDocumentTitle } from '../hooks/useApi.js';
import { api, downloadFile } from '../lib/api.js';
import {
  classNames,
  fileToDataUrl,
  formatDate,
  formatDateTime,
  formatMoney,
  todayISO,
} from '../lib/format.js';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS,
  PAYMENT_TYPES,
  PAYMENT_TYPE_LABELS,
  PRIORITIES,
  PRIORITY_META,
  STATUS_META,
  STATUS_OPTIONS,
} from '../lib/constants.js';
import {
  DetailField,
  EmptyState,
  LoadingScreen,
  PageHeader,
  PriorityBadge,
  SectionHeader,
  StatusBadge,
  Tabs,
} from '../components/ui.jsx';
import Modal from '../components/Modal.jsx';

const TABS = [
  { value: 'summary', label: 'Resumen', icon: FileText },
  { value: 'interventions', label: 'Intervenciones', icon: Wrench },
  { value: 'parts', label: 'Repuestos', icon: Package },
  { value: 'payments', label: 'Pagos', icon: CreditCard },
  { value: 'history', label: 'Historial', icon: History },
];

const STATUS_ORDER = [
  'RECIBIDO',
  'PENDIENTE_DIAGNOSTICO',
  'EN_DIAGNOSTICO',
  'PRESUPUESTADO',
  'ESPERANDO_APROBACION',
  'ESPERANDO_REPUESTOS',
  'EN_REPARACION',
  'EN_PRUEBAS',
  'REPARADO',
  'LISTO_PARA_RETIRAR',
  'ENTREGADO',
];

const PROGRESS_STEPS = [
  { label: 'Ingreso', statuses: ['RECIBIDO'] },
  { label: 'Diagnóstico', statuses: ['PENDIENTE_DIAGNOSTICO', 'EN_DIAGNOSTICO', 'PRESUPUESTADO', 'ESPERANDO_APROBACION'] },
  { label: 'Reparación', statuses: ['ESPERANDO_REPUESTOS', 'EN_REPARACION', 'EN_PRUEBAS'] },
  { label: 'Listo', statuses: ['REPARADO', 'LISTO_PARA_RETIRAR'] },
  { label: 'Entregado', statuses: ['ENTREGADO'] },
];

function ModalActions({ onCancel, submitLabel = 'Guardar', saving = false, danger = false, formId }) {
  return (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
      <button type="submit" form={formId} className={danger ? 'btn-danger' : 'btn-primary'} disabled={saving}>
        {saving ? 'Guardando…' : submitLabel}
      </button>
    </div>
  );
}

function StatusModal({ open, onClose, order, onSaved }) {
  const { toast } = useUI();
  const [status, setStatus] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      const currentIndex = STATUS_OPTIONS.findIndex((item) => item.value === order.status);
      const next = STATUS_OPTIONS[currentIndex + 1]?.value || '';
      setStatus(next);
      setNote('');
    }
  }, [open, order.status]);

  const submit = async (event) => {
    event.preventDefault();
    if (!status) return;
    setSaving(true);
    try {
      const data = await api.patch(`/orders/${order.id}/status`, { status, note: note || null });
      toast.success(data.message);
      if (data.warning) toast.warning(data.warning);
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cambiar estado de la orden"
      subtitle={`${order.order_number} · Estado actual: ${STATUS_META[order.status]?.label}`}
      size="sm"
      footer={<ModalActions onCancel={onClose} submitLabel="Actualizar estado" saving={saving} formId="status-form" />}
    >
      <form id="status-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Nuevo estado</label>
          <select className="select" value={status} onChange={(event) => setStatus(event.target.value)} required>
            <option value="">Seleccionar…</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Nota del cambio <span className="font-normal text-slate-500">(opcional)</span></label>
          <textarea className="textarea" rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ej. Se informó al cliente el presupuesto por WhatsApp." />
        </div>
        <div className="rounded-xl border border-sky-500/15 bg-sky-500/[0.05] p-3 text-[11px] leading-relaxed text-sky-200/70">
          El cambio queda registrado con fecha, hora y usuario. Si entregás el equipo con saldo pendiente, el sistema te lo va a advertir.
        </div>
      </form>
    </Modal>
  );
}

function EditModal({ open, onClose, order, meta, onSaved }) {
  const { toast } = useUI();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        brand: order.brand || '',
        model: order.model || '',
        serial_number: order.serial_number || '',
        imei: order.imei || '',
        color: order.color || '',
        accessories: order.accessories || '',
        equipment_type_id: order.equipment_type_id,
        technician_id: order.technician_id || '',
        priority: order.priority,
        estimated_budget: order.estimated_budget || '',
        estimated_delivery: order.estimated_delivery || '',
        labor_cost: order.labor_cost || '',
        final_price: order.final_price || '',
        declared_issue: order.declared_issue || '',
        detailed_problem: order.detailed_problem || '',
        physical_condition: order.physical_condition || '',
        visible_damage: order.visible_damage || '',
        initial_diagnosis: order.initial_diagnosis || '',
        internal_notes: order.internal_notes || '',
        unlock_type: order.unlock_type || '',
        unlock_secret: '',
      });
    }
  }, [open, order]);

  if (!form) return null;
  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api.patch(`/orders/${order.id}`, {
        ...form,
        equipment_type_id: Number(form.equipment_type_id),
        technician_id: form.technician_id ? Number(form.technician_id) : null,
        estimated_budget: Number(form.estimated_budget) || 0,
        labor_cost: Number(form.labor_cost) || 0,
        final_price: Number(form.final_price) || 0,
        estimated_delivery: form.estimated_delivery || null,
        unlock_secret: form.unlock_secret || undefined,
      });
      toast.success(data.message);
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Editar orden"
      subtitle="Actualizá datos del equipo, diagnóstico y costos de la reparación."
      size="lg"
      footer={<ModalActions onCancel={onClose} submitLabel="Guardar cambios" saving={saving} formId="edit-order-form" />}
    >
      <form id="edit-order-form" onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className="label">Tipo de equipo</label><select className="select" value={form.equipment_type_id} onChange={(event) => setField('equipment_type_id', event.target.value)}>{(meta?.equipmentTypes || []).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select></div>
          <div><label className="label">Técnico</label><select className="select" value={form.technician_id} onChange={(event) => setField('technician_id', event.target.value)}><option value="">Sin asignar</option>{(meta?.technicians || []).map((technician) => <option key={technician.id} value={technician.id}>{technician.name}</option>)}</select></div>
          <div><label className="label">Marca</label><input className="input" value={form.brand} onChange={(event) => setField('brand', event.target.value)} required /></div>
          <div><label className="label">Modelo</label><input className="input" value={form.model} onChange={(event) => setField('model', event.target.value)} required /></div>
          <div><label className="label">Número de serie</label><input className="input" value={form.serial_number} onChange={(event) => setField('serial_number', event.target.value)} /></div>
          <div><label className="label">IMEI</label><input className="input" value={form.imei} onChange={(event) => setField('imei', event.target.value)} /></div>
          <div><label className="label">Color</label><input className="input" value={form.color} onChange={(event) => setField('color', event.target.value)} /></div>
          <div><label className="label">Accesorios</label><input className="input" value={form.accessories} onChange={(event) => setField('accessories', event.target.value)} /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div><label className="label">Prioridad</label><select className="select" value={form.priority} onChange={(event) => setField('priority', event.target.value)}>{PRIORITIES.map((priority) => <option key={priority} value={priority}>{PRIORITY_META[priority].label}</option>)}</select></div>
          <div><label className="label">Presupuesto estimado</label><input type="number" min="0" step="0.01" className="input" value={form.estimated_budget} onChange={(event) => setField('estimated_budget', event.target.value)} /></div>
          <div><label className="label">Entrega estimada</label><input type="date" className="input" value={form.estimated_delivery} onChange={(event) => setField('estimated_delivery', event.target.value)} /></div>
          <div><label className="label">Costo de mano de obra</label><input type="number" min="0" step="0.01" className="input" value={form.labor_cost} onChange={(event) => setField('labor_cost', event.target.value)} /></div>
          <div><label className="label">Precio final</label><input type="number" min="0" step="0.01" className="input" value={form.final_price} onChange={(event) => setField('final_price', event.target.value)} /></div>
        </div>
        <div className="grid gap-3">
          <div><label className="label">Falla declarada</label><input className="input" value={form.declared_issue} onChange={(event) => setField('declared_issue', event.target.value)} /></div>
          <div><label className="label">Descripción del problema</label><textarea className="textarea" rows={2} value={form.detailed_problem} onChange={(event) => setField('detailed_problem', event.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className="label">Estado físico</label><input className="input" value={form.physical_condition} onChange={(event) => setField('physical_condition', event.target.value)} /></div>
            <div><label className="label">Daños visibles</label><input className="input" value={form.visible_damage} onChange={(event) => setField('visible_damage', event.target.value)} /></div>
          </div>
          <div><label className="label">Diagnóstico técnico</label><textarea className="textarea" rows={3} value={form.initial_diagnosis} onChange={(event) => setField('initial_diagnosis', event.target.value)} /></div>
          <div><label className="label">Observaciones internas</label><textarea className="textarea" rows={2} value={form.internal_notes} onChange={(event) => setField('internal_notes', event.target.value)} /></div>
          <div className="grid gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:grid-cols-2">
            <div><label className="label">Tipo de desbloqueo</label><select className="select" value={form.unlock_type} onChange={(event) => setField('unlock_type', event.target.value)}><option value="">Sin dato</option><option value="Contraseña">Contraseña / PIN</option><option value="Patrón">Patrón</option><option value="Cuenta">Cuenta vinculada</option><option value="Otro">Otro</option></select></div>
            <div><label className="label">Nuevo dato de desbloqueo</label><input className="input" type="password" value={form.unlock_secret} onChange={(event) => setField('unlock_secret', event.target.value)} placeholder="Dejar vacío para conservar" autoComplete="new-password" /></div>
          </div>
        </div>
      </form>
    </Modal>
  );
}

function InterventionModal({ open, onClose, order, meta, onSaved }) {
  const { toast } = useUI();
  const [form, setForm] = useState({ type: 'DIAGNOSTICO', description: '', technician_id: order.technician_id || '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm({ type: 'DIAGNOSTICO', description: '', technician_id: order.technician_id || '' });
  }, [open, order.technician_id]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api.post(`/orders/${order.id}/interventions`, {
        ...form,
        technician_id: form.technician_id ? Number(form.technician_id) : null,
      });
      toast.success(data.message);
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Agregar intervención" subtitle="Dejá registro del trabajo técnico realizado." size="sm" footer={<ModalActions onCancel={onClose} submitLabel="Registrar" saving={saving} formId="intervention-form" />}>
      <form id="intervention-form" onSubmit={submit} className="space-y-4">
        <div><label className="label">Tipo</label><select className="select" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option value="DIAGNOSTICO">Diagnóstico</option><option value="REPARACION">Reparación</option><option value="PRUEBA">Prueba</option><option value="NOTA">Nota</option></select></div>
        <div><label className="label">Técnico</label><select className="select" value={form.technician_id} onChange={(event) => setForm({ ...form, technician_id: event.target.value })}><option value="">Sin asignar</option>{(meta?.technicians || []).map((technician) => <option key={technician.id} value={technician.id}>{technician.name}</option>)}</select></div>
        <div><label className="label">Descripción</label><textarea className="textarea" rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required placeholder="Detallá la tarea, hallazgos o pruebas realizadas…" /></div>
      </form>
    </Modal>
  );
}

function PartModal({ open, onClose, order, meta, onSaved }) {
  const { toast } = useUI();
  const { isAdmin } = useAuth();
  const { data: inventory, loading } = useApiQuery('/inventory/products', { enabled: open });
  const [search, setSearch] = useState('');
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState('');
  const [notes, setNotes] = useState('');
  const [allowNegative, setAllowNegative] = useState(false);
  const [saving, setSaving] = useState(false);

  const products = inventory?.products || [];
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) => `${product.name} ${product.sku || ''} ${product.brand || ''}`.toLowerCase().includes(term));
  }, [products, search]);
  const product = products.find((item) => item.id === Number(productId));

  useEffect(() => {
    if (open) {
      setSearch('');
      setProductId('');
      setQuantity(1);
      setUnitPrice('');
      setNotes('');
      setAllowNegative(false);
    }
  }, [open]);

  useEffect(() => {
    if (product) setUnitPrice(String(product.sale_price));
  }, [product]);

  const submit = async (event) => {
    event.preventDefault();
    if (!product) return;
    setSaving(true);
    try {
      const data = await api.post(`/orders/${order.id}/parts`, {
        product_id: product.id,
        quantity: Number(quantity),
        unit_price: Number(unitPrice) || 0,
        notes: notes || null,
        allow_negative: allowNegative,
      });
      toast.success(data.message);
      if (data.warning) toast.warning(data.warning);
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const insufficient = product && Number(quantity) > Number(product.stock);

  return (
    <Modal open={open} onClose={onClose} title="Agregar repuesto" subtitle="Se descuenta automáticamente del inventario." size="md" footer={<ModalActions onCancel={onClose} submitLabel="Agregar repuesto" saving={saving} formId="part-form" />}>
      <form id="part-form" onSubmit={submit} className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8"><span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-tech-400" /></div>
        ) : (
          <>
            <div>
              <label className="label">Buscar repuesto</label>
              <input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nombre, SKU o marca…" />
            </div>
            <div>
              <label className="label">Producto</label>
              <select className="select" value={productId} onChange={(event) => setProductId(event.target.value)} required>
                <option value="">Seleccionar repuesto…</option>
                {filtered.map((item) => (
                  <option key={item.id} value={item.id} disabled={!item.stock && !isAdmin}>{item.name} · stock {item.stock}{item.sku ? ` · ${item.sku}` : ''}</option>
                ))}
              </select>
              {filtered.length === 0 && <p className="mt-1 text-[11px] text-amber-400">No se encontraron productos con esa búsqueda.</p>}
            </div>
            {product && (
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs sm:grid-cols-3">
                <div><p className="text-[10px] uppercase tracking-wider text-slate-500">Stock disponible</p><p className={classNames('mt-1 font-semibold', product.stock > 0 ? 'text-emerald-400' : 'text-rose-400')}>{product.stock} unidades</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-slate-500">Costo</p><p className="mt-1 font-semibold text-slate-200">{formatMoney(product.purchase_price)}</p></div>
                <div><p className="text-[10px] uppercase tracking-wider text-slate-500">Venta</p><p className="mt-1 font-semibold text-slate-200">{formatMoney(product.sale_price)}</p></div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Cantidad</label><input type="number" min="1" step="1" className="input" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></div>
              <div><label className="label">Precio unitario</label><input type="number" min="0" step="0.01" className="input" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} required /></div>
            </div>
            {insufficient && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3">
                <p className="text-[11px] leading-relaxed text-amber-200/80">El stock disponible es menor a la cantidad solicitada. Para continuar, un administrador debe autorizar stock negativo.</p>
                {isAdmin && (
                  <label className="mt-2 flex items-center gap-2 text-xs font-medium text-amber-200">
                    <input type="checkbox" className="checkbox" checked={allowNegative} onChange={(event) => setAllowNegative(event.target.checked)} />
                    Autorizar stock negativo explícitamente
                  </label>
                )}
              </div>
            )}
            <div><label className="label">Notas</label><input className="input" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Opcional" /></div>
          </>
        )}
      </form>
    </Modal>
  );
}

function PaymentModal({ open, onClose, order, meta, onSaved }) {
  const { toast } = useUI();
  const [form, setForm] = useState({ amount: '', method: 'EFECTIVO', payment_type: 'PAGO_PARCIAL', reference: '', notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        amount: order.balance > 0 ? String(order.balance) : '',
        method: 'EFECTIVO',
        payment_type: order.paid_total > 0 ? 'PAGO_FINAL' : 'SENA',
        reference: '',
        notes: '',
      });
    }
  }, [open, order.balance, order.paid_total]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api.post(`/orders/${order.id}/payments`, {
        ...form,
        amount: Number(form.amount),
      });
      toast.success(data.message);
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Registrar pago" subtitle={`Saldo pendiente actual: ${formatMoney(order.balance)}`} size="sm" footer={<ModalActions onCancel={onClose} submitLabel="Registrar pago" saving={saving} formId="payment-form" />}>
      <form id="payment-form" onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Importe</label>
          <div className="relative"><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span><input type="number" min="0.01" step="0.01" className="input pl-8" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required autoFocus /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Método</label><select className="select" value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })}>{PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}</select></div>
          <div><label className="label">Tipo</label><select className="select" value={form.payment_type} onChange={(event) => setForm({ ...form, payment_type: event.target.value })}>{PAYMENT_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></div>
        </div>
        <div><label className="label">Referencia / comprobante</label><input className="input" value={form.reference} onChange={(event) => setForm({ ...form, reference: event.target.value })} placeholder="Opcional" /></div>
        <div><label className="label">Notas</label><textarea className="textarea" rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Opcional" /></div>
        <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.05] p-3 text-[11px] leading-relaxed text-amber-200/70">
          Al confirmar se registra un ingreso real en finanzas y se recalcula el saldo de la orden.
        </div>
      </form>
    </Modal>
  );
}

function PhotoModal({ open, onClose, order, onSaved }) {
  const { toast } = useUI();
  const [photos, setPhotos] = useState([]);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) setPhotos([]);
  }, [open]);

  const add = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    try {
      const next = [];
      for (const file of files.slice(0, 6 - photos.length)) next.push({ data_url: await fileToDataUrl(file), label: 'Foto de orden' });
      setPhotos((current) => [...current, ...next]);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!photos.length) return;
    setSaving(true);
    try {
      const data = await api.post(`/orders/${order.id}/photos`, { photos });
      toast.success(data.message);
      onSaved();
      onClose();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Agregar fotografías" subtitle="Sumá imágenes del estado o del avance de la reparación." size="md" footer={<ModalActions onCancel={onClose} submitLabel="Subir fotografías" saving={saving} formId="photo-form" />}>
      <form id="photo-form" onSubmit={submit}>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <div key={index} className="relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10">
              <img src={photo.data_url} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))} className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-black/70 text-white hover:bg-rose-500"><Trash2 size={13} /></button>
            </div>
          ))}
          {photos.length < 6 && (
            <button type="button" onClick={() => inputRef.current?.click()} className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 text-slate-500 hover:border-tech-500/40 hover:text-tech-300">
              <ImagePlus size={22} /><span className="text-[11px] font-semibold">Agregar</span>
            </button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={add} />
      </form>
    </Modal>
  );
}

function RevealModal({ open, onClose, order }) {
  const { toast } = useUI();
  const [secret, setSecret] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setSecret(null);
      setError('');
    }
  }, [open]);

  const reveal = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.post(`/orders/${order.id}/reveal-unlock`);
      setSecret(data);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret.unlock_secret);
      toast.success('Dato copiado al portapapeles.');
    } catch {
      toast.error('No se pudo copiar automáticamente.');
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Dato de desbloqueo" subtitle="Información cifrada. El acceso a este dato queda registrado en la auditoría." size="sm">
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-[11px] leading-relaxed text-amber-200/80">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" /> Usá este dato solo para tareas técnicas autorizadas. No lo compartas con terceros.
        </div>
        {!secret ? (
          <button type="button" className="btn-primary w-full" onClick={reveal} disabled={loading}>
            {loading ? 'Descifrando…' : <><Eye size={16} /> Mostrar dato protegido</>}
          </button>
        ) : (
          <div className="rounded-xl border border-white/10 bg-ink-900 p-4">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">{secret.unlock_type || 'Dato de desbloqueo'}</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all font-mono text-lg text-white">{secret.unlock_secret}</code>
              <button type="button" className="icon-btn h-9 w-9 border border-white/10" onClick={copy} title="Copiar"><Copy size={15} /></button>
            </div>
          </div>
        )}
        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    </Modal>
  );
}

function Progress({ status }) {
  const current = PROGRESS_STEPS.findIndex((step) => step.statuses.includes(status));
  const final = ['ENTREGADO', 'CANCELADO', 'SIN_REPARACION'].includes(status);
  return (
    <div className="flex items-center gap-0.5">
      {PROGRESS_STEPS.map((step, index) => {
        const complete = current > index || (final && status === 'ENTREGADO' && index < PROGRESS_STEPS.length) || (current === index && status === 'ENTREGADO');
        const active = current === index && !final;
        return (
          <div key={step.label} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center">
              <div className={classNames('h-0.5 flex-1', index === 0 ? 'bg-transparent' : complete || active ? 'bg-tech-500/50' : 'bg-white/[0.06]')} />
              <div className={classNames('flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[9px] font-bold', complete ? 'border-tech-500 bg-tech-600 text-white' : active ? 'border-tech-400 bg-tech-500/20 text-tech-300' : 'border-white/10 bg-ink-900 text-slate-600')}>
                {complete ? <Check size={11} /> : index + 1}
              </div>
              <div className={classNames('h-0.5 flex-1', index === PROGRESS_STEPS.length - 1 ? 'bg-transparent' : complete ? 'bg-tech-500/50' : 'bg-white/[0.06]')} />
            </div>
            <span className={classNames('text-[9px] font-medium', complete || active ? 'text-slate-300' : 'text-slate-600')}>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function OrderDetail() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast, confirm } = useUI();
  const { data: meta } = useApiQuery('/meta');
  const { data, loading, error, refetch } = useApiQuery(`/orders/${id}`);
  const [tab, setTab] = useState('summary');
  const [modal, setModal] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [createdBanner, setCreatedBanner] = useState(Boolean(location.state?.created));

  useDocumentTitle(data ? `${data.order.order_number}` : 'Orden');

  useEffect(() => {
    if (createdBanner) {
      navigate(location.pathname, { replace: true, state: null });
      window.setTimeout(() => setCreatedBanner(false), 6000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading && !data) return <LoadingScreen label="Cargando orden de reparación…" />;
  if (error && !data) {
    return <EmptyState icon={AlertTriangle} title="No se pudo cargar la orden" description={error.message} action={<button className="btn-primary" onClick={refetch}>Reintentar</button>} />;
  }

  const { order, client, statusHistory, interventions, parts, payments, photos } = data;
  const isClosed = ['ENTREGADO', 'CANCELADO'].includes(order.status);

  const downloadReceipt = async () => {
    setDownloading(true);
    try {
      await downloadFile(`/orders/${order.id}/receipt.pdf`, `comprobante-${order.order_number}.pdf`);
      toast.success('Comprobante descargado. Podés imprimirlo desde tu lector de PDF.');
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setDownloading(false);
    }
  };

  const removePart = async (part) => {
    const accepted = await confirm({
      title: 'Quitar repuesto',
      message: `Se quitará “${part.name}” de la orden y se restituirá el stock. Esta acción queda registrada.`,
      confirmLabel: 'Quitar repuesto',
    });
    if (!accepted) return;
    try {
      const response = await api.delete(`/orders/${order.id}/parts/${part.id}`);
      toast.success(response.message);
      refetch();
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const removePayment = async (payment) => {
    const accepted = await confirm({
      title: 'Anular pago',
      message: `Se anulará el pago de ${formatMoney(payment.amount)}. El saldo de la orden se recalculará y el ingreso quedará anulado en finanzas.`,
      confirmLabel: 'Anular pago',
    });
    if (!accepted) return;
    try {
      const response = await api.delete(`/orders/${order.id}/payments/${payment.id}`);
      toast.success(response.message);
      refetch();
    } catch (requestError) {
      toast.error(requestError.message);
    }
  };

  const deleteOrder = async () => {
    const accepted = await confirm({
      title: `Eliminar ${order.order_number}`,
      message: 'Se eliminará la orden de forma definitiva. Si tiene pagos, esos ingresos se anularán y los repuestos volverán al inventario. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar definitivamente',
      tone: 'danger',
    });
    if (!accepted) return;
    setDeleting(true);
    try {
      const response = await api.delete(`/orders/${order.id}`);
      toast.success(response.message);
      navigate('/ordenes', { replace: true });
    } catch (requestError) {
      toast.error(requestError.message);
      setDeleting(false);
    }
  };

  const tabs = TABS.map((item) => ({
    ...item,
    count:
      item.value === 'interventions' ? interventions.length
        : item.value === 'parts' ? parts.length
          : item.value === 'payments' ? payments.length
            : item.value === 'history' ? statusHistory.length
              : undefined,
  }));

  return (
    <div className="animate-fade-in">
      {createdBanner && (
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4">
          <BadgeCheck size={20} className="mt-0.5 shrink-0 text-emerald-400" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-100">Ingreso registrado correctamente</p>
            <p className="mt-0.5 text-xs text-emerald-200/70">La orden {order.order_number} fue generada. Descargá el comprobante de recepción para entregar al cliente.</p>
          </div>
          <button type="button" onClick={() => setCreatedBanner(false)} className="text-emerald-300/60 hover:text-emerald-200"><span className="sr-only">Cerrar</span>×</button>
        </div>
      )}

      <PageHeader
        eyebrow={`Orden de reparación · ${formatDate(order.intake_at)}`}
        title={order.order_number}
        subtitle={`${order.brand} ${order.model} · ${order.equipment_type_name} · ${order.client_name}`}
        backTo="/ordenes"
        icon={ClipboardList}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={downloadReceipt} disabled={downloading}>
              <Printer size={16} /> <span className="hidden sm:inline">{downloading ? 'Generando…' : 'Comprobante PDF'}</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                className="btn-ghost text-rose-300 hover:bg-rose-500/10 hover:text-rose-200"
                onClick={deleteOrder}
                disabled={deleting}
                title="Eliminar esta orden"
              >
                <Trash2 size={16} />
                <span className="hidden sm:inline">{deleting ? 'Eliminando…' : 'Eliminar'}</span>
              </button>
            )}
            <button type="button" className="btn-primary" onClick={() => setModal('status')} disabled={isClosed && order.status === 'CANCELADO'}>
              <ArrowRightLeft size={16} /> Cambiar estado
            </button>
          </>
        }
      >
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StatusBadge status={order.status} />
          <PriorityBadge priority={order.priority} />
          {order.estimated_delivery && <span className="label-chip"><Calendar size={12} /> Entrega estimada {formatDate(order.estimated_delivery)}</span>}
          {order.balance > 0 && <span className="badge border-amber-500/20 bg-amber-500/10 text-amber-300">Saldo {formatMoney(order.balance)}</span>}
        </div>
      </PageHeader>

      <div className="mb-4 hidden sm:block">
        <div className="card p-4">
          <Progress status={order.status} />
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <Tabs tabs={tabs} active={tab} onChange={setTab} />
        <div className="flex flex-wrap items-center gap-2">
          {!isClosed && (
            <>
              <button type="button" className="btn-secondary btn-sm flex-1 sm:flex-none" onClick={() => setModal('payment')}><CreditCard size={14} /> Registrar pago</button>
              <button type="button" className="btn-secondary btn-sm flex-1 sm:flex-none" onClick={() => setModal('part')}><Package size={14} /> Repuesto</button>
              <button type="button" className="btn-secondary btn-sm flex-1 sm:flex-none" onClick={() => setModal('intervention')}><Wrench size={14} /> Intervención</button>
            </>
          )}
          <button type="button" className="btn-ghost btn-sm" onClick={() => setModal('edit')}><Pencil size={14} /> Editar</button>
        </div>
      </div>

      {tab === 'summary' && (
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            <div className="card">
              <SectionHeader title="Datos del equipo" icon={Wrench} actions={<button type="button" className="btn-ghost btn-sm" onClick={() => setModal('edit')}><Pencil size={13} /> Editar</button>} />
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 p-4 sm:grid-cols-3 sm:p-5">
                <DetailField label="Tipo">{order.equipment_type_name}</DetailField>
                <DetailField label="Marca">{order.brand}</DetailField>
                <DetailField label="Modelo">{order.model}</DetailField>
                <DetailField label="Número de serie">{order.serial_number}</DetailField>
                <DetailField label="IMEI">{order.imei}</DetailField>
                <DetailField label="Color">{order.color}</DetailField>
                <DetailField label="Accesorios" className="col-span-2 sm:col-span-3">{order.accessories}</DetailField>
                <DetailField label="Técnico">{order.technician_name || 'Sin asignar'}</DetailField>
                <DetailField label="Ingreso">{formatDateTime(order.intake_at)}</DetailField>
                <DetailField label="Entrega estimada">{order.estimated_delivery ? formatDate(order.estimated_delivery) : 'Sin fecha'}</DetailField>
              </dl>
            </div>

            <div className="card">
              <SectionHeader title="Diagnóstico y estado" icon={FileText} />
              <div className="space-y-4 p-4 sm:p-5">
                <div><p className="eyebrow mb-1">Falla declarada</p><p className="text-sm leading-relaxed text-slate-200">{order.declared_issue}</p></div>
                {order.detailed_problem && <div><p className="eyebrow mb-1">Descripción del problema</p><p className="whitespace-pre-line text-sm leading-relaxed text-slate-400">{order.detailed_problem}</p></div>}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><p className="eyebrow mb-1">Estado físico</p><p className="text-sm leading-relaxed text-slate-300">{order.physical_condition || '—'}</p></div>
                  <div><p className="eyebrow mb-1">Daños visibles</p><p className="text-sm leading-relaxed text-slate-300">{order.visible_damage || '—'}</p></div>
                </div>
                <div className="rounded-xl border border-tech-500/15 bg-tech-500/[0.04] p-3.5">
                  <p className="eyebrow mb-1 text-tech-400">Diagnóstico técnico</p>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-300">{order.initial_diagnosis || 'Pendiente de diagnóstico.'}</p>
                </div>
                {order.internal_notes && <div><p className="eyebrow mb-1">Observaciones internas</p><p className="whitespace-pre-line text-sm leading-relaxed text-slate-400">{order.internal_notes}</p></div>}
              </div>
            </div>

            <div className="card">
              <SectionHeader
                title="Fotografías"
                subtitle={`${photos.length} imagen${photos.length === 1 ? '' : 'es'} adjunta${photos.length === 1 ? '' : 's'}`}
                icon={ImagePlus}
                actions={<button type="button" className="btn-ghost btn-sm" onClick={() => setModal('photos')}><Plus size={13} /> Agregar</button>}
              />
              {photos.length === 0 ? (
                <EmptyState icon={ImagePlus} title="Sin fotografías" description="Agregá imágenes del estado del equipo al ingresar." className="!py-8" action={<button className="btn-secondary btn-sm" onClick={() => setModal('photos')}>Subir fotos</button>} />
              ) : (
                <div className="grid grid-cols-2 gap-2.5 p-4 sm:grid-cols-3 sm:p-5">
                  {photos.map((photo) => (
                    <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-white/[0.08] bg-ink-900">
                      <img src={photo.url} alt={photo.label || 'Fotografía del equipo'} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-transparent transition group-hover:bg-black/30 group-hover:text-white"><Eye size={20} /></span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="card">
              <SectionHeader title="Cliente" icon={UserRound} actions={<Link to={`/clientes/${client.id}`} className="text-[11px] font-semibold text-tech-400">Ver ficha</Link>} />
              <div className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-gradient-to-br from-tech-500/20 to-slate-700/30 text-sm font-bold text-tech-200">{client.first_name?.[0]}{client.last_name?.[0]}</div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-white">{client.first_name} {client.last_name}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{client.dni ? `DNI ${client.dni}` : 'Sin DNI registrado'}</p>
                  </div>
                </div>
                <div className="mt-4 space-y-2 text-xs text-slate-400">
                  <p className="flex items-center gap-2"><Phone size={13} className="text-slate-600" /> {client.phone}</p>
                  {client.email && <p className="flex items-center gap-2 break-all"><Mail size={13} className="shrink-0 text-slate-600" /> {client.email}</p>}
                  {client.address && <p className="flex items-start gap-2"><MapPin size={13} className="mt-0.5 shrink-0 text-slate-600" /> {client.address}</p>}
                </div>
                {order.has_unlock ? (
                  <button type="button" className="btn-secondary btn-sm mt-4 w-full" onClick={() => setModal('unlock')}><LockKeyhole size={14} /> Ver dato de desbloqueo</button>
                ) : (
                  <p className="mt-4 flex items-center gap-1.5 text-[10px] text-slate-600"><EyeOff size={12} /> Sin dato de desbloqueo registrado</p>
                )}
              </div>
            </div>

            <div className="card">
              <SectionHeader title="Resumen económico" icon={Receipt} />
              <div className="space-y-2.5 p-4 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Presupuesto estimado</span><span className="font-semibold text-slate-200">{formatMoney(order.estimated_budget)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Precio final</span><span className="font-semibold text-slate-200">{formatMoney(order.final_price)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Repuestos</span><span className="font-semibold text-slate-300">{formatMoney(order.parts_total)}</span></div>
                <div className="flex justify-between"><span className="text-slate-500">Mano de obra (costo)</span><span className="font-semibold text-slate-300">{formatMoney(order.labor_cost)}</span></div>
                <div className="divider my-1" />
                <div className="flex justify-between text-sm"><span className="font-medium text-slate-300">Cobrado</span><span className="font-bold text-emerald-400">{formatMoney(order.paid_total)}</span></div>
                <div className="flex justify-between text-sm"><span className="font-medium text-slate-300">Saldo pendiente</span><span className={`font-bold ${order.balance > 0 ? 'text-amber-300' : 'text-emerald-400'}`}>{formatMoney(order.balance)}</span></div>
                {!isClosed && <button type="button" className="btn-primary btn-sm mt-2 w-full" onClick={() => setModal('payment')}><CreditCard size={14} /> Registrar pago</button>}
              </div>
            </div>

            <div className="card">
              <SectionHeader title="Último movimiento" icon={Clock3} actions={<button type="button" className="text-[11px] font-semibold text-tech-400" onClick={() => setTab('history')}>Ver todo</button>} />
              <div className="p-4">
                {statusHistory[0] ? (
                  <div>
                    <div className="flex items-center gap-2"><StatusBadge status={statusHistory[0].to_status} /><span className="text-[10px] text-slate-500">{formatDateTime(statusHistory[0].created_at)}</span></div>
                    <p className="mt-2 text-xs leading-relaxed text-slate-400">{statusHistory[0].note || 'Cambio de estado registrado.'}</p>
                    <p className="mt-1 text-[10px] text-slate-600">por {statusHistory[0].changed_by_name || 'Sistema'}</p>
                  </div>
                ) : <p className="text-xs text-slate-500">Sin movimientos.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'interventions' && (
        <div className="card overflow-hidden">
          <SectionHeader title="Historial de intervenciones" subtitle={`${interventions.length} registros técnicos`} icon={Wrench} actions={<button type="button" className="btn-primary btn-sm" onClick={() => setModal('intervention')}><Plus size={14} /> Agregar</button>} />
          {interventions.length === 0 ? (
            <EmptyState icon={Wrench} title="Sin intervenciones" description="Registrá diagnósticos, reparaciones y pruebas para mantener el historial completo." action={<button className="btn-primary btn-sm" onClick={() => setModal('intervention')}>Agregar intervención</button>} />
          ) : (
            <div className="divide-y divide-white/[0.05]">
              {interventions.map((item) => (
                <div key={item.id} className="flex gap-3.5 p-4 sm:p-5">
                  <div className={classNames('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border', item.type === 'DIAGNOSTICO' ? 'border-sky-500/20 bg-sky-500/10 text-sky-400' : item.type === 'REPARACION' ? 'border-tech-500/20 bg-tech-500/10 text-tech-400' : item.type === 'PRUEBA' ? 'border-cyan-500/20 bg-cyan-500/10 text-cyan-400' : 'border-slate-500/20 bg-slate-500/10 text-slate-400')}>
                    {item.type === 'DIAGNOSTICO' ? <ClipboardList size={16} /> : item.type === 'REPARACION' ? <Wrench size={16} /> : item.type === 'PRUEBA' ? <CheckCircle2 size={16} /> : <FileText size={16} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">{{ DIAGNOSTICO: 'Diagnóstico', REPARACION: 'Reparación', PRUEBA: 'Prueba', NOTA: 'Nota' }[item.type]}</span>
                      <span className="text-[10px] text-slate-500">{formatDateTime(item.created_at)}</span>
                    </div>
                    <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-300">{item.description}</p>
                    <p className="mt-1.5 text-[10px] text-slate-600">{item.technician_name ? `Técnico: ${item.technician_name}` : 'Sin técnico'} · Registrado por {item.created_by_name || 'Sistema'}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'parts' && (
        <div className="card overflow-hidden">
          <SectionHeader
            title="Repuestos utilizados"
            subtitle={`${parts.length} ítems · costo ${formatMoney(order.parts_cost)} · venta ${formatMoney(order.parts_total)}`}
            icon={Package}
            actions={!isClosed && <button type="button" className="btn-primary btn-sm" onClick={() => setModal('part')}><Plus size={14} /> Agregar</button>}
          />
          {parts.length === 0 ? (
            <EmptyState icon={Package} title="Sin repuestos utilizados" description="Al agregar un repuesto se descuenta automáticamente del inventario." action={!isClosed && <button className="btn-primary btn-sm" onClick={() => setModal('part')}>Agregar repuesto</button>} />
          ) : (
            <div className="table-wrapper">
              <table className="data-table min-w-[700px]">
                <thead><tr><th>Repuesto</th><th className="text-right">Cantidad</th><th className="text-right">Costo unit.</th><th className="text-right">Precio unit.</th><th className="text-right">Subtotal</th><th>Agregado</th>{isAdmin && <th />}</tr></thead>
                <tbody>
                  {parts.map((part) => (
                    <tr key={part.id}>
                      <td><p className="text-xs font-medium text-slate-200">{part.name}</p><p className="mt-0.5 text-[10px] text-slate-500">{part.sku || 'Sin SKU'} · {part.product_brand || ''} {part.product_model || ''}</p></td>
                      <td className="text-right text-xs">{part.quantity}</td>
                      <td className="text-right text-xs text-slate-400">{formatMoney(part.unit_cost)}</td>
                      <td className="text-right text-xs">{formatMoney(part.unit_price)}</td>
                      <td className="text-right text-xs font-semibold text-slate-200">{formatMoney(Number(part.quantity) * Number(part.unit_price))}</td>
                      <td className="text-[10px] text-slate-500">{formatDate(part.created_at)}</td>
                      {isAdmin && <td><button type="button" className="icon-btn h-8 w-8 text-slate-500 hover:text-rose-400" onClick={() => removePart(part)} title="Quitar repuesto"><Trash2 size={14} /></button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'payments' && (
        <div className="card overflow-hidden">
          <SectionHeader
            title="Pagos de la orden"
            subtitle={`Cobrado ${formatMoney(order.paid_total)} de ${formatMoney(order.billable)}`}
            icon={CreditCard}
            actions={!isClosed && <button type="button" className="btn-primary btn-sm" onClick={() => setModal('payment')}><Plus size={14} /> Registrar pago</button>}
          />
          <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">Total facturado</p><p className="mt-1 text-lg font-bold text-white">{formatMoney(order.billable)}</p></div>
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] p-3"><p className="text-[10px] uppercase tracking-wider text-emerald-500/80">Cobrado</p><p className="mt-1 text-lg font-bold text-emerald-300">{formatMoney(order.paid_total)}</p></div>
            <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.05] p-3"><p className="text-[10px] uppercase tracking-wider text-amber-500/80">Saldo</p><p className="mt-1 text-lg font-bold text-amber-300">{formatMoney(order.balance)}</p></div>
          </div>
          {payments.length === 0 ? (
            <EmptyState icon={CreditCard} title="Sin pagos registrados" description="La seña y los pagos parciales se reflejan automáticamente en finanzas." />
          ) : (
            <div className="table-wrapper">
              <table className="data-table min-w-[650px]">
                <thead><tr><th>Fecha</th><th>Tipo</th><th>Método</th><th>Referencia</th><th className="text-right">Importe</th><th>Registró</th>{isAdmin && <th />}</tr></thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="whitespace-nowrap text-xs">{formatDateTime(payment.received_at)}</td>
                      <td><span className="badge border-tech-500/20 bg-tech-500/10 text-tech-300">{PAYMENT_TYPE_LABELS[payment.payment_type] || payment.payment_type}</span></td>
                      <td className="text-xs">{PAYMENT_METHOD_LABELS[payment.method] || payment.method}</td>
                      <td className="text-xs text-slate-400">{payment.reference || '—'}</td>
                      <td className="text-right text-xs font-semibold text-emerald-400">{formatMoney(payment.amount)}</td>
                      <td className="text-[10px] text-slate-500">{payment.created_by_name || 'Sistema'}</td>
                      {isAdmin && <td><button type="button" className="icon-btn h-8 w-8 text-slate-500 hover:text-rose-400" onClick={() => removePayment(payment)} title="Anular pago"><Trash2 size={14} /></button></td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="card overflow-hidden">
          <SectionHeader title="Historial de estados" subtitle="Cada cambio queda registrado con fecha, hora y usuario." icon={History} />
          <div className="p-4 sm:p-5">
            <div className="relative space-y-5 before:absolute before:bottom-2 before:left-[15px] before:top-2 before:w-px before:bg-white/[0.07]">
              {statusHistory.map((item, index) => (
                <div key={item.id} className="relative flex gap-3.5">
                  <div className={classNames('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border', index === 0 ? 'border-tech-500/40 bg-tech-500/15 text-tech-300' : 'border-white/[0.08] bg-ink-850 text-slate-500')}>
                    <CheckCircle2 size={14} />
                  </div>
                  <div className="min-w-0 flex-1 pb-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.from_status && <><span className="text-[10px] text-slate-500">{STATUS_META[item.from_status]?.label}</span><span className="text-slate-600">→</span></>}
                        <StatusBadge status={item.to_status} />
                      </div>
                      <span className="text-[10px] text-slate-500">{formatDateTime(item.created_at)}</span>
                    </div>
                    {item.note && <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{item.note}</p>}
                    <p className="mt-1 text-[10px] text-slate-600">por {item.changed_by_name || 'Sistema'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <StatusModal open={modal === 'status'} onClose={() => setModal(null)} order={order} onSaved={refetch} />
      <EditModal open={modal === 'edit'} onClose={() => setModal(null)} order={order} meta={meta} onSaved={refetch} />
      <InterventionModal open={modal === 'intervention'} onClose={() => setModal(null)} order={order} meta={meta} onSaved={() => { refetch(); setTab('interventions'); }} />
      <PartModal open={modal === 'part'} onClose={() => setModal(null)} order={order} meta={meta} onSaved={() => { refetch(); setTab('parts'); }} />
      <PaymentModal open={modal === 'payment'} onClose={() => setModal(null)} order={order} meta={meta} onSaved={() => { refetch(); setTab('payments'); }} />
      <PhotoModal open={modal === 'photos'} onClose={() => setModal(null)} order={order} onSaved={refetch} />
      {order.has_unlock && <RevealModal open={modal === 'unlock'} onClose={() => setModal(null)} order={order} />}
    </div>
  );
}
