import type { ReactNode } from 'react';
import { Badge, type MantineColor } from '@mantine/core';
import type { Icon } from '@tabler/icons-react';
import { label } from '../../lib/format';

export function StatCard({
  label: title,
  value,
  hint,
  Icon,
  tone = 'bg-blue-100 text-blue-700',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  Icon: Icon;
  tone?: string;
}) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <div className={`stat-icon-box ${tone}`}>
        <Icon stroke={1.8} />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide leading-tight">{title}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {hint && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    </div>
  );
}

const STATUS_COLORS: Record<string, MantineColor> = {
  active: 'green',
  blocked: 'red',
  deleted: 'gray',
  left: 'gray',
  removed: 'orange',
  archived: 'gray',
  superadmin: 'violet',
  support: 'blue',
  owner: 'violet',
  admin: 'blue',
  member: 'gray',
  user: 'blue',
  system: 'gray',
  split: 'teal',
  shared_budget: 'indigo',
  expense: 'red',
  income: 'green',
};

export function StatusBadge({ value, color }: { value?: string | null; color?: MantineColor }) {
  if (!value) return null;
  return (
    <Badge variant="light" color={color ?? STATUS_COLORS[value] ?? 'gray'} radius="sm" miw="max-content">
      {label(value)}
    </Badge>
  );
}

export function Section({ title, actions, children, className = '' }: { title: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="detail-card-title text-base font-semibold">{title}</h3>
        {actions}
      </div>
      {children}
    </div>
  );
}

export function DetailRow({ label: name, children }: { label: string; children: ReactNode }) {
  return (
    <div className="detail-row flex items-baseline justify-between gap-4 py-2 text-sm last:border-0">
      <span className="detail-row-label flex-shrink-0">{name}</span>
      <span className="detail-row-value text-right min-w-0 break-words">{children ?? '—'}</span>
    </div>
  );
}
