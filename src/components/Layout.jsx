import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Boxes,
  Camera,
  ChevronDown,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  Shield,
  Users,
  Wallet,
  WifiOff,
  Wrench,
  X,
  Zap,
} from 'lucide-react';
import { useAuth } from '../context/AuthProvider.jsx';
import { useUI } from '../context/UIProvider.jsx';
import { useApiQuery } from '../hooks/useApi.js';
import { api } from '../lib/api.js';
import { classNames, formatDateTime } from '../lib/format.js';
import { Logo, Avatar } from './ui.jsx';
import Modal from './Modal.jsx';
import PwaInstall from './PwaInstall.jsx';

const NAV_GROUPS = [
  {
    label: 'Operaciones',
    items: [
      { to: '/dashboard', label: 'Panel general', icon: LayoutDashboard, end: true },
      { to: '/recepcion', label: 'Recepción rápida', icon: Zap },
      { to: '/ordenes', label: 'Órdenes de reparación', icon: ClipboardList },
      { to: '/reparaciones', label: 'Tablero de taller', icon: Wrench },
      { to: '/clientes', label: 'Clientes', icon: Users },
    ],
  },
  {
    label: 'Recursos',
    items: [
      { to: '/inventario', label: 'Inventario', icon: Boxes },
      { to: '/finanzas', label: 'Finanzas', icon: Wallet },
      { to: '/reportes', label: 'Reportes', icon: BarChart3 },
    ],
  },
  {
    label: 'Sistema',
    items: [{ to: '/configuracion', label: 'Configuración', icon: Settings }],
  },
];

const MOBILE_TABS = [
  { to: '/dashboard', label: 'Panel', icon: LayoutDashboard, end: true },
  { to: '/ordenes', label: 'Órdenes', icon: ClipboardList },
  { to: '/recepcion', label: 'Recepción', icon: Camera, primary: true },
  { to: '/inventario', label: 'Stock', icon: Boxes },
  { to: '/finanzas', label: 'Caja', icon: Wallet },
];

const PAGE_TITLES = [
  { match: /^\/dashboard/, title: 'Panel general' },
  { match: /^\/recepcion/, title: 'Recepción rápida' },
  { match: /^\/ordenes\/nueva/, title: 'Ingreso de equipo' },
  { match: /^\/ordenes\/.+/, title: 'Detalle de orden' },
  { match: /^\/ordenes/, title: 'Órdenes de reparación' },
  { match: /^\/reparaciones/, title: 'Tablero de taller' },
  { match: /^\/clientes\/.+/, title: 'Ficha de cliente' },
  { match: /^\/clientes/, title: 'Clientes' },
  { match: /^\/inventario/, title: 'Inventario' },
  { match: /^\/finanzas/, title: 'Finanzas' },
  { match: /^\/reportes/, title: 'Reportes' },
  { match: /^\/configuracion/, title: 'Configuración' },
];

function SidebarNav({ onNavigate }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[72px] shrink-0 items-center justify-between px-5">
        <Link to="/dashboard" onClick={onNavigate} aria-label="Ir al panel">
          <Logo />
        </Link>
        <button type="button" onClick={onNavigate} className="icon-btn -mr-2 lg:hidden" aria-label="Cerrar menú">
          <X size={20} />
        </button>
      </div>

      <div className="px-4 pb-4">
        <Link
          to="/ordenes/nueva"
          onClick={onNavigate}
          className="flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-tech-600 px-3 text-sm font-semibold text-white shadow-lg shadow-tech-950/40 transition hover:bg-tech-500"
        >
          <Plus size={16} strokeWidth={2.5} /> Nuevo ingreso
        </Link>
      </div>

      <nav className="no-scrollbar flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) => classNames('nav-item', isActive && 'nav-item-active')}
                >
                  {({ isActive }) => (
                    <>
                      <item.icon size={18} className={isActive ? 'text-tech-400' : 'text-slate-500'} />
                      <span className="truncate">{item.label}</span>
                      {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-tech-400 shadow-[0_0_8px_rgba(51,155,255,0.9)]" />}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/[0.06] p-3">
        <div className="flex items-center gap-2 rounded-xl bg-white/[0.025] p-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
            <Shield size={15} />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-slate-300">Datos protegidos</p>
            <p className="truncate text-[10px] text-slate-600">SQLite · sesión segura</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ open, onClose }) {
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] border-r border-white/[0.06] bg-ink-900/95 backdrop-blur-xl lg:block">
        <SidebarNav />
      </aside>
      {open && (
        <>
          <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
          <aside className="fixed inset-y-0 left-0 z-50 w-[286px] animate-slide-up border-r border-white/10 bg-ink-900 shadow-2xl lg:hidden">
            <SidebarNav onNavigate={onClose} />
          </aside>
        </>
      )}
    </>
  );
}

function ChangePasswordModal({ open, onClose }) {
  const { toast } = useUI();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', repeat: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setForm({ currentPassword: '', newPassword: '', repeat: '' });
      setError('');
    }
  }, [open]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (form.newPassword !== form.repeat) {
      setError('Las contraseñas nuevas no coinciden.');
      return;
    }
    setSaving(true);
    try {
      const data = await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      toast.success(data.message || 'Contraseña actualizada.');
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
      title="Cambiar contraseña"
      subtitle="Usá al menos 8 caracteres, con letras y números."
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" form="change-password-form" className="btn-primary" disabled={saving}>
            {saving ? 'Guardando…' : 'Actualizar contraseña'}
          </button>
        </div>
      }
    >
      <form id="change-password-form" onSubmit={submit} className="space-y-4">
        {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">{error}</div>}
        <div>
          <label className="label" htmlFor="current-password">Contraseña actual</label>
          <input
            id="current-password"
            type="password"
            className="input"
            value={form.currentPassword}
            onChange={(event) => setForm({ ...form, currentPassword: event.target.value })}
            autoComplete="current-password"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="new-password">Nueva contraseña</label>
          <input
            id="new-password"
            type="password"
            className="input"
            value={form.newPassword}
            onChange={(event) => setForm({ ...form, newPassword: event.target.value })}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="repeat-password">Repetir nueva contraseña</label>
          <input
            id="repeat-password"
            type="password"
            className="input"
            value={form.repeat}
            onChange={(event) => setForm({ ...form, repeat: event.target.value })}
            autoComplete="new-password"
            minLength={8}
            required
          />
        </div>
      </form>
    </Modal>
  );
}

function Topbar({ onOpenMenu }) {
  const { user, logout, isAdmin } = useAuth();
  const { toast } = useUI();
  const location = useLocation();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [userMenu, setUserMenu] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const title = PAGE_TITLES.find((item) => item.match.test(location.pathname))?.title || 'TallerTech Manager';
  const { data: alerts } = useApiQuery('/inventory/alerts', { onError: () => {} });
  const alertCount = alerts?.count || 0;

  useEffect(() => {
    setUserMenu(false);
  }, [location.pathname]);

  const submitSearch = (event) => {
    event.preventDefault();
    const value = search.trim();
    if (!value) return;
    navigate(`/ordenes?search=${encodeURIComponent(value)}`);
    setSearch('');
  };

  const doLogout = async () => {
    try {
      await logout();
      toast.info('Cerraste sesión correctamente.');
      navigate('/login', { replace: true });
    } catch {
      toast.error('No se pudo cerrar la sesión.');
    }
  };

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink-950/85 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-3 sm:px-5 lg:h-[68px] lg:px-7">
          <button type="button" onClick={onOpenMenu} className="icon-btn -ml-1.5 lg:hidden" aria-label="Abrir menú">
            <Menu size={21} />
          </button>
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-sm font-semibold text-slate-200">{title}</p>
            <p className="hidden text-[11px] text-slate-600 md:block">
              {new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}
            </p>
          </div>

          <form onSubmit={submitSearch} className="relative ml-auto w-full max-w-[300px] sm:ml-0 sm:w-[300px]">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar orden, cliente, equipo…"
              className="input min-h-[38px] rounded-lg border-white/[0.07] bg-white/[0.03] py-2 pl-9 pr-3 text-xs"
              aria-label="Búsqueda global"
            />
          </form>

          <Link
            to="/inventario?lowStock=1"
            className="icon-btn relative h-10 w-10 shrink-0"
            title={alertCount ? `${alertCount} productos con stock bajo` : 'Sin alertas de stock'}
            aria-label="Alertas de inventario"
          >
            <Bell size={19} />
            {alertCount > 0 && (
              <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-ink-950">
                {alertCount > 9 ? '9+' : alertCount}
              </span>
            )}
          </Link>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setUserMenu((value) => !value)}
              className="flex items-center gap-2 rounded-xl border border-transparent p-1 pr-1.5 transition hover:border-white/10 hover:bg-white/[0.04]"
              aria-label="Menú de usuario"
              aria-expanded={userMenu}
            >
              <Avatar firstName={user?.fullName?.split(' ')[0]} lastName={user?.fullName?.split(' ')[1]} size="sm" />
              <div className="hidden max-w-[150px] text-left xl:block">
                <p className="truncate text-xs font-semibold text-slate-200">{user?.fullName}</p>
                <p className="text-[10px] capitalize text-slate-500">{user?.role === 'admin' ? 'Administrador' : 'Técnico'}</p>
              </div>
              <ChevronDown size={14} className="hidden text-slate-500 xl:block" />
            </button>
            {userMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setUserMenu(false)} aria-hidden="true" />
                <div className="absolute right-0 top-full z-20 mt-2 w-64 animate-fade-in overflow-hidden rounded-xl border border-white/10 bg-ink-850 shadow-2xl">
                  <div className="border-b border-white/[0.07] p-4">
                    <p className="text-sm font-semibold text-white">{user?.fullName}</p>
                    <p className="mt-0.5 text-xs text-slate-500">@{user?.username}</p>
                    <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
                      <Shield size={12} /> {user?.role === 'admin' ? 'Acceso administrador' : 'Acceso técnico'}
                      {user?.lastLogin && <span className="ml-auto">{formatDateTime(user.lastLogin)}</span>}
                    </div>
                  </div>
                  <div className="p-1.5">
                    <button
                      type="button"
                      onClick={() => { setUserMenu(false); setPasswordModal(true); }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-slate-300 transition hover:bg-white/[0.05]"
                    >
                      <Shield size={15} className="text-slate-500" /> Cambiar contraseña
                    </button>
                    {isAdmin && (
                      <Link
                        to="/configuracion"
                        onClick={() => setUserMenu(false)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-slate-300 transition hover:bg-white/[0.05]"
                      >
                        <Settings size={15} className="text-slate-500" /> Configuración
                      </Link>
                    )}
                    <button
                      type="button"
                      onClick={doLogout}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-rose-300 transition hover:bg-rose-500/10"
                    >
                      <LogOut size={15} /> Cerrar sesión
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <ChangePasswordModal open={passwordModal} onClose={() => setPasswordModal(false)} />
    </>
  );
}

function MobileBottomNav() {
  return (
    <nav className="bottom-safe fixed inset-x-0 bottom-0 z-30 border-t border-white/[0.07] bg-ink-950/95 backdrop-blur-xl lg:hidden">
      <div className="flex h-[62px] items-stretch px-1.5">
        {MOBILE_TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) => classNames('mobile-tab', isActive && !tab.primary && 'mobile-tab-active')}
          >
            {({ isActive }) =>
              tab.primary ? (
                <>
                  <span className="mb-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-tech-600 text-white shadow-lg shadow-tech-950/50">
                    <tab.icon size={20} strokeWidth={2.5} />
                  </span>
                  <span className="sr-only">{tab.label}</span>
                </>
              ) : (
                <>
                  <span className={classNames('flex h-7 w-9 items-center justify-center rounded-lg', isActive && 'bg-tech-500/10')}>
                    <tab.icon size={19} />
                  </span>
                  <span>{tab.label}</span>
                </>
              )
            }
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export default function AppLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = () => setMenuOpen(false);
    window.addEventListener('popstate', close);
    return () => window.removeEventListener('popstate', close);
  }, [menuOpen]);

  return (
    <div className="min-h-screen lg:pl-[260px]">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />
      <Topbar onOpenMenu={() => setMenuOpen(true)} />
      {!online && (
        <div className="sticky top-16 z-20 flex items-center justify-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] font-medium text-amber-200 lg:top-[68px]">
          <WifiOff size={13} /> Sin conexión. Podés seguir cargando el borrador; se guardará cuando vuelva internet.
        </div>
      )}
      <main className="mx-auto w-full max-w-[1680px] px-3 pb-24 pt-4 sm:px-5 sm:pt-5 lg:px-7 lg:pb-8 lg:pt-6">
        <Outlet />
      </main>
      <MobileBottomNav />
      <PwaInstall />
    </div>
  );
}
