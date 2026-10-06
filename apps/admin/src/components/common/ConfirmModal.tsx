import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconAlertTriangle, IconCircleCheck, IconTrash } from '@tabler/icons-react';

type Variant = 'danger' | 'warning' | 'primary';

interface Props {
  open: boolean;
  title?: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: Variant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra content between the message and the buttons (e.g. a reason field). */
  children?: ReactNode;
}

const THEMES: Record<Variant, { iconBg: string; accentBar: string; btn: string; btnFocus: string; icon: ReactNode }> = {
  danger: {
    iconBg: 'confirm-modal-icon confirm-modal-icon--danger',
    accentBar: 'bg-gradient-to-r from-red-500 to-rose-500',
    btn: 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-red-200 hover:shadow-red-300',
    btnFocus: 'focus-visible:ring-red-500',
    icon: <IconTrash className="w-7 h-7" stroke={1.8} />,
  },
  warning: {
    iconBg: 'confirm-modal-icon confirm-modal-icon--warning',
    accentBar: 'bg-gradient-to-r from-amber-400 to-orange-500',
    btn: 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-200 hover:shadow-amber-300',
    btnFocus: 'focus-visible:ring-amber-500',
    icon: <IconAlertTriangle className="w-7 h-7" stroke={1.8} />,
  },
  primary: {
    iconBg: 'confirm-modal-icon confirm-modal-icon--primary',
    accentBar: 'confirm-modal-accent-bar--primary',
    btn: 'bg-gradient-to-r from-primary-600 to-primary-700 hover:from-primary-700 hover:to-primary-800 shadow-primary-200 hover:shadow-primary-300',
    btnFocus: 'focus-visible:ring-primary-500',
    icon: <IconCircleCheck className="w-7 h-7" stroke={1.8} />,
  },
};

export default function ConfirmModal({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
  children,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef(onCancel);
  const hasChildren = Boolean(children);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    cancelRef.current = onCancel;
  });

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const frame = requestAnimationFrame(() => setVisible(true));
    if (!hasChildren) confirmRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, hasChildren]);

  if (!open) return null;
  const t = THEMES[variant];

  // Portaled into #root (Tailwind utilities are scoped there) so parent spacing utilities don't offset it.
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4" onClick={onCancel}>
      <div
        className={`absolute inset-0 bg-gray-900/60 backdrop-blur-[6px] transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={`confirm-modal-card relative rounded-3xl w-full max-w-[400px] overflow-hidden transition-all duration-300 ease-out ${
          visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1 w-full">
          <div className={`h-full w-full ${t.accentBar}`} />
        </div>
        <div className="px-7 pt-7 pb-2 text-center">
          <div className={`w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center ring-8 ${t.iconBg}`}>{t.icon}</div>
          <h3 className="confirm-modal-title text-[1.1rem] font-bold leading-tight mb-2">{title}</h3>
          {message && <p className="confirm-modal-message text-[0.85rem] leading-relaxed max-w-[300px] mx-auto">{message}</p>}
        </div>
        {children && <div className="px-7 pt-3 text-left">{children}</div>}
        <div className="px-7 pb-7 pt-4 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="confirm-modal-cancel flex-1 px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-150 active:scale-[0.97] disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 px-4 py-2.5 text-sm font-semibold text-white rounded-xl shadow-lg transition-all duration-150 active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 ${t.btn} ${t.btnFocus}`}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.getElementById('root')!,
  );
}
