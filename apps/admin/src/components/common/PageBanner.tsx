import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface BannerAction {
  label: string;
  icon?: ReactNode;
  to?: string;
  onClick?: () => void;
  disabled?: boolean;
}

const actionClassName =
  'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold active:scale-95 transition-all duration-150 shadow-lg flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 bg-white text-primary-900 hover:bg-primary-50 shadow-primary-900/30';

interface Props {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: BannerAction[];
  /** Rendered under the title row, e.g. status badges. */
  children?: ReactNode;
  className?: string;
}

export default function PageBanner({ title, subtitle, actions = [], children, className = '' }: Props) {
  return (
    <div
      className={`page-banner bg-gradient-to-br from-brand-deep via-brand-mid to-brand-light rounded-2xl px-4 py-3 text-white relative overflow-hidden ${className}`.trim()}
    >
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
      <div className="absolute -bottom-8 -right-4 w-24 h-24 bg-white/5 rounded-full" />
      <div className="relative flex flex-wrap gap-4 sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold mb-0.5 truncate">{title}</h2>
          {subtitle && <p className="text-brand-on text-md">{subtitle}</p>}
          {children}
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 justify-end flex-shrink-0">
            {actions.map((act) =>
              act.to ? (
                <Link key={act.label} to={act.to} className={actionClassName}>
                  {act.icon}
                  {act.label}
                </Link>
              ) : (
                <button key={act.label} type="button" onClick={act.onClick} disabled={act.disabled} className={actionClassName}>
                  {act.icon}
                  {act.label}
                </button>
              ),
            )}
          </div>
        )}
      </div>
    </div>
  );
}
