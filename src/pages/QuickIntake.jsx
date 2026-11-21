import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  ImagePlus,
  Info,
  Search,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  UserRoundSearch,
  Wrench,
  Zap,
} from 'lucide-react';
import { useApiQuery, useDocumentTitle } from '../hooks/useApi.js';
import { useUI } from '../context/UIProvider.jsx';
import { api } from '../lib/api.js';
import { classNames, fileToDataUrl, formatMoney, todayISO } from '../lib/format.js';
import { PAYMENT_METHODS } from '../lib/constants.js';

const DRAFT_KEY = 'tt_recepcion_draft_v1';
const STEPS = [
  { label: 'Cliente', icon: UserRound },
  { label: 'Equipo', icon: Wrench },
  { label: 'Cierre', icon: CircleDollarSign },
];

const TYPE_PRIORITY = [
  'Celular',
  'Notebook',
  'PC de escritorio',
  'Consola PlayStation',
  'Consola Xbox',
  'Tablet',
  'Impresora',
  'Monitor',
  'All in One',
  'Netbook',
  'Componente informático',
  'Otro dispositivo electrónico',
];

function addDaysISO(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function defaultDraft() {
  return {
    step: 1,
    selectedClient: null,
    client: { first_name: '', last_name: '', phone: '' },
    equipment_type_id: '',
    brand: '',
    model: '',
    accessories: '',
    declared_issue: '',
    estimated_budget: '',
    deposit_amount: '',
    payment_method: 'EFECTIVO',
    estimated_delivery: addDaysISO(7),
  };
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return { ...defaultDraft(), ...parsed, step: Math.min(3, Math.max(1, Number(parsed.step) || 1)) };
  } catch {
    return null;
  }
}

function Field({ label, error, hint, children }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {error && <p className="mt-1 text-[11px] text-rose-400">{error}</p>}
      {hint && !error && <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{hint}</p>}
    </div>
  );
}

export default function QuickIntake() {
  useDocumentTitle('Recepción rápida');
  const navigate = useNavigate();
  const { toast } = useUI();
  const { data: meta } = useApiQuery('/meta');
  const draft = useMemo(() => loadDraft(), []);
  const [form, setForm] = useState(() => draft || defaultDraft());
  const [step, setStep] = useState(() => draft?.step || 1);
  const [selectedClient, setSelectedClient] = useState(() => draft?.selectedClient || null);
  const [clientQuery, setClientQuery] = useState('');
  const [clientResults, setClientResults] = useState([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [draftNotice, setDraftNotice] = useState(Boolean(draft));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [duplicateClient, setDuplicateClient] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [photoBusy, setPhotoBusy] = useState(false);
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const equipmentTypes = useMemo(() => {
    const types = meta?.equipmentTypes || [];
    return [...types].sort((a, b) => {
      const ai = TYPE_PRIORITY.indexOf(a.name);
      const bi = TYPE_PRIORITY.indexOf(b.name);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }, [meta]);

  useEffect(() => {
    if (selectedClient) return undefined;
    if (!clientQuery.trim()) {
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
    }, 250);
    return () => window.clearTimeout(timer);
  }, [clientQuery, selectedClient]);

  useEffect(() => {
    const payload = { ...form, step, selectedClient };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
    } catch {
      // Si el almacenamiento está lleno, la recepción sigue funcionando en memoria.
    }
  }, [form, step, selectedClient]);

  useEffect(() => {
    if (!draftNotice) return undefined;
    const timer = window.setTimeout(() => setDraftNotice(false), 6000);
    return () => window.clearTimeout(timer);
  }, [draftNotice]);

  const setField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setApiError(null);
    setDuplicateClient(null);
  };

  const setClientField = (field, value) => {
    setForm((current) => ({ ...current, client: { ...current.client, [field]: value } }));
    setErrors((current) => ({ ...current, [`client.${field}`]: undefined }));
    setApiError(null);
    setDuplicateClient(null);
  };

  const chooseClient = (client) => {
    setSelectedClient(client);
    setClientQuery('');
    setClientResults([]);
    setSearchOpen(false);
    setErrors((current) => ({ ...current, client: undefined }));
    setDuplicateClient(null);
  };

  const clearClient = () => {
    setSelectedClient(null);
    setForm((current) => ({ ...current, client: { first_name: '', last_name: '', phone: '' } }));
  };

  const validateStep = (targetStep) => {
    const next = {};
    if (targetStep === 1 && !selectedClient) {
      if (!form.client.first_name.trim()) next['client.first_name'] = 'Ingresá el nombre.';
      if (!form.client.last_name.trim()) next['client.last_name'] = 'Ingresá el apellido.';
      if (!form.client.phone.trim()) next['client.phone'] = 'Ingresá el teléfono.';
      else if (form.client.phone.replace(/\D/g, '').length < 6) next['client.phone'] = 'Teléfono inválido.';
    }
    if (targetStep === 2) {
      if (!form.equipment_type_id) next.equipment_type_id = 'Seleccioná el tipo de equipo.';
      if (!form.brand.trim()) next.brand = 'Ingresá la marca.';
      if (!form.model.trim()) next.model = 'Ingresá el modelo.';
      if (!form.declared_issue.trim()) next.declared_issue = 'Describí la falla en pocas palabras.';
    }
    if (targetStep === 3) {
      if (Number(form.deposit_amount || 0) > Number(form.estimated_budget || 0)) {
        next.deposit_amount = 'La seña no puede superar el presupuesto.';
      }
    }
    setErrors(next);
    if (Object.keys(next).length) {
      toast.warning('Completá los datos obligatorios para continuar.');
      return false;
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    if (step < 3) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const goBack = () => {
    if (step > 1) setStep(step - 1);
    else navigate(-1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const addPhoto = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    if (photos.length + files.length > 6) {
      toast.warning('Podés adjuntar hasta 6 fotografías.');
      return;
    }
    setPhotoBusy(true);
    try {
      const converted = [];
      for (const [index, file] of files.entries()) {
        const dataUrl = await fileToDataUrl(file, { maxDimension: 1400, quality: 0.76 });
        converted.push({ data_url: dataUrl, preview: dataUrl, label: `Recepción ${photos.length + index + 1}` });
      }
      setPhotos((current) => [...current, ...converted]);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setPhotoBusy(false);
    }
  };

  const submit = async () => {
    if (!validateStep(3)) return;
    setSaving(true);
    setApiError(null);
    setDuplicateClient(null);
    try {
      const payload = {
        client_id: selectedClient?.id || undefined,
        client: selectedClient ? undefined : {
          first_name: form.client.first_name,
          last_name: form.client.last_name,
          phone: form.client.phone,
        },
        equipment_type_id: Number(form.equipment_type_id),
        brand: form.brand,
        model: form.model,
        accessories: form.accessories || null,
        declared_issue: form.declared_issue,
        priority: 'NORMAL',
        technician_id: null,
        estimated_budget: Number(form.estimated_budget) || 0,
        estimated_delivery: form.estimated_delivery || null,
        deposit_amount: Number(form.deposit_amount) || 0,
        payment_method: form.payment_method,
        internal_notes: 'Ingreso rápido desde recepción móvil. Completar diagnóstico técnico.',
        photos: photos.map((photo) => ({ data_url: photo.data_url, label: photo.label })),
      };
      const data = await api.post('/orders', payload);
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        // Ignorar.
      }
      toast.success(`Equipo ingresado. Orden ${data.order.order_number}.`);
      navigate(`/ordenes/${data.order.id}`, { state: { created: true } });
    } catch (error) {
      setApiError(error.message);
      if (error.details && !Array.isArray(error.details) && error.details.existingClient) {
        setDuplicateClient(error.details.existingClient);
      }
      if (Array.isArray(error.details)) {
        setErrors((current) => ({
          ...current,
          ...Object.fromEntries(error.details.map((detail) => [detail.field, detail.message])),
        }));
      }
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedType = equipmentTypes.find((type) => type.id === Number(form.equipment_type_id));
  const budget = Number(form.estimated_budget) || 0;
  const deposit = Number(form.deposit_amount) || 0;
  const balance = Math.max(budget - deposit, 0);
  const clientName = selectedClient
    ? `${selectedClient.first_name} ${selectedClient.last_name}`.trim()
    : `${form.client.first_name} ${form.client.last_name}`.trim();

  return (
    <div className="mx-auto max-w-3xl animate-fade-in pb-2">
      <div className="mb-4 flex items-start gap-3">
        <button type="button" onClick={goBack} className="icon-btn mt-0.5 h-9 w-9 shrink-0 border border-white/[0.08]">
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-tech-400">
            <Zap size={12} /> Recepción móvil
          </div>
          <h1 className="mt-0.5 text-xl font-bold tracking-tight text-white sm:text-2xl">Ingreso rápido</h1>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">Registrá lo esencial en menos de un minuto. Después completás diagnóstico y técnico desde la orden.</p>
        </div>
        <Link to="/ordenes/nueva" className="btn-secondary btn-sm hidden shrink-0 sm:inline-flex">Formulario completo</Link>
      </div>

      {draftNotice && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-3.5 py-2.5 text-[11px] text-amber-100/80">
          <span>Recuperamos el borrador de una recepción anterior.</span>
          <button type="button" onClick={() => setDraftNotice(false)} className="font-semibold text-amber-300">Ocultar</button>
        </div>
      )}

      <div className="card mb-4 p-3">
        <div className="flex items-center gap-2">
          {STEPS.map((item, index) => {
            const number = index + 1;
            const active = step === number;
            const complete = step > number;
            return (
              <div key={item.label} className={classNames('flex flex-1 items-center gap-1.5', index > 0 && 'flex-none')}>
                {index > 0 && <div className={classNames('h-px w-5 sm:w-10', complete || active ? 'bg-tech-500/50' : 'bg-white/10')} />}
                <button
                  type="button"
                  onClick={() => number < step && setStep(number)}
                  className={classNames('flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-[10px] font-semibold', active ? 'text-tech-300' : complete ? 'text-slate-300' : 'text-slate-600')}
                >
                  <span className={classNames('flex h-6 w-6 items-center justify-center rounded-full border text-[10px]', complete ? 'border-tech-500 bg-tech-600 text-white' : active ? 'border-tech-400 bg-tech-500/15 text-tech-300' : 'border-white/10 text-slate-600')}>
                    {complete ? <Check size={11} /> : number}
                  </span>
                  <span className={classNames(index === 0 ? '' : 'hidden min-[380px]:inline')}>{item.label}</span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-white/[0.05]">
          <div className="h-full rounded-full bg-gradient-to-r from-tech-500 to-cyan-400 transition-all duration-300" style={{ width: `${(step / 3) * 100}%` }} />
        </div>
      </div>

      {apiError && (
        <div className="mb-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3.5 text-xs text-rose-300">
          <p className="font-semibold">{apiError}</p>
          {duplicateClient && (
            <button
              type="button"
              className="btn-secondary btn-sm mt-2 border-rose-400/20"
              onClick={() => { chooseClient(duplicateClient); setStep(2); }}
            >
              <UserRoundSearch size={14} /> Usar a {duplicateClient.first_name} {duplicateClient.last_name}
            </button>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <section className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-tech-500/10 text-tech-400"><UserRound size={17} /></div>
              <div><h2 className="text-sm font-semibold text-slate-100">¿Quién deja el equipo?</h2><p className="text-[10px] text-slate-500">Buscá un cliente existente para no duplicarlo.</p></div>
            </div>

            {selectedClient ? (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-tech-500/20 bg-tech-500/[0.07] p-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tech-500/15 text-xs font-bold text-tech-200">
                    {selectedClient.first_name?.[0]}{selectedClient.last_name?.[0]}
                  </div>
                  <div className="min-w-0"><p className="truncate text-sm font-semibold text-white">{selectedClient.first_name} {selectedClient.last_name}</p><p className="truncate text-[10px] text-slate-400">{selectedClient.phone}</p></div>
                </div>
                <button type="button" className="btn-secondary btn-sm shrink-0" onClick={clearClient}>Cambiar</button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    className="input pl-10"
                    placeholder="Buscar cliente por nombre o teléfono…"
                    value={clientQuery}
                    onChange={(event) => { setClientQuery(event.target.value); setSearchOpen(true); }}
                    onFocus={() => setSearchOpen(true)}
                  />
                  {clientSearching && <span className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-slate-600 border-t-tech-400" />}
                </div>
                {searchOpen && clientQuery.trim() && (
                  <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-ink-800">
                    {clientResults.length === 0 ? (
                      <p className="px-3.5 py-3 text-[11px] text-slate-500">No encontrado. Cargá los datos abajo.</p>
                    ) : clientResults.map((client) => (
                      <button key={client.id} type="button" onClick={() => chooseClient(client)} className="flex w-full items-center gap-2.5 border-b border-white/[0.05] px-3.5 py-2.5 text-left last:border-0 hover:bg-white/[0.04]">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-[10px] font-bold text-slate-300">{client.first_name?.[0]}{client.last_name?.[0]}</div>
                        <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-slate-200">{client.first_name} {client.last_name}</p><p className="text-[10px] text-slate-500">{client.phone}</p></div>
                        <ChevronRight size={14} className="text-tech-400" />
                      </button>
                    ))}
                  </div>
                )}

                <div className="my-3 flex items-center gap-2">
                  <div className="h-px flex-1 bg-white/[0.06]" /><span className="text-[9px] font-semibold uppercase tracking-wider text-slate-600">o cliente nuevo</span><div className="h-px flex-1 bg-white/[0.06]" />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nombre *" error={errors['client.first_name']}>
                    <input className="input" value={form.client.first_name} onChange={(event) => setClientField('first_name', event.target.value)} placeholder="Ej. Juan" autoComplete="given-name" enterKeyHint="next" />
                  </Field>
                  <Field label="Apellido *" error={errors['client.last_name']}>
                    <input className="input" value={form.client.last_name} onChange={(event) => setClientField('last_name', event.target.value)} placeholder="Ej. Pérez" autoComplete="family-name" enterKeyHint="next" />
                  </Field>
                </div>
                <div className="mt-3">
                  <Field label="Teléfono *" error={errors['client.phone']} hint="Se usa para avisos y para evitar clientes duplicados.">
                    <input className="input" type="tel" inputMode="tel" value={form.client.phone} onChange={(event) => setClientField('phone', event.target.value)} placeholder="Ej. 11 5555-1234" autoComplete="tel" enterKeyHint="next" />
                  </Field>
                </div>
              </>
            )}
          </section>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <section className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-tech-500/10 text-tech-400"><Wrench size={17} /></div>
              <div><h2 className="text-sm font-semibold text-slate-100">Equipo y falla</h2><p className="text-[10px] text-slate-500">Lo mínimo para identificarlo y comenzar el diagnóstico.</p></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Tipo de equipo *" error={errors.equipment_type_id}>
                <select className="select" value={form.equipment_type_id} onChange={(event) => setField('equipment_type_id', event.target.value)}>
                  <option value="">Seleccionar…</option>
                  {equipmentTypes.map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}
                </select>
              </Field>
              <Field label="Marca *" error={errors.brand}>
                <input className="input" value={form.brand} onChange={(event) => setField('brand', event.target.value)} placeholder="Ej. Samsung" enterKeyHint="next" />
              </Field>
              <Field label="Modelo *" error={errors.model}>
                <input className="input" value={form.model} onChange={(event) => setField('model', event.target.value)} placeholder="Ej. Galaxy A54" enterKeyHint="next" />
              </Field>
              <Field label="Accesorios entregados">
                <input className="input" value={form.accessories} onChange={(event) => setField('accessories', event.target.value)} placeholder="Cargador, funda…" />
              </Field>
              <div className="sm:col-span-2">
                <Field label="¿Qué falla tiene? *" error={errors.declared_issue}>
                  <input className="input" value={form.declared_issue} onChange={(event) => setField('declared_issue', event.target.value)} placeholder="Ej. No enciende después de una descarga" enterKeyHint="done" />
                </Field>
              </div>
            </div>
          </section>

          <section className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-tech-500/10 text-tech-400"><Camera size={17} /></div>
              <div><h2 className="text-sm font-semibold text-slate-100">Fotos del estado</h2><p className="text-[10px] text-slate-500">Opcional, recomendado para respaldar golpes o rayones.</p></div>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {photos.map((photo, index) => (
                <div key={index} className="relative aspect-square overflow-hidden rounded-xl border border-white/10 bg-ink-900">
                  <img src={photo.preview} alt={`Foto ${index + 1}`} className="h-full w-full object-cover" />
                  <button type="button" onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))} className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-black/70 text-white" aria-label="Quitar foto"><Trash2 size={13} /></button>
                </div>
              ))}
              {photos.length < 6 && (
                <button type="button" onClick={() => cameraRef.current?.click()} disabled={photoBusy} className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-tech-500/20 bg-tech-500/[0.06] text-tech-300 transition active:scale-[0.98]">
                  {photoBusy ? <span className="h-5 w-5 animate-spin rounded-full border-2 border-tech-700 border-t-tech-300" /> : <Camera size={24} />}
                  <span className="text-[10px] font-semibold">Tomar foto</span>
                </button>
              )}
              {photos.length < 6 && (
                <button type="button" onClick={() => galleryRef.current?.click()} disabled={photoBusy} className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/15 bg-white/[0.02] text-slate-500 transition active:scale-[0.98]">
                  <ImagePlus size={22} />
                  <span className="text-[10px] font-semibold">Galería</span>
                </button>
              )}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[10px] text-slate-600"><Smartphone size={12} /> La cámara se abre directo en el celular. Máximo 6 fotos.</p>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={addPhoto} />
            <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={addPhoto} />
          </section>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <section className="card p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"><CircleDollarSign size={17} /></div>
              <div><h2 className="text-sm font-semibold text-slate-100">Condiciones del ingreso</h2><p className="text-[10px] text-slate-500">La seña se registra como ingreso real; el saldo queda pendiente.</p></div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Presupuesto estimado">
                <div className="relative"><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span><input type="number" min="0" step="0.01" inputMode="decimal" className="input pl-8" value={form.estimated_budget} onChange={(event) => setField('estimated_budget', event.target.value)} placeholder="0,00" /></div>
              </Field>
              <Field label="Seña recibida" error={errors.deposit_amount}>
                <div className="relative"><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span><input type="number" min="0" step="0.01" inputMode="decimal" className="input pl-8" value={form.deposit_amount} onChange={(event) => setField('deposit_amount', event.target.value)} placeholder="0,00" /></div>
              </Field>
              <Field label="Método de pago de la seña">
                <select className="select" value={form.payment_method} onChange={(event) => setField('payment_method', event.target.value)}>
                  {PAYMENT_METHODS.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
                </select>
              </Field>
              <Field label="Fecha estimada de entrega">
                <input type="date" min={todayISO()} className="input" value={form.estimated_delivery} onChange={(event) => setField('estimated_delivery', event.target.value)} />
              </Field>
            </div>
          </section>

          <section className="card overflow-hidden">
            <div className="border-b border-white/[0.06] px-4 py-3"><h2 className="text-sm font-semibold text-slate-100">Resumen de la recepción</h2></div>
            <div className="space-y-2.5 p-4 text-xs">
              <div className="flex justify-between gap-3"><span className="text-slate-500">Cliente</span><span className="max-w-[60%] truncate text-right font-semibold text-slate-200">{clientName || 'Sin definir'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Teléfono</span><span className="font-medium text-slate-300">{selectedClient?.phone || form.client.phone || '—'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Equipo</span><span className="max-w-[60%] truncate text-right font-semibold text-slate-200">{form.brand} {form.model}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Tipo</span><span className="font-medium text-slate-300">{selectedType?.name || '—'}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Fotos</span><span className="font-medium text-slate-300">{photos.length}</span></div>
              <div className="divider my-1" />
              <div className="flex justify-between gap-3"><span className="text-slate-500">Presupuesto</span><span className="font-semibold text-slate-200">{formatMoney(budget)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Seña</span><span className="font-semibold text-emerald-400">{formatMoney(deposit)}</span></div>
              <div className="flex justify-between gap-3"><span className="text-slate-500">Saldo pendiente</span><span className="font-bold text-amber-300">{formatMoney(balance)}</span></div>
            </div>
            <div className="border-t border-white/[0.06] bg-white/[0.015] px-4 py-3 text-[10px] leading-relaxed text-slate-500">
              Se generará la orden en estado <span className="font-semibold text-slate-300">Recibido</span>. El comprobante PDF queda disponible en el detalle de la orden.
            </div>
          </section>

          <div className="flex items-start gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] px-3.5 py-3 text-[10px] leading-relaxed text-emerald-200/70">
            <ShieldCheck size={14} className="mt-0.5 shrink-0 text-emerald-400" />
            El borrador se guarda en este dispositivo. Si se corta la conexión antes de confirmar, al volver encontrás los datos cargados.
          </div>
        </div>
      )}

      <div className="mt-4 flex gap-2">
        {step > 1 && <button type="button" className="btn-secondary flex-1" onClick={goBack}><ArrowLeft size={16} /> Atrás</button>}
        {step < 3 ? (
          <button type="button" className="btn-primary flex-[1.4]" onClick={goNext}>Continuar <ArrowRight size={16} /></button>
        ) : (
          <button type="button" className="btn-primary flex-[1.4]" onClick={submit} disabled={saving}>
            {saving ? 'Registrando ingreso…' : <><ClipboardCheck size={17} /> Confirmar ingreso</>}
          </button>
        )}
      </div>
      <p className="mt-2 flex items-center justify-center gap-1 text-center text-[10px] text-slate-600"><Info size={11} /> Paso {step} de 3 · Los datos se guardan de forma segura en el servidor al confirmar.</p>
    </div>
  );
}
