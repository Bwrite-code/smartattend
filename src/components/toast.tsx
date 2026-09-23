import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, XCircle, Info } from 'lucide-react';
import { cn } from '../lib/cn';

// ── Lightweight toast notifications ──────────────────────────────────────────

type ToastKind = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++;
    setToasts((t) => [...t, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4200);
  }, []);

  const value = {
    success: (m: string) => push('success', m),
    error: (m: string) => push('error', m),
    info: (m: string) => push('info', m),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={cn(
              'pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-xl px-4 py-3 text-sm shadow-lg ring-1',
              t.kind === 'success' && 'bg-emerald-600 text-white ring-emerald-700/40',
              t.kind === 'error' && 'bg-rose-600 text-white ring-rose-700/40',
              t.kind === 'info' && 'bg-slate-800 text-white ring-slate-700/40'
            )}
          >
            {t.kind === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            {t.kind === 'error' && <XCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            {t.kind === 'info' && <Info className="mt-0.5 h-4 w-4 shrink-0" />}
            <span className="min-w-0 break-words">{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
