import { useEffect, useRef, useState } from 'react';
import { Download, MonitorSmartphone, Share, Smartphone, X } from 'lucide-react';
import Modal from './Modal.jsx';
import { useUI } from '../context/UIProvider.jsx';

const DISMISS_KEY = 'tt_install_dismissed_until';

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith('android-app://')
  );
}

function isIOS() {
  const ua = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) || (window.navigator.platform === 'MacIntel' && window.navigator.maxTouchPoints > 1);
}

function isMobileViewport() {
  return window.matchMedia?.('(max-width: 1023px)').matches;
}

function wasDismissed() {
  try {
    return Number(localStorage.getItem(DISMISS_KEY) || 0) > Date.now();
  } catch {
    return false;
  }
}

export default function PwaInstall() {
  const { toast } = useUI();
  const [promptEvent, setPromptEvent] = useState(null);
  const [visible, setVisible] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [installed, setInstalled] = useState(() => isStandalone());
  const ios = isIOS();
  const promptRef = useRef(null);

  useEffect(() => {
    const onBeforeInstall = (event) => {
      event.preventDefault();
      promptRef.current = event;
      setPromptEvent(event);
    };
    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setHelpOpen(false);
      toast.success('TallerTech se instaló correctamente en el dispositivo.');
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [toast]);

  useEffect(() => {
    if (installed || wasDismissed() || !isMobileViewport()) return undefined;
    const timer = window.setTimeout(() => setVisible(true), 5000);
    return () => window.clearTimeout(timer);
  }, [installed]);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now() + 1000 * 60 * 60 * 24 * 14));
    } catch {
      // Sin almacenamiento local, se oculta solo por esta sesión.
    }
  };

  const install = async () => {
    const event = promptRef.current || promptEvent;
    if (!event) {
      setHelpOpen(true);
      return;
    }
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === 'accepted') {
        setVisible(false);
        setInstalled(true);
      } else {
        dismiss();
      }
      promptRef.current = null;
      setPromptEvent(null);
    } catch {
      setHelpOpen(true);
    }
  };

  if (installed) return null;

  return (
    <>
      {visible && !helpOpen && (
        <div className="fixed inset-x-3 bottom-[calc(4.7rem+env(safe-area-inset-bottom))] z-40 animate-slide-up rounded-2xl border border-tech-500/25 bg-ink-850/95 p-3.5 shadow-2xl backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-tech-500 to-tech-700 text-white shadow-glow">
              <MonitorSmartphone size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white">Instalá TallerTech en el celular</p>
              <p className="mt-0.5 text-[10px] leading-snug text-slate-500">Acceso directo, pantalla completa y cámara para recepción rápida.</p>
            </div>
            <button type="button" onClick={install} className="btn-primary btn-sm shrink-0 !min-h-[34px] px-3">
              <Download size={13} /> Instalar
            </button>
            <button type="button" onClick={dismiss} className="icon-btn h-8 w-8 shrink-0" aria-label="Ocultar sugerencia">
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      <Modal
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        title="Instalar TallerTech"
        subtitle="En Android, iPhone o tablet se agrega a la pantalla de inicio como una app."
        size="sm"
      >
        <div className="space-y-3">
          {ios ? (
            <>
              <div className="flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tech-500/10 text-tech-400"><Share size={17} /></div>
                <div><p className="text-xs font-semibold text-slate-200">1. Abrí Safari y tocá Compartir</p><p className="mt-1 text-[11px] leading-relaxed text-slate-500">Es el botón cuadrado con la flecha hacia arriba, en la barra inferior.</p></div>
              </div>
              <div className="flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tech-500/10 text-tech-400"><Smartphone size={17} /></div>
                <div><p className="text-xs font-semibold text-slate-200">2. Elegí “Agregar a pantalla de inicio”</p><p className="mt-1 text-[11px] leading-relaxed text-slate-500">Confirmá el nombre TallerTech y tocá Agregar. Quedará como una app.</p></div>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tech-500/10 text-tech-400"><Download size={17} /></div>
                <div><p className="text-xs font-semibold text-slate-200">1. Abrí el menú del navegador</p><p className="mt-1 text-[11px] leading-relaxed text-slate-500">Chrome: los tres puntos. Edge: el menú “···”.</p></div>
              </div>
              <div className="flex gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tech-500/10 text-tech-400"><MonitorSmartphone size={17} /></div>
                <div><p className="text-xs font-semibold text-slate-200">2. Elegí “Instalar aplicación”</p><p className="mt-1 text-[11px] leading-relaxed text-slate-500">O “Agregar a pantalla de inicio”. La app se abrirá sin barra del navegador.</p></div>
              </div>
            </>
          )}
          <p className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] p-3 text-[10px] leading-relaxed text-emerald-200/70">
            La cámara del celular se habilita automáticamente al sacar fotos del equipo desde la app. Usá HTTPS (el dominio de producción) para que el navegador permita instalarla.
          </p>
        </div>
      </Modal>
    </>
  );
}
