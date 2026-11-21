import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Coins,
  Cpu,
  Download,
  FileSpreadsheet,
  FileText,
  ListFilter,
  Loader2,
  Package,
  RefreshCw,
  TrendingUp,
  Wrench,
} from 'lucide-react';
import { useApiQuery, useDocumentTitle } from '../hooks/useApi.js';
import { useUI } from '../context/UIProvider.jsx';
import { downloadFile } from '../lib/api.js';
import { daysAgoISO, formatDate, monthStartISO, todayISO } from '../lib/format.js';
import { REPORT_KINDS, STATUS_META, ORDER_STATUSES } from '../lib/constants.js';
import { EmptyState, PageHeader, SearchInput, TableSkeleton } from '../components/ui.jsx';

const ICONS = { wrench: Wrench, clock: Clock3, check: CheckCircle2, coins: Coins, cpu: Cpu, boxes: Package, chart: TrendingUp };
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function monthRange(offset) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), label: `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}` };
}

export default function Reports() {
  useDocumentTitle('Reportes');
  const { toast } = useUI();
  const [kind, setKind] = useState('reparaciones');
  const [from, setFrom] = useState(monthStartISO());
  const [to, setTo] = useState(todayISO());
  const [status, setStatus] = useState('');
  const [equipmentType, setEquipmentType] = useState('');
  const [technician, setTechnician] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState('');
  const { data: meta } = useApiQuery('/meta');

  const reportKind = REPORT_KINDS.find((item) => item.value === kind);
  const showOrderFilters = ['reparaciones', 'pendientes', 'entregados'].includes(kind);

  const params = useMemo(() => {
    const query = new URLSearchParams({ kind, from, to });
    if (status) query.set('status', status);
    if (equipmentType) query.set('equipment_type_id', equipmentType);
    if (technician) query.set('technician_id', technician);
    if (search) query.set('search', search);
    return query.toString();
  }, [kind, from, to, status, equipmentType, technician, search]);

  const { data, loading, error, refetch } = useApiQuery(`/reports/data?${params}`);
  const report = data?.report;

  useEffect(() => {
    if (kind === 'stock') {
      setFrom(monthStartISO());
      setTo(todayISO());
    }
  }, [kind]);

  const applyPreset = (preset) => {
    if (preset === 'month') { setFrom(monthStartISO()); setTo(todayISO()); }
    if (preset === 'last') { const range = monthRange(-1); setFrom(range.from); setTo(range.to); }
    if (preset === '30') { setFrom(daysAgoISO(30)); setTo(todayISO()); }
    if (preset === 'year') { setFrom(`${new Date().getFullYear()}-01-01`); setTo(todayISO()); }
  };

  const exportReport = async (format) => {
    setExporting(format);
    try {
      await downloadFile(`/reports/export?${params}&format=${format}`, `${kind}-${from}-${to}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      toast.success(`Reporte ${format === 'pdf' ? 'PDF' : 'Excel'} descargado.`);
    } catch (requestError) {
      toast.error(requestError.message);
    } finally {
      setExporting('');
    }
  };

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow="Análisis"
        title="Reportes"
        subtitle="Generá reportes operativos y financieros por período, con exportación a PDF y Excel."
        icon={BarChart3}
        actions={
          <>
            <button type="button" className="btn-secondary" onClick={() => exportReport('pdf')} disabled={exporting === 'pdf'}>
              {exporting === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} PDF
            </button>
            <button type="button" className="btn-primary" onClick={() => exportReport('xlsx')} disabled={exporting === 'xlsx'}>
              {exporting === 'xlsx' ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />} Excel
            </button>
          </>
        }
      />

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {REPORT_KINDS.map((item) => {
          const Icon = ICONS[item.icon] || BarChart3;
          const active = kind === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setKind(item.value)}
              className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${active ? 'border-tech-500/40 bg-tech-500/10 shadow-glow' : 'border-white/[0.06] bg-ink-850/70 hover:border-white/[0.14] hover:bg-ink-800/80'}`}
            >
              <Icon size={18} className={active ? 'mt-0.5 shrink-0 text-tech-400' : 'mt-0.5 shrink-0 text-slate-500'} />
              <span className={`text-[11px] font-semibold leading-snug ${active ? 'text-slate-100' : 'text-slate-400'}`}>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 card p-3 sm:p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><CalendarDays size={13} /> Período</span>
            {[{ value: 'month', label: 'Mes actual' }, { value: 'last', label: 'Mes anterior' }, { value: '30', label: 'Últimos 30 días' }, { value: 'year', label: 'Este año' }].map((preset) => (
              <button key={preset.value} type="button" onClick={() => applyPreset(preset.value)} className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-500 transition hover:bg-white/[0.05] hover:text-slate-200">{preset.label}</button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              <input type="date" className="input min-h-[34px] w-auto py-1.5 text-xs" value={from} max={to} onChange={(event) => setFrom(event.target.value)} />
              <span className="text-xs text-slate-600">a</span>
              <input type="date" className="input min-h-[34px] w-auto py-1.5 text-xs" value={to} min={from} onChange={(event) => setTo(event.target.value)} />
            </div>
          </div>
          {showOrderFilters && (
            <div className="grid gap-2 border-t border-white/[0.06] pt-3 sm:grid-cols-2 lg:grid-cols-4">
              <select className="select min-h-[38px] py-2 text-xs" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todos los estados</option>{ORDER_STATUSES.map((value) => <option key={value} value={value}>{STATUS_META[value].label}</option>)}</select>
              <select className="select min-h-[38px] py-2 text-xs" value={equipmentType} onChange={(event) => setEquipmentType(event.target.value)}><option value="">Todos los equipos</option>{(meta?.equipmentTypes || []).map((type) => <option key={type.id} value={type.id}>{type.name}</option>)}</select>
              <select className="select min-h-[38px] py-2 text-xs" value={technician} onChange={(event) => setTechnician(event.target.value)}><option value="">Todos los técnicos</option>{(meta?.technicians || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
              <SearchInput value={search} onChange={setSearch} placeholder="Buscar en el reporte…" className="[&_input]:min-h-[38px] [&_input]:py-2 [&_input]:text-xs" />
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-slate-200">{report?.title || reportKind?.label}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">{reportKind?.description} · {formatDate(from)} al {formatDate(to)}</p>
        </div>
        <button type="button" className="btn-ghost btn-sm self-start sm:self-auto" onClick={refetch}><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Actualizar vista previa</button>
      </div>

      {loading && !report ? (
        <div className="card mt-3"><TableSkeleton rows={8} /></div>
      ) : error && !report ? (
        <div className="card mt-3"><EmptyState icon={BarChart3} title="No se pudo generar el reporte" description={error.message} action={<button className="btn-primary" onClick={refetch}>Reintentar</button>} /></div>
      ) : report ? (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {report.summary.map((item) => (
              <div key={item.label} className="card p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{item.label}</p>
                <p className="mt-1.5 text-lg font-bold text-white">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
              <p className="text-xs text-slate-500"><span className="font-semibold text-slate-300">{report.rows.length}</span> filas · {formatDate(report.from)} — {formatDate(report.to)}</p>
              <div className="flex gap-2">
                <button type="button" className="btn-secondary btn-sm" onClick={() => exportReport('pdf')} disabled={Boolean(exporting)}><Download size={13} /> PDF</button>
                <button type="button" className="btn-secondary btn-sm" onClick={() => exportReport('xlsx')} disabled={Boolean(exporting)}><TableIcon /> Excel</button>
              </div>
            </div>
            {report.rows.length === 0 ? (
              <EmptyState icon={ListFilter} title="Sin datos para el período" description="Probá ampliar el rango de fechas o cambiar los filtros." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] border-collapse text-left text-xs">
                  <thead><tr className="border-b border-white/[0.07] bg-white/[0.02]">{report.columns.map((column) => <th key={column.key} className={`whitespace-nowrap px-3.5 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 ${column.align === 'right' ? 'text-right' : ''}`}>{column.label}</th>)}</tr></thead>
                  <tbody>{report.rows.map((row, index) => <tr key={index} className="border-b border-white/[0.04] transition hover:bg-white/[0.02]">{report.columns.map((column) => <td key={column.key} className={`whitespace-nowrap px-3.5 py-2.5 text-slate-300 ${column.align === 'right' ? 'text-right font-medium' : ''}`}>{row[column.key] ?? '—'}</td>)}</tr>)}</tbody>
                </table>
              </div>
            )}
            {report.note && <div className="border-t border-white/[0.06] bg-white/[0.015] px-4 py-3 text-[10px] leading-relaxed text-slate-500">{report.note}</div>}
          </div>
        </>
      ) : null}
    </div>
  );
}

function TableIcon() {
  return <FileSpreadsheet size={13} />;
}
