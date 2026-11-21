import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Camera,
  Check,
  ChevronDown,
  ClipboardCheck,
  FileText,
  ImagePlus,
  Info,
  LockKeyhole,
  Package,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UserRoundSearch,
  Wallet,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { useApiQuery, useDocumentTitle } from '../hooks/useApi.js';
import { useUI } from '../context/UIProvider.jsx';
import { api } from '../lib/api.js';
import { classNames, fileToDataUrl, formatMoney, todayISO } from '../lib/format.js';
import { PRIORITIES, PRIORITY_META } from '../lib/constants.js';
import { PageHeader } from '../components/ui.jsx';
import Modal from '../components/Modal.jsx';

const UNLOCK_TYPES = [
  { value: '', label: 'Sin dato de desbloqueo' },
  { value: 'Contraseña', label: 'Contraseña / PIN numérico' },
  { value: 'Patrón', label: 'Patrón de desbloqueo' },
  { value: 'Cuenta', label: 'Cuenta vinculada (Google / Apple)' },
  { value: 'Otro', label: 'Otro método' },
];

function localDateTimeNow() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function Field({ label, required, error, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label className="label">
        {label} {required && <span className="text-rose-400">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-[11px] text-rose-400">{error}</p>}
      {hint && !error && <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{hint}</p>}
    </div>
  );
}

function Section({ icon: Icon, title, description, children, className = '' }) {
  return (
    <section className={classNames('card overflow-hidden', className)}>
      <div className="flex items-start gap-3 border-b border-white/[0.06] px-4 py-3.5 sm:px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-tech-500/15 bg-tech-500/10 text-tech-400">
          <Icon size={16} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          {description && <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500">{description}</p>}
        </div>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

const EMPTY_CLIENT = { first_name: '', last_name: '', phone: '', email: '', dni: '', address: '', notes: '' };

export default function NewOrder() {
  useDocumentTitle('Ingreso de equipo');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedClientId = searchParams.get('client_id');
  const { toast } = useUI();
  const { data: meta } = useApiQuery('/meta');
  const [form, setForm] = useState({
    client_id: preselectedClientId ? Number(preselectedClientId) : '',
    client: { ...EMPTY_CLIENT },
    equipment_type_id: '',
    brand: '',
    model: '',
    serial_number: '',
    imei: '',
    color: '',
    accessories: '',
    unlock_type: '',
    unlock_secret: '',
    intake_at: localDateTimeNow(),
    declared_issue: '',
    detailed_problem: '',
    physical_condition: '',
    visible_damage: '',
    initial_diagnosis: '',
    technician_id: '',
    priority: 'NORMAL',
    estimated_budget: '',
    estimated_delivery: '',
    internal_notes: '',
    deposit_amount: '',
    payment_method: 'EFECTIVO',
  });
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState(null);
  const [duplicateClient, setDuplicateClient] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showMobileSummary, setShowMobileSummary] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const clientBoxRef = useRef(null);
  const { data: preselectedData } = useApiQuery(`/clients/${preselectedClientId}`, { enabled: Boolean(preselectedClientId) });

  useEffect(() => {
    if (preselectedData?.client) {
      setSelectedClient(preselectedData.client);
      setForm((current) => ({ ...current, client_id: preselectedData.client.id }));
    }
  }, [preselectedData]);

  useEffect(() => {
    if (!clientQuery.trim() || !searchOpen) {
      setClientResults([]);
      return undefined;
    }
    const timer = window.setTimeout(async () => {
      setClientSearching(true);
      try {
        const data = await api.get(`/clients/quick?q=${encodeURIComponent(clientQuery.trim())}`);
        setClientResults(data.clients || []);
      } catch {
        setClientResults([]);
      } finally {
        setClientSearching(false);
      }
    }, 280);
    return () => window.clearTimeout(timer);
  }, [clientQuery, searchOpen]);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setApiError(null);
  };

  const setClientField = (field, value) => {
    setForm((current) => ({ ...current, client: { ...current.client, [field]: value } }));
    setErrors((current) => ({ ...current, [`client.${field}`]: undefined }));
    setDuplicateClient(null);
  };

  const chooseClient = (client) => {
    setSelectedClient(client);
    setForm((current) => ({ ...current, client_id: client.id, client: { ...EMPTY_CLIENT } }));
    setClientQuery('');
    setSearchOpen(false);
    setErrors((current) => ({ ...current, client_id: undefined }));
    setDuplicateClient(null);
  };

  const clearClient = () => {
    setSelectedClient(null);
    setForm((current) => ({ ...current, client_id: '' }));
  };

  const handlePhoto = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (photos.length + files.length > 6) {
      toast.warning('Podés adjuntar hasta 6 fotografías.');
      event.target.value = '';
      return;
    }
    setPhotoBusy(true);
    try {
      const converted = [];
      for (const [index, file] of files.entries()) {
        const dataUrl = await fileToDataUrl(file);
        converted.push({ data_url: dataUrl, preview: dataUrl, label: `Foto ${photos.length + index + 1}` });
      }
      setPhotos((current) => [...current, ...converted]);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPhotoBusy(false);
      event.target.value = '';
    }
  };

  const budget = Number(form.estimated_budget) || 0;
  const deposit = Number(form.deposit_amount) || 0;
  const balance = Math.max(budget - deposit, 0);
  const selectedType = meta?.equipmentTypes?.find((type) => type.id === Number(form.equipment_type_id));
  const selectedTechnician = meta?.technicians?.find((technician) => technician.id === Number(form.technician_id));

  const validate = () => {
    const next = {};
    if (!selectedClient) {
      if (!form.client.first_name.trim()) next['client.first_name'] = 'Ingresá el nombre.';
      if (!form.client.last_name.trim()) next['client.last_name'] = 'Ingresá el apellido.';
      if (!form.client.phone.trim()) next['client.phone'] = 'Ingresá el teléfono.';
      else if (form.client.phone.replace(/\D/g, '').length < 6) next['client.phone'] = 'Ingresá un teléfono válido.';
    }
    if (!form.equipment_type_id) next.equipment_type_id = 'Seleccioná el tipo de equipo.';
    if (!form.brand.trim()) next.brand = 'Ingresá la marca.';
    if (!form.model.trim()) next.model = 'Ingresá el modelo.';
    if (!form.declared_issue.trim()) next.declared_issue = 'Describí la falla declarada.';
    if (deposit > budget) next.deposit_amount = 'La seña no puede superar el presupuesto estimado.';
    setErrors(next);
    if (Object.keys(next).length) {
      toast.warning('Revisá los campos obligatorios del formulario.');
      const first = document.querySelector(`[data-error="true"]`);
      first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    return true;
  };

  const submit = async (event) => {
    event.preventDefault();
    setApiError(null);
    setDuplicateClient(null);
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        client_id: selectedClient?.id || undefined,
        client: selectedClient ? undefined : form.client,
        equipment_type_id: Number(form.equipment_type_id),
        brand: form.brand,
        model: form.model,
        serial_number: form.serial_number || null,
        imei: form.imei || null,
        color: form.color || null,
        accessories: form.accessories || null,
        unlock_type: form.unlock_type || null,
        unlock_secret: form.unlock_secret || null,
        intake_at: form.intake_at || null,
        declared_issue: form.declared_issue,
        detailed_problem: form.detailed_problem || null,
        physical_condition: form.physical_condition || null,
        visible_damage: form.visible_damage || null,
        initial_diagnosis: form.initial_diagnosis || null,
        technician_id: form.technician_id ? Number(form.technician_id) : null,
        priority: form.priority,
        estimated_budget: budget,
        estimated_delivery: form.estimated_delivery || null,
        internal_notes: form.internal_notes || null,
        deposit_amount: deposit,
        payment_method: form.payment_method,
        photos: photos.map((photo) => ({ data_url: photo.data_url, label: photo.label })),
      };
      const data = await api.post('/orders', payload);
      toast.success(data.message || 'Equipo ingresado correctamente.');
      navigate(`/ordenes/${data.order.id}`, { state: { created: true } });
    } catch (error) {
      setApiError(error.message);
      if (error.details && !Array.isArray(error.details) && error.details.existingClient) {
        setDuplicateClient(error.details.existingClient);
      }
      if (Array.isArray(error.details)) {
        const mapped = {};
        for (const detail of error.details) mapped[detail.field] = detail.message;
        setErrors((current) => ({ ...current, ...mapped }));
      }
      toast.error(error.message);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  const summary = (
    <div className="space-y-3">
      <div className="card overflow-hidden">
        <div className="border-b border-white/[0.06] px-4 py-3.5">
          <h3 className="text-sm font-semibold text-slate-100">Resumen del ingreso</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">Se genera un número de orden automáticamente.</p>
        </div>
        <div className="space-y-3.5 p-4">
          <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-tech-500/10 text-tech-400"><UserRound size={15} /></div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-200">{selectedClient ? `${selectedClient.first_name} ${selectedClient.last_name}` : form.client.first_name || form.client.last_name ? `${form.client.first_name} ${form.client.last_name}`.trim() : 'Cliente sin definir'}</p>
              <p className="truncate text-[10px] text-slate-500">{selectedClient?.phone || form.client.phone || 'Sin teléfono'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.05] bg-white/[0.02] p-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400"><Wrench size={15} /></div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-200">{form.brand || form.model ? `${form.brand} ${form.model}`.trim() : 'Equipo sin definir'}</p>
              <p className="truncate text-[10px] text-slate-500">{selectedType?.name || 'Tipo de dispositivo'}</p>
            </div>
          </div>

          <div className="divider" />
          <dl className="space-y-2 text-xs">
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Presupuesto estimado</dt><dd className="font-semibold text-slate-200">{formatMoney(budget)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Seña recibida</dt><dd className="font-semibold text-emerald-400">{formatMoney(deposit)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Saldo pendiente</dt><dd className="font-semibold text-amber-300">{formatMoney(balance)}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Técnico</dt><dd className="max-w-[55%] truncate font-medium text-slate-300">{selectedTechnician?.name || 'Sin asignar'}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Prioridad</dt><dd className={`badge ${PRIORITY_META[form.priority].style}`}>{PRIORITY_META[form.priority].label}</dd></div>
          </dl>

          <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.06] p-3">
            <p className="flex items-start gap-2 text-[11px] leading-relaxed text-amber-200/80">
              <Info size={14} className="mt-0.5 shrink-0" />
              La seña se registra como ingreso real, pero el saldo sigue pendiente hasta completar el pago.
            </p>
          </div>

          <button type="submit" form="new-order-form" className="btn-primary w-full" disabled={saving}>
            {saving ? 'Registrando ingreso…' : <><Check size={17} /> Confirmar ingreso</>}
          </button>
          <Link to="/ordenes" className="btn-ghost w-full text-xs">Cancelar</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Recepción"
        title="Ingreso de equipo"
        subtitle="Registrá los datos del cliente, el estado del equipo y las condiciones de recepción. Al confirmar se genera la orden y el comprobante."
        icon={ClipboardCheck}
        actions={
          <>
            <Link to="/recepcion" className="btn-secondary xl:hidden"><Zap size={16} /> Rápida</Link>
            <button type="button" className="btn-secondary xl:hidden" onClick={() => setShowMobileSummary(true)}>
              <Wallet size={16} /> Resumen
            </button>
          </>
        }
      />

      {apiError && (
        <div className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
          <p className="font-semibold">{apiError}</p>
          {Array.isArray(apiError.details) && (
            <ul className="mt-1.5 list-inside list-disc text-xs text-rose-300/80">
              {apiError.details.map((detail) => <li key={detail.field}>{detail.message}</li>)}
            </ul>
          )}
          {duplicateClient && (
            <button type="button" className="btn-secondary btn-sm mt-3 border-rose-400/20" onClick={() => chooseClient(duplicateClient)}>
              <UserRoundSearch size={14} /> Usar cliente existente: {duplicateClient.first_name} {duplicateClient.last_name}
            </button>
          )}
        </div>
      )}

      <form id="new-order-form" onSubmit={submit} noValidate>
        <div className="grid gap-4 xl:grid-cols-[1fr_330px]">
          <div className="space-y-4">
            <Section icon={UserRound} title="Cliente" description="Buscá un cliente existente para evitar duplicados o cargá uno nuevo.">
              {selectedClient ? (
                <div className="flex flex-col gap-3 rounded-xl border border-tech-500/20 bg-tech-500/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-tech-500/15 text-sm font-bold text-tech-200">
                      {selectedClient.first_name?.[0]}{selectedClient.last_name?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{selectedClient.first_name} {selectedClient.last_name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">{selectedClient.phone}{selectedClient.email ? ` · ${selectedClient.email}` : ''}</p>
                      {selectedClient.dni && <p className="mt-0.5 text-[10px] text-slate-500">DNI {selectedClient.dni}</p>}
                    </div>
                  </div>
                  <button type="button" className="btn-secondary btn-sm self-start sm:self-auto" onClick={clearClient}>
                    Cambiar cliente
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative" ref={clientBoxRef}>
                    <label className="label">Buscar cliente registrado</label>
                    <div className="relative">
                      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        className="input pl-10"
                        placeholder="Nombre, teléfono o DNI…"
                        value={clientQuery}
                        onFocus={() => setSearchOpen(true)}
                        onChange={(event) => { setClientQuery(event.target.value); setSearchOpen(true); }}
                      />
                      {clientSearching && <span className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-600 border-t-tech-400" />}
                    </div>
                    {searchOpen && clientQuery.trim() && (
                      <div className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-white/10 bg-ink-800 shadow-2xl">
                        {clientResults.length === 0 ? (
                          <p className="px-4 py-3 text-xs text-slate-500">{clientSearching ? 'Buscando…' : 'No se encontraron clientes. Completá los datos para registrar uno nuevo.'}</p>
                        ) : (
                          clientResults.map((client) => (
                            <button
                              key={client.id}
                              type="button"
                              onClick={() => chooseClient(client)}
                              className="flex w-full items-center gap-3 border-b border-white/[0.05] px-4 py-2.5 text-left last:border-0 hover:bg-white/[0.04]"
                            >
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[10px] font-bold text-slate-300">{client.first_name?.[0]}{client.last_name?.[0]}</div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-semibold text-slate-200">{client.first_name} {client.last_name}</p>
                                <p className="truncate text-[10px] text-slate-500">{client.phone}{client.dni ? ` · DNI ${client.dni}` : ''} · {client.orders_count} órdenes</p>
                              </div>
                              <Plus size={14} className="text-tech-400" />
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="my-4 flex items-center gap-3">
                    <div className="h-px flex-1 bg-white/[0.06]" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">O registrar cliente nuevo</span>
                    <div className="h-px flex-1 bg-white/[0.06]" />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Nombre" required error={errors['client.first_name']}>
                      <input className="input" data-error={Boolean(errors['client.first_name'])} value={form.client.first_name} onChange={(event) => setClientField('first_name', event.target.value)} placeholder="Ej. Juan" autoComplete="given-name" />
                    </Field>
                    <Field label="Apellido" required error={errors['client.last_name']}>
                      <input className="input" data-error={Boolean(errors['client.last_name'])} value={form.client.last_name} onChange={(event) => setClientField('last_name', event.target.value)} placeholder="Ej. Pérez" autoComplete="family-name" />
                    </Field>
                    <Field label="Teléfono" required error={errors['client.phone']} hint="Se usa para evitar clientes duplicados.">
                      <input className="input" data-error={Boolean(errors['client.phone'])} type="tel" inputMode="tel" value={form.client.phone} onChange={(event) => setClientField('phone', event.target.value)} placeholder="Ej. 11 5555-1234" autoComplete="tel" />
                    </Field>
                    <Field label="Correo electrónico" error={errors['client.email']}>
                      <input className="input" type="email" value={form.client.email} onChange={(event) => setClientField('email', event.target.value)} placeholder="cliente@correo.com" autoComplete="email" />
                    </Field>
                    <Field label="DNI" error={errors['client.dni']}>
                      <input className="input" inputMode="numeric" value={form.client.dni} onChange={(event) => setClientField('dni', event.target.value)} placeholder="Opcional" />
                    </Field>
                    <Field label="Dirección" error={errors['client.address']}>
                      <input className="input" value={form.client.address} onChange={(event) => setClientField('address', event.target.value)} placeholder="Opcional" autoComplete="street-address" />
                    </Field>
                  </div>
                </>
              )}
            </Section>

            <Section icon={Wrench} title="Datos del equipo" description="Identificá el dispositivo y los accesorios que entrega el cliente.">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Tipo de dispositivo" required error={errors.equipment_type_id} className="sm:col-span-2 lg:col-span-1">
                  <select className="select" data-error={Boolean(errors.equipment_type_id)} value={form.equipment_type_id} onChange={(event) => setField('equipment_type_id', event.target.value)}>
                    <option value="">Seleccionar…</option>
                    {(meta?.equipmentTypes || []).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                  </select>
                </Field>
                <Field label="Marca" required error={errors.brand}>
                  <input className="input" data-error={Boolean(errors.brand)} value={form.brand} onChange={(event) => setField('brand', event.target.value)} placeholder="Ej. Lenovo" />
                </Field>
                <Field label="Modelo" required error={errors.model}>
                  <input className="input" data-error={Boolean(errors.model)} value={form.model} onChange={(event) => setField('model', event.target.value)} placeholder="Ej. IdeaPad 3" />
                </Field>
                <Field label="Número de serie">
                  <input className="input" value={form.serial_number} onChange={(event) => setField('serial_number', event.target.value)} placeholder="Opcional" />
                </Field>
                <Field label="IMEI" hint="Recomendado para celulares.">
                  <input className="input" inputMode="numeric" value={form.imei} onChange={(event) => setField('imei', event.target.value)} placeholder="Opcional" />
                </Field>
                <Field label="Color">
                  <input className="input" value={form.color} onChange={(event) => setField('color', event.target.value)} placeholder="Ej. Negro" />
                </Field>
                <Field label="Accesorios entregados" className="sm:col-span-2 lg:col-span-1">
                  <input className="input" value={form.accessories} onChange={(event) => setField('accessories', event.target.value)} placeholder="Cargador, funda, mouse…" />
                </Field>
              </div>

              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <LockKeyhole size={14} className="text-tech-400" /> Contraseña o patrón de desbloqueo
                  <span className="badge border-emerald-500/20 bg-emerald-500/10 text-emerald-300">Cifrado</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Tipo de desbloqueo">
                    <select className="select" value={form.unlock_type} onChange={(event) => setField('unlock_type', event.target.value)}>
                      {UNLOCK_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Dato de desbloqueo" hint="Se guarda cifrado y solo se muestra bajo acción explícita.">
                    <input className="input" type="password" value={form.unlock_secret} onChange={(event) => setField('unlock_secret', event.target.value)} placeholder="Opcional" autoComplete="new-password" disabled={!form.unlock_type} />
                  </Field>
                </div>
              </div>
            </Section>

            <Section icon={FileText} title="Información del ingreso" description="Registrá la falla declarada, el estado físico y el diagnóstico inicial.">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Fecha y hora de recepción" required>
                  <input type="datetime-local" className="input" value={form.intake_at} onChange={(event) => setField('intake_at', event.target.value)} />
                </Field>
                <Field label="Técnico responsable">
                  <select className="select" value={form.technician_id} onChange={(event) => setField('technician_id', event.target.value)}>
                    <option value="">Sin asignar</option>
                    {(meta?.technicians || []).map((technician) => <option key={technician.id} value={technician.id}>{technician.name}{technician.specialty ? ` · ${technician.specialty}` : ''}</option>)}
                  </select>
                </Field>
                <Field label="Falla declarada por el cliente" required error={errors.declared_issue} className="sm:col-span-2">
                  <input className="input" data-error={Boolean(errors.declared_issue)} value={form.declared_issue} onChange={(event) => setField('declared_issue', event.target.value)} placeholder="Ej. No enciende después de un corte de luz" />
                </Field>
                <Field label="Descripción detallada del problema" className="sm:col-span-2">
                  <textarea className="textarea" rows={3} value={form.detailed_problem} onChange={(event) => setField('detailed_problem', event.target.value)} placeholder="Contá con más detalle cuándo comenzó la falla, qué se probó y cualquier dato útil…" />
                </Field>
                <Field label="Estado físico del equipo">
                  <input className="input" value={form.physical_condition} onChange={(event) => setField('physical_condition', event.target.value)} placeholder="Ej. Buen estado general, rayones leves" />
                </Field>
                <Field label="Golpes o daños visibles">
                  <input className="input" value={form.visible_damage} onChange={(event) => setField('visible_damage', event.target.value)} placeholder="Describí marcas, golpes o humedad" />
                </Field>
                <Field label="Diagnóstico inicial" className="sm:col-span-2">
                  <textarea className="textarea" rows={2} value={form.initial_diagnosis} onChange={(event) => setField('initial_diagnosis', event.target.value)} placeholder="Primera impresión técnica al recibir el equipo (opcional)…" />
                </Field>
                <Field label="Prioridad">
                  <select className="select" value={form.priority} onChange={(event) => setField('priority', event.target.value)}>
                    {PRIORITIES.map((priority) => <option key={priority} value={priority}>{PRIORITY_META[priority].label}</option>)}
                  </select>
                </Field>
                <Field label="Observaciones adicionales" className="sm:col-span-2">
                  <textarea className="textarea" rows={2} value={form.internal_notes} onChange={(event) => setField('internal_notes', event.target.value)} placeholder="Notas internas para el taller…" />
                </Field>
              </div>
            </Section>

            <Section icon={Camera} title="Fotografías del equipo" description="Adjuntá fotos del estado al ingresar. Máximo 6 imágenes de hasta 5 MB.">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {photos.map((photo, index) => (
                  <div key={`${photo.label}-${index}`} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-white/10 bg-ink-900">
                    <img src={photo.preview} alt={`Fotografía ${index + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))}
                      className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-black/70 text-white opacity-90 transition hover:bg-rose-500"
                      aria-label="Quitar fotografía"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
                {photos.length < 6 && (
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={photoBusy}
                    className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-xl border border-tech-500/20 bg-tech-500/[0.06] text-tech-300 transition hover:border-tech-500/40 hover:bg-tech-500/[0.1] active:scale-[0.98]"
                  >
                    {photoBusy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-tech-700 border-t-tech-300" /> : <Camera size={22} />}
                    <span className="text-[11px] font-semibold">{photoBusy ? 'Procesando…' : 'Tomar foto'}</span>
                    <span className="text-[9px] text-slate-500">{photos.length}/6</span>
                  </button>
                )}
                {photos.length < 6 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoBusy}
                    className="flex aspect-[4/3] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 bg-white/[0.02] text-slate-500 transition hover:border-tech-500/40 hover:bg-tech-500/[0.04] hover:text-tech-300 active:scale-[0.98]"
                  >
                    <ImagePlus size={22} />
                    <span className="text-[11px] font-semibold">Galería</span>
                    <span className="text-[9px] text-slate-600">{photos.length}/6</span>
                  </button>
                )}
              </div>
              <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhoto} />
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handlePhoto} />
            </Section>

            <Section icon={Wallet} title="Condiciones de recepción" description="Presupuesto estimado, seña y fecha de entrega comprometida.">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="Presupuesto estimado" error={errors.estimated_budget}>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
                    <input type="number" min="0" step="0.01" className="input pl-8" value={form.estimated_budget} onChange={(event) => setField('estimated_budget', event.target.value)} placeholder="0,00" />
                  </div>
                </Field>
                <Field label="Seña recibida" error={errors.deposit_amount} hint="Se registra como ingreso en caja.">
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
                    <input type="number" min="0" step="0.01" className="input pl-8" data-error={Boolean(errors.deposit_amount)} value={form.deposit_amount} onChange={(event) => setField('deposit_amount', event.target.value)} placeholder="0,00" />
                  </div>
                </Field>
                <Field label="Método de pago de la seña">
                  <select className="select" value={form.payment_method} onChange={(event) => setField('payment_method', event.target.value)}>
                    {(meta?.paymentMethods || ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA', 'MERCADO_PAGO', 'OTRO']).map((method) => (
                      <option key={method} value={method}>{method.charAt(0) + method.slice(1).toLowerCase().replace('_', ' ')}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Fecha estimada de entrega">
                  <input type="date" min={todayISO()} className="input" value={form.estimated_delivery} onChange={(event) => setField('estimated_delivery', event.target.value)} />
                </Field>
                <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 sm:col-span-2 lg:col-span-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Saldo pendiente estimado</p>
                  <p className="mt-1 text-xl font-bold text-amber-300">{formatMoney(balance)}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Presupuesto − seña</p>
                </div>
              </div>

              <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] p-3">
                <ShieldCheck size={15} className="mt-0.5 shrink-0 text-emerald-400" />
                <p className="text-[11px] leading-relaxed text-emerald-100/70">
                  El número de orden y el comprobante de recepción se generan al confirmar. Los datos sensibles se guardan cifrados y cada acción queda auditada.
                </p>
              </div>
            </Section>

            <div className="flex flex-col-reverse gap-2 pb-2 sm:flex-row sm:justify-end">
              <Link to="/ordenes" className="btn-secondary">Cancelar</Link>
              <button type="submit" className="btn-primary" disabled={saving}>
                {saving ? 'Registrando…' : <><ClipboardCheck size={17} /> Confirmar ingreso</>}
              </button>
            </div>
          </div>

          <aside className="hidden xl:block">
            <div className="sticky top-[84px]">{summary}</div>
          </aside>
        </div>
      </form>

      <Modal open={showMobileSummary} onClose={() => setShowMobileSummary(false)} title="Resumen del ingreso" size="sm">
        {summary}
      </Modal>
    </div>
  );
}
