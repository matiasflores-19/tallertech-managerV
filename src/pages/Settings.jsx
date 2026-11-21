import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArchiveRestore,
  Database,
  Download,
  HardDrive,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings as SettingsIcon,
  Shield,
  ShieldCheck,
  Trash2,
  Upload,
  UserPlus,
  Users,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../context/AuthProvider.jsx';
import { useUI } from '../context/UIProvider.jsx';
import { useApiQuery, useDocumentTitle } from '../hooks/useApi.js';
import { api, downloadFile } from '../lib/api.js';
import { formatDate, formatDateTime } from '../lib/format.js';
import { EmptyState, PageHeader, Tabs, LoadingScreen } from '../components/ui.jsx';
import Modal from '../components/Modal.jsx';

const SETTINGS_FIELDS = [
  { key: 'workshop_name', label: 'Nombre del taller', required: true },
  { key: 'workshop_phone', label: 'Teléfono' },
  { key: 'workshop_email', label: 'Correo electrónico' },
  { key: 'workshop_cuit', label: 'CUIT' },
  { key: 'workshop_website', label: 'Sitio web' },
  { key: 'workshop_address', label: 'Dirección', full: true },
  { key: 'receipt_footer', label: 'Texto al pie del comprobante', full: true, textarea: true },
];

const COUNT_LABELS = {
  clients: 'Clientes',
  orders: 'Órdenes',
  products: 'Productos',
  users: 'Usuarios',
  transactions: 'Movimientos',
};

function GeneralTab({ settingsData, onSaved }) {
  const { toast } = useUI();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settingsData?.settings) setForm({ ...settingsData.settings });
  }, [settingsData]);

  if (!form) return null;

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api.patch('/settings', form);
      toast.success(data.message);
      onSaved();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <form onSubmit={submit} className="card overflow-hidden">
        <div className="border-b border-white/[0.06] px-4 py-4 sm:px-5"><h2 className="section-title">Datos del taller</h2><p className="mt-0.5 text-xs text-slate-500">Se utilizan en los comprobantes y reportes en PDF.</p></div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          {SETTINGS_FIELDS.map((field) => (
            <div key={field.key} className={field.full ? 'sm:col-span-2' : ''}>
              <label className="label">{field.label}{field.required && <span className="text-rose-400"> *</span>}</label>
              {field.textarea ? (
                <textarea className="textarea" rows={2} value={form[field.key] || ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} />
              ) : (
                <input className="input" value={form[field.key] || ''} onChange={(event) => setForm({ ...form, [field.key]: event.target.value })} required={field.required} />
              )}
            </div>
          ))}
          <div><label className="label">Moneda</label><select className="select" value={form.currency || 'ARS'} onChange={(event) => setForm({ ...form, currency: event.target.value })}><option value="ARS">Peso argentino (ARS)</option><option value="USD">Dólar (USD)</option><option value="EUR">Euro (EUR)</option></select></div>
          <div><label className="label">Días de garantía</label><input type="number" min="0" className="input" value={form.warranty_days || ''} onChange={(event) => setForm({ ...form, warranty_days: event.target.value })} /></div>
        </div>
        <div className="flex justify-end border-t border-white/[0.06] px-4 py-3.5 sm:px-5"><button type="submit" className="btn-primary" disabled={saving}><Save size={16} /> {saving ? 'Guardando…' : 'Guardar configuración'}</button></div>
      </form>

      <div className="space-y-4">
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2"><Database size={16} className="text-tech-400" /><h2 className="text-sm font-semibold text-slate-100">Estado del sistema</h2></div>
          <dl className="mt-4 space-y-2.5 text-xs">
            <div className="flex justify-between"><dt className="text-slate-500">Aplicación</dt><dd className="font-medium text-slate-200">{settingsData.system.appName}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Versión</dt><dd className="font-mono text-slate-300">{settingsData.system.version}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Base de datos</dt><dd className="text-slate-300">{settingsData.system.database}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Tamaño</dt><dd className="text-slate-300">{(settingsData.system.databaseSize / 1024).toFixed(0)} KB</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Node.js</dt><dd className="font-mono text-slate-300">{settingsData.system.node}</dd></div>
          </dl>
        </div>
        <div className="card p-4 sm:p-5">
          <div className="flex items-center gap-2"><HardDrive size={16} className="text-tech-400" /><h2 className="text-sm font-semibold text-slate-100">Registros</h2></div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {Object.entries(settingsData.system.counts).map(([key, value]) => <div key={key} className="rounded-lg bg-white/[0.025] p-2.5"><p className="text-[9px] uppercase tracking-wider text-slate-600">{COUNT_LABELS[key] || key}</p><p className="mt-0.5 text-base font-bold text-slate-200">{value}</p></div>)}
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] p-3 text-[11px] leading-relaxed text-emerald-200/70"><ShieldCheck size={15} className="mt-0.5 shrink-0" /> Los respaldos automáticos se ejecutan al iniciar la aplicación y cada 24 horas.</div>
      </div>
    </div>
  );
}

function UserModal({ open, onClose, user, onSaved }) {
  const { toast } = useUI();
  const [form, setForm] = useState({ username: '', full_name: '', role: 'tecnico', password: '', active: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const editing = Boolean(user);

  useEffect(() => {
    if (open) {
      setForm(user ? { username: user.username, full_name: user.full_name, role: user.role, password: '', active: user.active } : { username: '', full_name: '', role: 'tecnico', password: '', active: true });
      setError('');
    }
  }, [open, user]);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      let data;
      if (editing) {
        const payload = { full_name: form.full_name, role: form.role, active: form.active };
        if (form.password) payload.password = form.password;
        data = await api.patch(`/auth/users/${user.id}`, payload);
      } else {
        data = await api.post('/auth/users', form);
      }
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
    <Modal open={open} onClose={onClose} title={editing ? 'Editar usuario' : 'Nuevo usuario'} subtitle="Los usuarios administradores acceden a configuración y respaldos." size="sm" footer={
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
        <button type="submit" form="user-form" className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear usuario'}</button>
      </div>
    }>
      <form id="user-form" onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div>}
        <div><label className="label">Nombre completo *</label><input className="input" value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} required /></div>
        <div><label className="label">Usuario *</label><input className="input" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required disabled={editing} autoComplete="off" /></div>
        <div><label className="label">Rol</label><select className="select" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}><option value="tecnico">Técnico</option><option value="admin">Administrador</option></select></div>
        <div><label className="label">{editing ? 'Nueva contraseña (opcional)' : 'Contraseña *'}</label><input className="input" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editing} minLength={8} autoComplete="new-password" /><p className="mt-1 text-[10px] text-slate-500">Mínimo 8 caracteres, con letras y números.</p></div>
        {editing && <label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" className="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Usuario activo</label>}
      </form>
    </Modal>
  );
}

function UsersTab({ onSaved }) {
  const { toast, confirm } = useUI();
  const { user: currentUser } = useAuth();
  const { data, loading, refetch } = useApiQuery('/auth/users');
  const { data: techniciansData, refetch: refetchTechnicians } = useApiQuery('/meta/technicians');
  const [modal, setModal] = useState(null);
  const [technicianModal, setTechnicianModal] = useState(false);
  const [technicianForm, setTechnicianForm] = useState({ name: '', phone: '', specialty: '' });

  const toggleUser = async (user) => {
    const accepted = await confirm({ title: user.active ? 'Desactivar usuario' : 'Activar usuario', message: `${user.full_name} ${user.active ? 'no podrá iniciar sesión' : 'podrá volver a ingresar'} al sistema.`, confirmLabel: user.active ? 'Desactivar' : 'Activar' });
    if (!accepted) return;
    try {
      const response = await api.patch(`/auth/users/${user.id}`, { active: !user.active });
      toast.success(response.message);
      refetch();
    } catch (error) {
      toast.error(error.message);
    }
  };

  const addTechnician = async (event) => {
    event.preventDefault();
    try {
      const response = await api.post('/meta/technicians', technicianForm);
      toast.success(response.message);
      setTechnicianForm({ name: '', phone: '', specialty: '' });
      setTechnicianModal(false);
      refetchTechnicians();
      onSaved();
    } catch (error) {
      toast.error(error.message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-4 sm:px-5"><div><h2 className="section-title">Usuarios del sistema</h2><p className="mt-0.5 text-xs text-slate-500">Autenticación y permisos básicos por rol.</p></div><button type="button" className="btn-primary btn-sm" onClick={() => setModal({ type: 'new' })}><UserPlus size={14} /> Nuevo usuario</button></div>
        {loading ? <div className="p-4"><div className="skeleton h-12 w-full" /></div> : (
          <div className="table-wrapper">
            <table className="data-table min-w-[700px]">
              <thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th>Último ingreso</th><th>Creado</th><th className="w-20" /></tr></thead>
              <tbody>
                {(data?.users || []).map((user) => (
                  <tr key={user.id}>
                    <td><p className="text-xs font-semibold text-slate-200">{user.full_name} {user.id === currentUser.id && <span className="badge ml-1 border-tech-500/20 bg-tech-500/10 text-tech-300">Vos</span>}</p><p className="mt-0.5 font-mono text-[10px] text-slate-500">@{user.username}</p></td>
                    <td><span className={`badge ${user.role === 'admin' ? 'border-violet-500/20 bg-violet-500/10 text-violet-300' : 'border-sky-500/20 bg-sky-500/10 text-sky-300'}`}>{user.role === 'admin' ? 'Administrador' : 'Técnico'}</span></td>
                    <td><span className={`badge ${user.active ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300' : 'border-slate-500/20 bg-slate-500/10 text-slate-400'}`}>{user.active ? 'Activo' : 'Inactivo'}</span></td>
                    <td className="text-[10px] text-slate-500">{user.last_login ? formatDateTime(user.last_login) : 'Nunca'}</td>
                    <td className="text-[10px] text-slate-500">{formatDate(user.created_at)}</td>
                    <td><div className="flex justify-end gap-0.5"><button type="button" className="icon-btn h-8 w-8" onClick={() => setModal({ type: 'edit', user })}><Pencil size={13} /></button>{user.id !== currentUser.id && <button type="button" className="icon-btn h-8 w-8" onClick={() => toggleUser(user)} title={user.active ? 'Desactivar' : 'Activar'}>{user.active ? <Trash2 size={13} /> : <RefreshCw size={13} />}</button>}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-4 sm:px-5"><div><h2 className="section-title">Técnicos del taller</h2><p className="mt-0.5 text-xs text-slate-500">Se asignan a las órdenes y aparecen en los comprobantes.</p></div><button type="button" className="btn-primary btn-sm" onClick={() => setTechnicianModal(true)}><Plus size={14} /> Agregar técnico</button></div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...new Map((techniciansData?.technicians || []).map((item) => [item.name, item])).values()].map((technician) => (
            <div key={technician.name || technician.id} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-tech-500/10 text-tech-400"><Wrench size={15} /></div><div className="min-w-0"><p className="truncate text-xs font-semibold text-slate-200">{technician.name}</p><p className="truncate text-[10px] text-slate-500">{technician.specialty || 'Técnico general'}</p></div></div>
          ))}
        </div>
      </div>

      <UserModal open={modal?.type === 'new' || modal?.type === 'edit'} onClose={() => setModal(null)} user={modal?.user} onSaved={refetch} />
      <Modal open={technicianModal} onClose={() => setTechnicianModal(false)} title="Agregar técnico" size="sm" footer={<div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setTechnicianModal(false)}>Cancelar</button><button className="btn-primary" type="submit" form="technician-form">Agregar</button></div>}>
        <form id="technician-form" onSubmit={addTechnician} className="space-y-4">
          <div><label className="label">Nombre *</label><input className="input" value={technicianForm.name} onChange={(event) => setTechnicianForm({ ...technicianForm, name: event.target.value })} required /></div>
          <div><label className="label">Teléfono</label><input className="input" value={technicianForm.phone} onChange={(event) => setTechnicianForm({ ...technicianForm, phone: event.target.value })} /></div>
          <div><label className="label">Especialidad</label><input className="input" value={technicianForm.specialty} onChange={(event) => setTechnicianForm({ ...technicianForm, specialty: event.target.value })} placeholder="Ej. Notebooks y hardware" /></div>
        </form>
      </Modal>
    </div>
  );
}

function EquipmentTab({ meta, onSaved }) {
  const { toast } = useUI();
  const [form, setForm] = useState({ name: '', icon: 'cpu' });
  const [saving, setSaving] = useState(false);
  const [typeModal, setTypeModal] = useState(false);

  const addType = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const data = await api.post('/meta/equipment-types', form);
      toast.success(data.message);
      setForm({ name: '', icon: 'cpu' });
      setTypeModal(false);
      onSaved();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-4 py-4 sm:px-5"><div><h2 className="section-title">Tipos de equipo</h2><p className="mt-0.5 text-xs text-slate-500">Categorías disponibles al registrar un ingreso.</p></div><button type="button" className="btn-primary btn-sm" onClick={() => setTypeModal(true)}><Plus size={14} /> Nuevo tipo</button></div>
      <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {(meta?.equipmentTypes || []).map((type) => <div key={type.id} className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-slate-300"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-tech-500/10 text-tech-400"><Wrench size={13} /></span>{type.name}</div>)}
      </div>
      <Modal open={typeModal} onClose={() => setTypeModal(false)} title="Nuevo tipo de equipo" size="sm" footer={<div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setTypeModal(false)}>Cancelar</button><button className="btn-primary" type="submit" form="type-form" disabled={saving}>{saving ? 'Agregando…' : 'Agregar tipo'}</button></div>}>
        <form id="type-form" onSubmit={addType}><label className="label">Nombre del tipo *</label><input className="input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required placeholder="Ej. Consola Nintendo" /></form>
      </Modal>
    </div>
  );
}

function BackupTab({ settingsData, onSaved }) {
  const { toast, confirm } = useUI();
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreForm, setRestoreForm] = useState({ password: '', confirmation: '' });
  const [restoring, setRestoring] = useState(false);
  const fileRef = useRef(null);

  const createBackup = async () => {
    setBusy('create');
    try {
      const data = await api.post('/settings/backup');
      toast.success(data.message);
      onSaved();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy('');
    }
  };

  const downloadJson = async () => {
    setBusy('json');
    try {
      await downloadFile('/settings/backup?images=true', 'tallertech-respaldo.json');
      toast.success('Respaldo JSON descargado.');
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy('');
    }
  };

  const downloadDb = async (file) => {
    try {
      await downloadFile(`/settings/backups/${encodeURIComponent(file)}`, file);
    } catch (error) {
      toast.error(error.message);
    }
  };

  const selectRestore = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      toast.error('Seleccioná un archivo de respaldo JSON.');
      return;
    }
    const accepted = await confirm({ title: 'Restaurar respaldo', message: 'La restauración reemplazará todos los datos actuales por los del archivo. Se recomienda descargar un respaldo antes de continuar.', confirmLabel: 'Seleccionar archivo' });
    if (!accepted) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.app !== 'TallerTech Manager' || !parsed.tables) throw new Error('El archivo no es un respaldo válido de TallerTech Manager.');
      setRestoreFile({ name: file.name, data: parsed });
      setRestoreForm({ password: '', confirmation: '' });
      setRestoreOpen(true);
    } catch (error) {
      toast.error(error.message || 'No se pudo leer el archivo.');
    }
  };

  const restore = async (event) => {
    event.preventDefault();
    if (!restoreFile) return;
    setRestoring(true);
    try {
      const data = await api.post('/settings/restore', { ...restoreForm, backup: restoreFile.data });
      toast.success(data.message);
      setRestoreOpen(false);
      setTimeout(() => { window.location.href = '/login'; }, 1000);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="card overflow-hidden">
        <div className="border-b border-white/[0.06] px-4 py-4 sm:px-5"><h2 className="section-title">Respaldos</h2><p className="mt-0.5 text-xs text-slate-500">Descargá copias completas o creá un punto de restauración de la base de datos.</p></div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          <button type="button" onClick={downloadJson} disabled={busy === 'json'} className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-left transition hover:border-tech-500/30 hover:bg-tech-500/[0.04]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-tech-500/10 text-tech-400"><Download size={18} /></div>
            <div><p className="text-sm font-semibold text-slate-200">Respaldo JSON completo</p><p className="mt-1 text-[11px] leading-relaxed text-slate-500">Incluye datos y fotografías. Sirve para restaurar en línea desde esta misma pantalla.</p></div>
          </button>
          <button type="button" onClick={createBackup} disabled={busy === 'create'} className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-left transition hover:border-tech-500/30 hover:bg-tech-500/[0.04]">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400"><Database size={18} /></div>
            <div><p className="text-sm font-semibold text-slate-200">Instantánea de base de datos</p><p className="mt-1 text-[11px] leading-relaxed text-slate-500">Copia binaria SQLite (sin imágenes). Se conservan los últimos 12 respaldos automáticos.</p></div>
          </button>
        </div>
        <div className="border-t border-white/[0.06]">
          <div className="flex items-center justify-between px-4 py-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Resguardos disponibles</p><span className="text-[10px] text-slate-600">{settingsData.backups?.length || 0} archivos</span></div>
          {(settingsData.backups || []).length === 0 ? <p className="px-4 pb-4 text-xs text-slate-500">No hay respaldos de base de datos todavía.</p> : (
            <div className="divide-y divide-white/[0.04]">
              {settingsData.backups.map((backup) => (
                <div key={backup.file} className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                  <HardDrive size={15} className="shrink-0 text-slate-500" />
                  <div className="min-w-0 flex-1"><p className="truncate font-mono text-[10px] text-slate-300">{backup.file}</p><p className="text-[9px] text-slate-600">{formatDateTime(backup.created_at)} · {(backup.size / 1024).toFixed(0)} KB</p></div>
                  <button type="button" className="icon-btn h-8 w-8" onClick={() => downloadDb(backup.file)} title="Descargar"><Download size={14} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card overflow-hidden border-rose-500/15">
        <div className="border-b border-rose-500/10 bg-rose-500/[0.035] px-4 py-4 sm:px-5"><h2 className="flex items-center gap-2 text-sm font-semibold text-rose-200"><ArchiveRestore size={16} /> Restaurar desde un respaldo</h2><p className="mt-1 text-xs text-rose-200/50">Esta acción reemplaza todos los datos actuales. Requiere contraseña de administrador y confirmación escrita.</p></div>
        <div className="p-4 sm:p-5">
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={selectRestore} />
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-danger"><Upload size={16} /> Seleccionar respaldo JSON</button>
        </div>
      </div>

      <Modal open={restoreOpen} onClose={() => setRestoreOpen(false)} title="Confirmar restauración" subtitle={restoreFile?.name} size="sm">
        <form onSubmit={restore} className="space-y-4">
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-[11px] leading-relaxed text-rose-200"><AlertTriangle size={16} className="mt-0.5 shrink-0" /> Se reemplazarán todos los datos del sistema y se cerrará tu sesión. Esta operación no se puede deshacer.</div>
          <div><label className="label">Contraseña de administrador</label><input className="input" type="password" value={restoreForm.password} onChange={(event) => setRestoreForm({ ...restoreForm, password: event.target.value })} required autoComplete="current-password" /></div>
          <div><label className="label">Escribí RESTAURAR para confirmar</label><input className="input font-mono" value={restoreForm.confirmation} onChange={(event) => setRestoreForm({ ...restoreForm, confirmation: event.target.value.toUpperCase() })} required /></div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><button type="button" className="btn-secondary" onClick={() => setRestoreOpen(false)}>Cancelar</button><button type="submit" className="btn-danger" disabled={restoring || restoreForm.confirmation !== 'RESTAURAR'}>{restoring ? 'Restaurando…' : 'Restaurar datos'}</button></div>
        </form>
      </Modal>
    </div>
  );
}

export default function Settings() {
  useDocumentTitle('Configuración');
  const { isAdmin, user } = useAuth();
  const { toast } = useUI();
  const { data, loading, refetch } = useApiQuery('/settings');
  const { data: meta, refetch: refetchMeta } = useApiQuery('/meta');
  const [tab, setTab] = useState('general');

  if (loading && !data) return <LoadingScreen label="Cargando configuración…" />;

  const settingsData = data;

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Sistema"
        title="Configuración"
        subtitle="Datos del taller, usuarios, tipos de equipo y respaldos de información."
        icon={SettingsIcon}
      />
      {!isAdmin && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs text-amber-200"><Shield size={15} className="mt-0.5 shrink-0" /> Solo los administradores pueden modificar la configuración. Podés consultar los datos del taller.</div>
      )}
      <Tabs
        tabs={[
          { value: 'general', label: 'General', icon: SettingsIcon },
          ...(isAdmin ? [{ value: 'users', label: 'Usuarios y técnicos', icon: Users }, { value: 'equipment', label: 'Tipos de equipo', icon: Wrench }, { value: 'backup', label: 'Respaldos', icon: Database }] : []),
        ]}
        active={tab}
        onChange={setTab}
      />
      <div className="mt-4">
        {tab === 'general' && <GeneralTab settingsData={data} onSaved={refetch} />}
        {tab === 'users' && isAdmin && <UsersTab onSaved={() => { refetch(); refetchMeta(); }} />}
        {tab === 'equipment' && isAdmin && <EquipmentTab meta={meta} onSaved={refetchMeta} />}
        {tab === 'backup' && isAdmin && <BackupTab settingsData={data} onSaved={refetch} />}
      </div>
    </div>
  );
}
