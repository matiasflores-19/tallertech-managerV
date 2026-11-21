import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  Boxes,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  User,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../context/AuthProvider.jsx';
import { useDocumentTitle } from '../hooks/useApi.js';
import { Logo } from '../components/ui.jsx';

export default function Login() {
  useDocumentTitle('Ingresar');
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: 'admin', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true });
  }, [user, loading, navigate]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setFieldErrors({});
    if (!form.username.trim() || !form.password) {
      setFieldErrors({
        username: !form.username.trim() ? 'Ingresá tu usuario.' : '',
        password: !form.password ? 'Ingresá tu contraseña.' : '',
      });
      return;
    }
    setSubmitting(true);
    try {
      await login(form.username.trim(), form.password);
      navigate('/dashboard', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'No se pudo iniciar sesión.');
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = () => {
    setForm({ username: 'admin', password: 'Admin1234!' });
    setError('');
    setFieldErrors({});
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-ink-950">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.035)_1px,transparent_1px)] bg-[size:44px_44px] [mask-image:radial-gradient(ellipse_at_center,black_25%,transparent_78%)]" />
      <div className="pointer-events-none absolute -left-40 top-1/4 h-[420px] w-[420px] rounded-full bg-tech-600/15 blur-[120px]" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-[360px] w-[360px] rounded-full bg-cyan-500/10 blur-[110px]" />

      <div className="relative hidden w-[52%] flex-col justify-between border-r border-white/[0.06] p-10 lg:flex xl:p-14">
        <Logo />

        <div className="max-w-xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-tech-500/20 bg-tech-500/10 px-3 py-1.5 text-[11px] font-semibold text-tech-300">
            <span className="h-1.5 w-1.5 rounded-full bg-tech-400 shadow-[0_0_8px_rgba(51,155,255,0.9)]" />
            Sistema de gestión para talleres técnicos
          </div>
          <h1 className="text-balance text-4xl font-bold leading-[1.08] tracking-tight text-white xl:text-5xl">
            Cada equipo, cada reparación y cada peso,
            <span className="bg-gradient-to-r from-tech-300 to-cyan-300 bg-clip-text text-transparent"> bajo control.</span>
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-relaxed text-slate-400">
            Centralizá ingresos, diagnósticos, repuestos, cobros y clientes en una única plataforma pensada para el trabajo diario del taller.
          </p>

          <div className="mt-9 grid grid-cols-2 gap-3">
            {[
              { icon: Wrench, title: 'Reparaciones', text: 'Estados, historial y técnicos' },
              { icon: Boxes, title: 'Inventario', text: 'Stock, movimientos y alertas' },
              { icon: BarChart3, title: 'Finanzas', text: 'Cobros, gastos y rentabilidad' },
              { icon: ShieldCheck, title: 'Seguridad', text: 'Usuarios, roles y respaldos' },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 backdrop-blur-sm">
                <item.icon size={18} className="text-tech-400" />
                <p className="mt-3 text-sm font-semibold text-slate-100">{item.title}</p>
                <p className="mt-1 text-xs text-slate-500">{item.text}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-5 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> Datos persistentes</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> Responsive</span>
          <span className="inline-flex items-center gap-1.5"><CheckCircle2 size={13} className="text-emerald-500" /> Reportes PDF / Excel</span>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
        <div className="w-full max-w-[420px] animate-fade-in">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>

          <div className="rounded-3xl border border-white/[0.08] bg-ink-850/80 p-5 shadow-panel backdrop-blur-xl sm:p-8">
            <div className="mb-7">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-tech-500/20 bg-tech-500/10 text-tech-400">
                <LockKeyhole size={21} />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Ingresá al sistema</h2>
              <p className="mt-1.5 text-sm text-slate-400">Accedé con tu usuario para administrar el taller.</p>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3.5 py-3 text-sm text-rose-300" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={submit} className="space-y-4" noValidate>
              <div>
                <label htmlFor="username" className="label">Usuario</label>
                <div className="relative">
                  <User size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="username"
                    name="username"
                    autoComplete="username"
                    className="input pl-10"
                    placeholder="Ej. admin"
                    value={form.username}
                    onChange={(event) => setForm({ ...form, username: event.target.value })}
                    aria-invalid={Boolean(fieldErrors.username)}
                  />
                </div>
                {fieldErrors.username && <p className="mt-1.5 text-xs text-rose-400">{fieldErrors.username}</p>}
              </div>

              <div>
                <label htmlFor="password" className="label">Contraseña</label>
                <div className="relative">
                  <LockKeyhole size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    className="input pl-10 pr-11"
                    placeholder="Tu contraseña"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    aria-invalid={Boolean(fieldErrors.password)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white/5 hover:text-slate-200"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {fieldErrors.password && <p className="mt-1.5 text-xs text-rose-400">{fieldErrors.password}</p>}
              </div>

              <button type="submit" className="btn-primary mt-2 w-full" disabled={submitting}>
                {submitting ? 'Verificando…' : <>Ingresar <ArrowRight size={17} /></>}
              </button>
            </form>

            <div className="mt-6 rounded-xl border border-white/[0.06] bg-white/[0.025] p-3.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Acceso de demostración</p>
                  <p className="mt-1 font-mono text-[11px] text-slate-400">admin / Admin1234!</p>
                </div>
                <button type="button" onClick={fillDemo} className="btn-secondary btn-sm shrink-0">
                  Completar
                </button>
              </div>
            </div>
          </div>

          <p className="mt-5 text-center text-[11px] leading-relaxed text-slate-600">
            TallerTech Manager · v1.0.0 · La información se almacena de forma local y persistente.
            <br />
            Cambiá la contraseña inicial antes de usar el sistema en producción.
          </p>
        </div>
      </div>
    </div>
  );
}
