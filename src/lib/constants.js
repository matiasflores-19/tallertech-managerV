export const ORDER_STATUSES = [
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
  'SIN_REPARACION',
  'CANCELADO',
];

export const STATUS_META = {
  RECIBIDO: { label: 'Recibido', tone: 'slate', group: 'ingreso' },
  PENDIENTE_DIAGNOSTICO: { label: 'Pendiente de diagnóstico', tone: 'amber', group: 'diagnostico' },
  EN_DIAGNOSTICO: { label: 'En diagnóstico', tone: 'sky', group: 'diagnostico' },
  PRESUPUESTADO: { label: 'Presupuestado', tone: 'indigo', group: 'presupuesto' },
  ESPERANDO_APROBACION: { label: 'Esperando aprobación', tone: 'violet', group: 'presupuesto' },
  ESPERANDO_REPUESTOS: { label: 'Esperando repuestos', tone: 'orange', group: 'reparacion' },
  EN_REPARACION: { label: 'En reparación', tone: 'blue', group: 'reparacion' },
  EN_PRUEBAS: { label: 'En pruebas', tone: 'cyan', group: 'reparacion' },
  REPARADO: { label: 'Reparado', tone: 'emerald', group: 'listo' },
  LISTO_PARA_RETIRAR: { label: 'Listo para retirar', tone: 'green', group: 'listo' },
  ENTREGADO: { label: 'Entregado', tone: 'teal', group: 'final' },
  SIN_REPARACION: { label: 'Sin reparación', tone: 'rose', group: 'final' },
  CANCELADO: { label: 'Cancelado', tone: 'red', group: 'final' },
};

export const STATUS_STYLES = {
  slate: 'border-slate-500/25 bg-slate-500/10 text-slate-300',
  amber: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  sky: 'border-sky-500/25 bg-sky-500/10 text-sky-300',
  indigo: 'border-indigo-500/25 bg-indigo-500/10 text-indigo-300',
  violet: 'border-violet-500/25 bg-violet-500/10 text-violet-300',
  orange: 'border-orange-500/25 bg-orange-500/10 text-orange-300',
  blue: 'border-blue-500/25 bg-blue-500/10 text-blue-300',
  cyan: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-300',
  emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  green: 'border-green-500/25 bg-green-500/10 text-green-300',
  teal: 'border-teal-500/25 bg-teal-500/10 text-teal-300',
  rose: 'border-rose-500/25 bg-rose-500/10 text-rose-300',
  red: 'border-red-500/25 bg-red-500/10 text-red-300',
};

export const STATUS_OPTIONS = ORDER_STATUSES.map((value) => ({ value, ...STATUS_META[value] }));

export const ACTIVE_STATUSES = ORDER_STATUSES.filter(
  (status) => !['ENTREGADO', 'CANCELADO', 'SIN_REPARACION'].includes(status),
);

export const PRIORITY_META = {
  BAJA: { label: 'Baja', style: 'border-slate-500/20 bg-slate-500/10 text-slate-400' },
  NORMAL: { label: 'Normal', style: 'border-sky-500/20 bg-sky-500/10 text-sky-300' },
  ALTA: { label: 'Alta', style: 'border-amber-500/20 bg-amber-500/10 text-amber-300' },
  URGENTE: { label: 'Urgente', style: 'border-rose-500/20 bg-rose-500/10 text-rose-300' },
};

export const PRIORITIES = ['BAJA', 'NORMAL', 'ALTA', 'URGENTE'];

export const PAYMENT_METHODS = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
  { value: 'TARJETA', label: 'Tarjeta' },
  { value: 'MERCADO_PAGO', label: 'Mercado Pago' },
  { value: 'OTRO', label: 'Otro' },
];

export const PAYMENT_METHOD_LABELS = Object.fromEntries(PAYMENT_METHODS.map((item) => [item.value, item.label]));

export const PAYMENT_TYPES = [
  { value: 'SENA', label: 'Seña' },
  { value: 'PAGO_PARCIAL', label: 'Pago parcial' },
  { value: 'PAGO_FINAL', label: 'Pago final' },
  { value: 'OTRO', label: 'Otro' },
];

export const PAYMENT_TYPE_LABELS = Object.fromEntries(PAYMENT_TYPES.map((item) => [item.value, item.label]));

export const INCOME_CATEGORIES = [
  'Cobro de reparación',
  'Seña de reparación',
  'Pago de reparación',
  'Venta de repuestos',
  'Venta de accesorios',
  'Otros ingresos',
];

export const EXPENSE_CATEGORIES = [
  'Compra de repuestos',
  'Herramientas',
  'Servicios',
  'Alquiler',
  'Gastos operativos',
  'Sueldos',
  'Impuestos',
  'Otros gastos',
];

export const REPORT_KINDS = [
  { value: 'reparaciones', label: 'Reparaciones realizadas', icon: 'wrench' },
  { value: 'pendientes', label: 'Reparaciones pendientes', icon: 'clock' },
  { value: 'entregados', label: 'Equipos entregados', icon: 'check' },
  { value: 'finanzas', label: 'Ingresos y egresos', icon: 'coins' },
  { value: 'repuestos', label: 'Repuestos utilizados', icon: 'cpu' },
  { value: 'stock', label: 'Stock disponible', icon: 'boxes' },
  { value: 'ganancias', label: 'Ganancias por período', icon: 'chart' },
];

export const EQUIPMENT_ICONS = {
  'PC de escritorio': 'monitor',
  Notebook: 'laptop',
  Netbook: 'laptop',
  'All in One': 'monitor',
  'Consola PlayStation': 'gamepad',
  'Consola Xbox': 'gamepad',
  Celular: 'smartphone',
  Tablet: 'tablet',
  Monitor: 'monitor',
  Impresora: 'printer',
  'Componente informático': 'cpu',
  'Otro dispositivo electrónico': 'circuit-board',
};
