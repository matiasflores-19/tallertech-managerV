import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from 'lucide-react';
import { classNames } from '../lib/format.js';
import { PRIORITY_META, STATUS_META, STATUS_STYLES } from '../lib/constants.js';

export function Logo({ compact = false, className = '' }) {
  return (
    <div className={classNames('flex items-center gap-3', className)}>
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-tech-500 to-tech-700 shadow-glow">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_45%)]" />
        <span className="relative font-mono text-sm font-black tracking-tighter text-white">TT</span>
      </div>
      {!compact && (
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold leading-tight tracking-tight text-white">
            TallerTech <span className="text-tech-400">Manager</span>
          </p>
          <p className="mt-0.5 truncate text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
            Gestión técnica integral
          </p>
        </div>
      )}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, icon: Icon, actions, backTo, children }) {
  return (
    <div className="mb-5 sm:mb-6">
      {backTo && (
        <Link to={backTo} className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-white">
          <ArrowLeft size={14} /> Volver
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-tech-500/20 bg-tech-500/10 text-tech-400 sm:flex">
              <Icon size={21} />
            </div>
          )}
          <div className="min-w-0">
            {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
            <h1 className="text-balance text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h1>
            {subtitle && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">{subtitle}</p>}
            {children}
          </div>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

const STAT_TONES = {
  blue: 'border-tech-500/15 bg-tech-500/10 text-tech-400',
  emerald: 'border-emerald-500/15 bg-emerald-500/10 text-emerald-400',
  amber: 'border-amber-500/15 bg-amber-500/10 text-amber-400',
  rose: 'border-rose-500/15 bg-rose-500/10 text-rose-400',
  violet: 'border-violet-500/15 bg-violet-500/10 text-violet-400',
  cyan: 'border-cyan-500/15 bg-cyan-500/10 text-cyan-400',
  slate: 'border-slate-500/15 bg-slate-500/10 text-slate-300',
  indigo: 'border-indigo-500/15 bg-indigo-500/10 text-indigo-400',
};

export function StatCard({ label, value, hint, icon: Icon, tone = 'blue', to, onClick, className = '' }) {
  const content = (
    <div
      className={classNames(
        'group h-full rounded-2xl border border-white/[0.06] bg-ink-850/80 p-4 shadow-panel transition duration-200',
        (to || onClick) && 'cursor-pointer hover:-translate-y-0.5 hover:border-white/[0.12] hover:bg-ink-800/90',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-wider text-slate-500">{label}</p>
        {Icon && (
          <div className={classNames('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border', STAT_TONES[tone] || STAT_TONES.blue)}>
            <Icon size={16} />
          </div>
        )}
      </div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <p className="text-xl font-bold tracking-tight text-white sm:text-2xl">{value}</p>
        {to && <ArrowRight size={15} className="mb-1 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-300" />}
      </div>
      {hint && <p className="mt-1 text-[11px] leading-snug text-slate-500">{hint}</p>}
    </div>
  );
  if (to) return <Link to={to}>{content}</Link>;
  if (onClick) return <button type="button" onClick={onClick} className="block w-full text-left">{content}</button>;
  return content;
}

export function StatusBadge({ status, className = '', dot = true }) {
  const meta = STATUS_META[status] || { label: status, tone: 'slate' };
  return (
    <span className={classNames('badge', STATUS_STYLES[meta.tone] || STATUS_STYLES.slate, className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {meta.label}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const meta = PRIORITY_META[priority] || PRIORITY_META.NORMAL;
  return <span className={classNames('badge', meta.style)}>{meta.label}</span>;
}

export function SearchInput({ value, onChange, placeholder = 'Buscar…', className = '', autoFocus = false }) {
  return (
    <div className={classNames('relative', className)}>
      <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="input min-h-[42px] pl-10 pr-9 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:bg-white/5 hover:text-white"
          aria-label="Limpiar búsqueda"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function Pagination({ page, totalPages, total, onChange }) {
  if (!totalPages || totalPages <= 1) {
    return total !== undefined ? <p className="text-xs text-slate-500">{total} registro{total === 1 ? '' : 's'}</p> : null;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-slate-500">
        Página <span className="font-semibold text-slate-300">{page}</span> de {totalPages}
        {total !== undefined && <span className="hidden sm:inline"> · {total} registros</span>}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="icon-btn h-9 w-9 border border-white/10"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          type="button"
          className="icon-btn h-9 w-9 border border-white/10"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          aria-label="Página siguiente"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className = '' }) {
  return (
    <div className={classNames('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03] text-slate-500">
          <Icon size={24} />
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-200">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ size = 22, className = '' }) {
  return (
    <span
      className={classNames('inline-block animate-spin rounded-full border-2 border-slate-600 border-t-tech-400', className)}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Cargando"
    />
  );
}

export function LoadingScreen({ label = 'Cargando…' }) {
  return (
    <div className="flex min-h-[45vh] flex-col items-center justify-center gap-4">
      <div className="relative">
        <div className="absolute inset-0 rounded-2xl bg-tech-500/20 blur-xl" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-tech-500/20 bg-ink-850">
          <Spinner size={24} />
        </div>
      </div>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

export function TableSkeleton({ rows = 6 }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-4">
          <div className="skeleton h-10 w-10 rounded-xl" />
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-2.5 w-1/5" />
          </div>
          <div className="skeleton h-6 w-24 rounded-full" />
        </div>
      ))}
    </div>
  );
}

export function DetailField({ label, children, className = '' }) {
  return (
    <div className={className}>
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium leading-snug text-slate-200">{children ?? '—'}</dd>
    </div>
  );
}

export function SectionHeader({ title, subtitle, actions, icon: Icon }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3.5 sm:px-5">
      <div className="flex items-start gap-2.5">
        {Icon && <Icon size={17} className="mt-0.5 text-slate-500" />}
        <div>
          <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Avatar({ firstName = '', lastName = '', size = 'md', className = '' }) {
  const dimensions = size === 'lg' ? 'h-12 w-12 text-base' : size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-10 w-10 text-xs';
  return (
    <div
      className={classNames(
        'flex shrink-0 items-center justify-center rounded-xl border border-white/[0.08] bg-gradient-to-br from-tech-500/25 to-slate-700/30 font-bold text-tech-200',
        dimensions,
        className,
      )}
    >
      {`${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase() || '?'}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }) {
  return (
    <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl border border-white/[0.06] bg-ink-900/70 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          onClick={() => onChange(tab.value)}
          className={classNames(
            'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition',
            active === tab.value
              ? 'bg-white/[0.08] text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-200',
          )}
        >
          {tab.icon && <tab.icon size={14} />}
          {tab.label}
          {tab.count !== undefined && (
            <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-400">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function BackLink({ to, children = 'Volver' }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-white">
      <ArrowLeft size={14} /> {children}
    </Link>
  );
}

export { ArrowLeft, ArrowRight };
