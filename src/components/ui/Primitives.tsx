import React, { createContext, useCallback, useContext, useEffect, useId, useRef, useState } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CheckCircle2, ChevronDown, AlertCircle, Loader2, Search, X } from 'lucide-react';
import { REPORT_STATUS_LABELS, type ReportStatus } from '../../lib/domain';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ============================================================
// YASHNAR LOGO
// ============================================================

export const YashnarLogo: React.FC<{ size?: number; inverted?: boolean }> = ({
  size = 36,
  inverted = false,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    aria-hidden="true"
    className="shrink-0"
  >
    <rect
      width="64"
      height="64"
      rx="14"
      fill={inverted ? 'rgba(255,255,255,0.16)' : '#064E3B'}
    />
    <path
      d="M46 17C33.75 17 22 24.5 19.25 36.75C18.25 41.25 19.5 45.5 22 48C24.75 46.25 29 43.25 33.75 37.75C29.5 38.5 25.75 40 23 42.25C26 32 34.25 25.25 43.75 23C39 27.75 33.75 34.75 28.5 45C30.5 46.25 33 46.75 35.75 46.25C43.75 44.5 49 34.5 47.75 20.25C47.62 18.37 47 17 46 17Z"
      fill={inverted ? '#FFFFFF' : '#34D399'}
    />
    <path
      d="M21 48.25C24.75 39.75 31.75 31.5 41.5 24.75"
      stroke={inverted ? '#064E3B' : '#FFFFFF'}
      strokeWidth="2.5"
      strokeLinecap="round"
    />
  </svg>
);

// ============================================================
// BUTTONS (48px primary/secondary, 36px small with 44px mobile hit)
// ============================================================

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'hero-white' | 'hero-outline';
  size?: 'default' | 'sm';
  loading?: boolean;
  loadingLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'default',
  loading = false,
  loadingLabel,
  disabled,
  className,
  children,
  ...props
}) => {
  const base =
    'inline-flex items-center justify-center gap-2 font-semibold transition-colors duration-150 rounded-[10px] whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-55 disabled:cursor-not-allowed';
  const sizes =
    size === 'sm'
      ? 'min-h-[44px] md:min-h-[36px] md:h-[36px] px-[12px] text-[12px] leading-[18px]'
      : 'h-[48px] px-[20px] text-[14px] leading-[20px]';

  const variants: Record<NonNullable<ButtonProps['variant']>, string> = {
    primary: 'bg-[#047857] hover:bg-[#065F46] text-white',
    secondary:
      'bg-white dark:bg-[#13231D] text-[#0F172A] dark:text-[#F1F5F9] border border-[#E2E8F0] dark:border-[#294237] hover:bg-[#F8FAFC] dark:hover:bg-[#1A2F27]',
    danger: 'bg-[#B91C1C] hover:bg-[#991B1B] text-white',
    ghost:
      'bg-transparent text-[#64748B] dark:text-[#A7B8AE] hover:bg-[#F1F5F9] dark:hover:bg-[#1A2F27] hover:text-[#0F172A] dark:hover:text-[#F1F5F9]',
    'hero-white': 'bg-white text-[#065F46] hover:bg-[#ECFDF5]',
    'hero-outline': 'bg-transparent text-white border border-white hover:bg-white/10',
  };

  return (
    <button
      disabled={disabled || loading}
      className={cn(base, sizes, variants[variant], className)}
      {...props}
    >
      {loading && <Loader2 className="w-[18px] h-[18px] animate-spin shrink-0" aria-hidden="true" />}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
};

// ============================================================
// FORM FIELDS (48px input, 120px textarea, inline #B91C1C error)
// ============================================================

export interface FieldProps {
  label: string;
  error?: string;
  helper?: string;
  htmlFor?: string;
  required?: boolean;
  children: React.ReactNode;
}

export const FormField: React.FC<FieldProps> = ({
  label,
  error,
  helper,
  htmlFor,
  required,
  children,
}) => (
  <div className="flex flex-col">
    <label
      htmlFor={htmlFor}
      className="text-[13px] leading-[20px] font-medium text-[#0F172A] dark:text-[#F1F5F9] mb-[8px]"
    >
      {label}
      {required && <span className="text-[#B91C1C] ml-1" aria-hidden="true">*</span>}
    </label>
    {children}
    {error ? (
      <p role="alert" className="mt-[4px] text-[12px] leading-[18px] text-[#B91C1C] dark:text-[#FCA5A5]">
        {error}
      </p>
    ) : helper ? (
      <p className="mt-[4px] text-[12px] leading-[18px] text-[#64748B] dark:text-[#A7B8AE]">
        {helper}
      </p>
    ) : null}
  </div>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full min-h-[48px] px-[14px] py-[12px] rounded-[10px] text-[14px] leading-[20px]',
        'bg-white dark:bg-[#0F1D17] text-[#0F172A] dark:text-[#F1F5F9]',
        'border border-[#E2E8F0] dark:border-[#294237]',
        'placeholder:text-[#64748B] dark:placeholder:text-[#A7B8AE]',
        'disabled:opacity-60 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'w-full min-h-[48px] px-[14px] py-[12px] rounded-[10px] text-[14px] leading-[20px]',
        'bg-white dark:bg-[#0F1D17] text-[#0F172A] dark:text-[#F1F5F9]',
        'border border-[#E2E8F0] dark:border-[#294237]',
        className
      )}
      {...props}
    />
  )
);
Select.displayName = 'Select';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  currentLength?: number;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, maxLength, currentLength, value, ...props }, ref) => {
    const len = currentLength ?? (typeof value === 'string' ? value.length : 0);
    return (
      <div className="relative">
        <textarea
          ref={ref}
          value={value}
          maxLength={maxLength}
          className={cn(
            'w-full min-h-[120px] p-[14px] rounded-[10px] text-[14px] leading-[22px] resize-y',
            'bg-white dark:bg-[#0F1D17] text-[#0F172A] dark:text-[#F1F5F9]',
            'border border-[#E2E8F0] dark:border-[#294237]',
            'placeholder:text-[#64748B] dark:placeholder:text-[#A7B8AE]',
            className
          )}
          {...props}
        />
        {maxLength !== undefined && (
          <div className="mt-[4px] text-right text-[12px] leading-[18px] text-[#64748B] dark:text-[#A7B8AE] tabular-nums">
            {len} / {maxLength}
          </div>
        )}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';

// ============================================================
// SEARCHABLE SELECT (48px height, 280px max dropdown, 40px min option)
// ============================================================

export interface SearchableOption {
  value: number | string;
  label: string;
  badge?: string;
}

export const SearchableSelect: React.FC<{
  id?: string;
  options: SearchableOption[];
  value: number | string | null;
  onChange: (value: number | string) => void;
  placeholder: string;
  emptyText?: string;
  disabled?: boolean;
  searchPlaceholder?: string;
}> = ({
  id,
  options,
  value,
  onChange,
  placeholder,
  emptyText = 'Ma’lumot topilmadi.',
  disabled = false,
  searchPlaceholder = 'Qidirish...',
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const selected = options.find((o) => String(o.value) === String(value));
  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={() => setOpen((p) => !p)}
        className={cn(
          'w-full h-[48px] px-[14px] rounded-[10px] text-[14px] flex items-center justify-between gap-2 text-left',
          'bg-white dark:bg-[#0F1D17] border border-[#E2E8F0] dark:border-[#294237]',
          selected ? 'text-[#0F172A] dark:text-[#F1F5F9]' : 'text-[#64748B] dark:text-[#A7B8AE]',
          'disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer'
        )}
      >
        <span className="truncate flex items-center gap-2">
          <span>{selected ? selected.label : placeholder}</span>
          {selected?.badge && (
            <span className="inline-flex items-center px-[8px] py-[2px] rounded-[6px] text-[11px] font-semibold bg-[#FEF3C7] text-[#92400E]">
              {selected.badge}
            </span>
          )}
        </span>
        <ChevronDown className="w-4 h-4 shrink-0 text-[#64748B]" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 mt-[8px] z-40 rounded-[12px] bg-white dark:bg-[#13231D] border border-[#E2E8F0] dark:border-[#294237] overflow-hidden"
          style={{ boxShadow: 'var(--shadow-dialog)' }}
        >
          <div className="p-[8px] border-b border-[#E2E8F0] dark:border-[#294237] flex items-center gap-2">
            <Search className="w-4 h-4 text-[#64748B] shrink-0" aria-hidden="true" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              autoFocus
              className="w-full text-[14px] bg-transparent text-[#0F172A] dark:text-[#F1F5F9] focus:outline-none"
            />
          </div>
          <div className="max-h-[280px] overflow-y-auto p-[4px]">
            {filtered.length === 0 ? (
              <div className="px-[12px] py-[16px] text-[13px] text-[#64748B] dark:text-[#A7B8AE] text-center">
                {emptyText}
              </div>
            ) : (
              filtered.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={String(opt.value)}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={cn(
                      'w-full min-h-[40px] px-[12px] py-[8px] rounded-[8px] text-[14px] flex items-center justify-between gap-2 text-left cursor-pointer',
                      isSelected
                        ? 'bg-[#D1FAE5] dark:bg-[#065F46]/40 text-[#065F46] dark:text-[#34D399] font-semibold'
                        : 'text-[#0F172A] dark:text-[#F1F5F9] hover:bg-[#F8FAFC] dark:hover:bg-[#1A2F27]'
                    )}
                  >
                    <span className="truncate">{opt.label}</span>
                    {opt.badge && (
                      <span className="inline-flex items-center px-[8px] py-[2px] rounded-[6px] text-[11px] font-semibold bg-[#FEF3C7] text-[#92400E] shrink-0">
                        {opt.badge}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================
// CARD, STATUS BADGE, ERROR BANNER, EMPTY STATE
// ============================================================

export const Card: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => (
  <div className={cn('card-surface p-[20px] md:p-[24px]', className)}>{children}</div>
);

const REPORT_BADGE_COLORS: Record<ReportStatus, string> = {
  submitted: 'bg-[#F1F5F9] text-[#475569] dark:bg-slate-800 dark:text-slate-200',
  reviewing: 'bg-[#FEF3C7] text-[#92400E] dark:bg-amber-950/60 dark:text-amber-300',
  assigned: 'bg-[#DBEAFE] text-[#1E40AF] dark:bg-blue-950/60 dark:text-blue-300',
  en_route: 'bg-[#DBEAFE] text-[#1E40AF] dark:bg-blue-950/60 dark:text-blue-300',
  arrived: 'bg-[#EDE9FE] text-[#5B21B6] dark:bg-violet-950/60 dark:text-violet-300',
  completed: 'bg-[#D1FAE5] text-[#065F46] dark:bg-emerald-950/60 dark:text-emerald-300',
  cancelled: 'bg-[#FEE2E2] text-[#991B1B] dark:bg-red-950/60 dark:text-red-300',
};

export const StatusBadge: React.FC<{
  status?: ReportStatus;
  label?: string;
  tone?: 'mint' | 'warning' | 'danger' | 'info' | 'neutral';
}> = ({ status, label, tone }) => {
  let colorClass = 'bg-[#F1F5F9] text-[#475569]';
  let text = label ?? '';

  if (status) {
    colorClass = REPORT_BADGE_COLORS[status] ?? colorClass;
    text = label ?? REPORT_STATUS_LABELS[status] ?? status;
  } else if (tone === 'mint') {
    colorClass = 'bg-[#D1FAE5] text-[#065F46] dark:bg-emerald-950/60 dark:text-emerald-300';
  } else if (tone === 'warning') {
    colorClass = 'bg-[#FEF3C7] text-[#92400E] dark:bg-amber-950/60 dark:text-amber-300';
  } else if (tone === 'danger') {
    colorClass = 'bg-[#FEE2E2] text-[#991B1B] dark:bg-red-950/60 dark:text-red-300';
  } else if (tone === 'info') {
    colorClass = 'bg-[#DBEAFE] text-[#1E40AF] dark:bg-blue-950/60 dark:text-blue-300';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center min-h-[24px] px-[8px] py-[4px] rounded-[6px] text-[11px] leading-[16px] font-semibold whitespace-nowrap shrink-0',
        colorClass
      )}
    >
      {text}
    </span>
  );
};

export const ErrorAlert: React.FC<{ message: string; className?: string }> = ({
  message,
  className,
}) => (
  <div
    role="alert"
    className={cn(
      'flex items-start gap-[12px] p-[16px] rounded-[10px] bg-[#FEE2E2] text-[#991B1B] dark:bg-red-950/60 dark:text-red-200 text-[14px] leading-[22px]',
      className
    )}
  >
    <AlertCircle className="w-[18px] h-[18px] shrink-0 mt-[2px]" aria-hidden="true" />
    <span>{message}</span>
  </div>
);

export const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center text-center py-[40px] px-[16px]">
    <div className="text-[#64748B] dark:text-[#A7B8AE] mb-[16px] [&>svg]:w-[40px] [&>svg]:h-[40px]">
      {icon}
    </div>
    <h3 className="text-[16px] leading-[24px] font-semibold text-[#0F172A] dark:text-[#F1F5F9]">
      {title}
    </h3>
    <p className="mt-[8px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE] max-w-[360px]">
      {description}
    </p>
    {action && <div className="mt-[20px]">{action}</div>}
  </div>
);

// ============================================================
// FOCUS-TRAPPED DIALOG (min(480px, 100vw - 48px), 24px pad, 20px radius, 85dvh)
// ============================================================

export const Dialog: React.FC<{
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
}> = ({ open, onClose, title, description, children }) => {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const el = dialogRef.current;

    const getFocusables = () =>
      el?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

    // Prefer focusing the first interactive input/textarea/select inside the dialog so users can type right away
    const firstInput = el?.querySelector<HTMLElement>(
      'input:not([disabled]), textarea:not([disabled]), select:not([disabled])'
    );
    if (firstInput) {
      firstInput.focus();
    } else {
      getFocusables()?.[0]?.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab') {
        const focusables = getFocusables();
        if (focusables && focusables.length > 0) {
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-[24px]"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)' }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="dialog-surface w-full max-w-[min(480px,calc(100vw-48px))] max-h-[85dvh] overflow-y-auto p-[24px] transition-all duration-[220ms]"
      >
        <div className="flex items-start justify-between gap-[12px] mb-[16px]">
          <div>
            <h2
              id={titleId}
              className="text-[20px] leading-[28px] font-semibold text-[#0F172A] dark:text-[#F1F5F9]"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-[4px] text-[14px] leading-[22px] text-[#64748B] dark:text-[#A7B8AE]">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="w-[44px] h-[44px] -mt-[8px] -mr-[8px] rounded-[10px] flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] dark:hover:bg-[#1A2F27] cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// ============================================================
// TOAST SYSTEM (Success 5s, Actionable Errors stay until dismissed)
// ============================================================

interface ToastItem {
  id: string;
  type: 'success' | 'error';
  message: string;
}

const ToastContext = createContext<{
  toastSuccess: (message: string) => void;
  toastError: (message: string) => void;
} | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toastSuccess = useCallback(
    (message: string) => {
      const id = `${Date.now()}-${Math.random()}`;
      setToasts((prev) => [...prev, { id, type: 'success', message }]);
      window.setTimeout(() => dismiss(id), 5000);
    },
    [dismiss]
  );

  const toastError = useCallback((message: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type: 'error', message }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toastSuccess, toastError }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-[88px] md:bottom-[24px] right-[16px] md:right-[24px] z-[60] flex flex-col gap-[12px] w-[calc(100vw-32px)] md:w-[360px] pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.type === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto flex items-start justify-between gap-[12px] p-[16px] rounded-[12px] border text-[14px] leading-[22px]',
              t.type === 'success'
                ? 'bg-[#D1FAE5] text-[#065F46] border-[#A7F3D0] dark:bg-[#064E3B] dark:text-[#ECFDF5] dark:border-[#047857]'
                : 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA] dark:bg-[#7F1D1D] dark:text-[#FEE2E2] dark:border-[#991B1B]'
            )}
            style={{ boxShadow: 'var(--shadow-dialog)' }}
          >
            <div className="flex items-start gap-[10px]">
              {t.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0 mt-[2px]" aria-hidden="true" />
              ) : (
                <AlertCircle className="w-5 h-5 shrink-0 mt-[2px]" aria-hidden="true" />
              )}
              <span>{t.message}</span>
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Bildirishnomani yopish"
              className="p-1 rounded-[6px] hover:bg-black/10 cursor-pointer shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
