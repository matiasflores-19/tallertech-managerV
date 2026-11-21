import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

const UIContext = createContext(null);

let toastSequence = 0;

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const TONES = {
  success: 'border-emerald-500/25 bg-emerald-950/95 text-emerald-100',
  error: 'border-rose-500/25 bg-rose-950/95 text-rose-100',
  info: 'border-sky-500/25 bg-sky-950/95 text-sky-100',
  warning: 'border-amber-500/25 bg-amber-950/95 text-amber-100',
};

const ICON_TONES = {
  success: 'text-emerald-400',
  error: 'text-rose-400',
  info: 'text-sky-400',
  warning: 'text-amber-400',
};

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const confirmResolver = useRef(null);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (message, type = 'success', title = null) => {
      const id = ++toastSequence;
      setToasts((current) => [...current.slice(-3), { id, message, type, title }]);
      window.setTimeout(() => dismiss(id), 5200);
      return id;
    },
    [dismiss],
  );

  const toast = useMemo(
    () => ({
      success: (message, title) => push(message, 'success', title),
      error: (message, title) => push(message, 'error', title || 'No se pudo completar'),
      info: (message, title) => push(message, 'info', title),
      warning: (message, title) => push(message, 'warning', title),
    }),
    [push],
  );

  const confirm = useCallback((options) => {
    const normalized =
      typeof options === 'string'
        ? { title: 'Confirmar acción', message: options }
        : {
            title: 'Confirmar acción',
            message: '',
            confirmLabel: 'Confirmar',
            cancelLabel: 'Cancelar',
            tone: 'danger',
            ...options,
          };
    setConfirmState(normalized);
    return new Promise((resolve) => {
      confirmResolver.current = resolve;
    });
  }, []);

  const resolveConfirm = (value) => {
    setConfirmState(null);
    confirmResolver.current?.(value);
    confirmResolver.current = null;
  };

  return (
    <UIContext.Provider value={{ toast, confirm }}>
      {children}

      <div className="pointer-events-none fixed inset-x-3 top-3 z-[80] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:top-5 sm:w-[380px]">
        {toasts.map((item) => {
          const Icon = ICONS[item.type] || Info;
          return (
            <div
              key={item.id}
              className={`pointer-events-auto flex w-full animate-slide-up items-start gap-3 rounded-xl border p-3.5 shadow-2xl backdrop-blur ${TONES[item.type]}`}
              role="status"
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${ICON_TONES[item.type]}`} />
              <div className="min-w-0 flex-1">
                {item.title && <p className="text-xs font-bold">{item.title}</p>}
                <p className="text-sm leading-snug opacity-90">{item.message}</p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded-md p-0.5 opacity-60 transition hover:opacity-100"
                aria-label="Cerrar notificación"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>

      {confirmState && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="w-full animate-slide-up rounded-t-3xl border border-white/10 bg-ink-850 p-5 shadow-2xl sm:max-w-md sm:rounded-2xl sm:p-6">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  confirmState.tone === 'danger' ? 'bg-rose-500/10 text-rose-400' : 'bg-amber-500/10 text-amber-400'
                }`}
              >
                <AlertTriangle size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-white">{confirmState.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">{confirmState.message}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" className="btn-secondary" onClick={() => resolveConfirm(false)}>
                {confirmState.cancelLabel}
              </button>
              <button
                type="button"
                className={confirmState.tone === 'danger' ? 'btn-danger' : 'btn-primary'}
                onClick={() => resolveConfirm(true)}
              >
                {confirmState.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) throw new Error('useUI debe utilizarse dentro de UIProvider');
  return context;
}
