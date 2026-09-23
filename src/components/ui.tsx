import { useEffect } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { cn } from '../lib/cn';

// ── Button ───────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  full?: boolean;
}

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:outline-indigo-600 disabled:bg-indigo-300',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus-visible:outline-rose-600 disabled:bg-rose-300',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
};

const buttonSizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
};

export function Button({ variant = 'primary', size = 'md', loading, full, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed',
        buttonVariants[variant],
        buttonSizes[size],
        full && 'w-full',
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('rounded-2xl bg-white shadow-sm ring-1 ring-slate-200', className)}>{children}</div>;
}

export function CardHeader({ title, subtitle, action }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ── Form fields ──────────────────────────────────────────────────────────────

export function Field({ label, required, hint, error, children }: { label: string; required?: boolean; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-rose-600">{error}</span>}
    </label>
  );
}

const inputClasses =
  'block w-full rounded-xl border-0 bg-white px-3.5 py-2.5 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 disabled:bg-slate-50 disabled:text-slate-500 sm:text-sm';

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(inputClasses, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(inputClasses, 'appearance-none bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E")] bg-[position:right_0.75rem_center] bg-no-repeat pr-10', className)} {...rest}>
      {children}
    </select>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <Input className="pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? 'Search…'} type="search" />
    </div>
  );
}

// ── Badges & status indicators (text + colour — doc §84) ────────────────────

export function Badge({ tone = 'slate', children, className }: { tone?: 'slate' | 'green' | 'amber' | 'red' | 'indigo' | 'sky'; children: ReactNode; className?: string }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 ring-slate-200',
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    amber: 'bg-amber-50 text-amber-700 ring-amber-200',
    red: 'bg-rose-50 text-rose-700 ring-rose-200',
    indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    sky: 'bg-sky-50 text-sky-700 ring-sky-200',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', tones[tone], className)}>
      {children}
    </span>
  );
}

export function AttendanceStatusBadge({ status }: { status: 'present' | 'late' | 'absent' }) {
  return <Badge tone={status === 'present' ? 'green' : status === 'late' ? 'amber' : 'red'}>{status === 'present' ? 'Present' : status === 'late' ? 'Late' : 'Absent'}</Badge>;
}

export function SessionStatusBadge({ status }: { status: 'active' | 'closed' | 'cancelled' }) {
  return <Badge tone={status === 'active' ? 'green' : status === 'closed' ? 'slate' : 'red'}>{status === 'active' ? '● Active' : status === 'closed' ? 'Closed' : 'Cancelled'}</Badge>;
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? 'green' : 'slate'}>{active ? 'Active' : 'Inactive'}</Badge>;
}

// ── Stat card (doc §83) ──────────────────────────────────────────────────────

export function StatCard({ label, value, icon, sub, tone = 'indigo' }: { label: string; value: ReactNode; icon?: ReactNode; sub?: ReactNode; tone?: 'indigo' | 'emerald' | 'amber' | 'sky' | 'rose' }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    sky: 'bg-sky-50 text-sky-600',
    rose: 'bg-rose-50 text-rose-600',
  };
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        {icon && <div className={cn('rounded-xl p-2.5', tones[tone])}>{icon}</div>}
      </div>
    </Card>
  );
}

// ── Progress bar ─────────────────────────────────────────────────────────────

export function ProgressBar({ value, className }: { value: number | null; className?: string }) {
  const v = value === null ? 0 : Math.max(0, Math.min(100, value));
  const tone = v >= 75 ? 'bg-emerald-500' : v >= 50 ? 'bg-amber-500' : 'bg-rose-500';
  return (
    <div className={cn('h-2 w-full overflow-hidden rounded-full bg-slate-100 ring-1 ring-inset ring-slate-200', className)}>
      <div className={cn('h-full rounded-full transition-all', tone)} style={{ width: `${v}%` }} />
    </div>
  );
}

// ── Modal ────────────────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cn(
          'relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl',
          wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

// ── Confirmation dialogue (doc §64) ─────────────────────────────────────────

export function ConfirmDialog({ open, title, message, confirmLabel = 'Delete', danger = true, loading, onConfirm, onCancel }: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="text-sm text-slate-600">{message}</div>
      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

// ── Empty / loading / error states (doc §62–63) ──────────────────────────────

export function EmptyState({ icon, title, message, action }: { icon?: ReactNode; title: string; message?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && <div className="mb-3 rounded-2xl bg-slate-100 p-3 text-slate-400">{icon}</div>}
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      {message && <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-indigo-600', className)} />;
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-slate-500">
      <Spinner className="h-7 w-7" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="mb-3 rounded-2xl bg-rose-50 p-3 text-rose-500">
        <X className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-900">Something went wrong</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

// ── Page header ──────────────────────────────────────────────────────────────

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
