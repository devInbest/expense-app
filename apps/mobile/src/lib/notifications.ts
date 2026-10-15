import type { Href } from 'expo-router';
import type { NotificationDTO } from '@expense/shared';

type Tone = 'primary' | 'success' | 'warning' | 'danger';

const KINDS: Record<string, { icon: string; tone: Tone; label: string }> = {
  room_invite: { icon: 'email-outline', tone: 'primary', label: 'Room invite' },
  room_joined: { icon: 'account-plus-outline', tone: 'success', label: 'New member' },
  room_expense_added: { icon: 'receipt', tone: 'primary', label: 'Expense added' },
  room_expense_updated: { icon: 'pencil-outline', tone: 'primary', label: 'Expense edited' },
  room_expense_deleted: { icon: 'delete-outline', tone: 'danger', label: 'Expense deleted' },
  settlement_recorded: { icon: 'handshake-outline', tone: 'success', label: 'Payment' },
  settlement_confirmed: { icon: 'check-decagram-outline', tone: 'success', label: 'Payment confirmed' },
  budget_threshold: { icon: 'alert-outline', tone: 'warning', label: 'Budget' },
  recurring_created: { icon: 'calendar-sync', tone: 'primary', label: 'Recurring' },
  member_removed: { icon: 'account-remove-outline', tone: 'danger', label: 'Removed from room' },
  room_deleted: { icon: 'delete-outline', tone: 'danger', label: 'Room deleted' },
  broadcast: { icon: 'bullhorn-outline', tone: 'primary', label: 'Announcement' },
};

const FALLBACK = { icon: 'bell-outline', tone: 'primary' as Tone, label: 'Notification' };

/** Icon, theme color and short label for a notification type. */
export const notificationKind = (type: string, colors: Record<'primary' | 'success' | 'warning' | 'danger', string>) => {
  const kind = KINDS[type] ?? FALLBACK;
  const color = { primary: colors.primary, success: colors.success, warning: colors.warning, danger: colors.danger }[kind.tone];
  return { icon: kind.icon, label: kind.label, color };
};

/** The screen a notification relates to, or null when there is nothing left to open (e.g. a deleted room). */
export const notificationTarget = (n: Pick<NotificationDTO, 'type' | 'data'>): { href: Href; label: string; icon: string } | null => {
  const data = n.data ?? {};
  if (n.type === 'room_deleted' || n.type === 'member_removed') return null;
  if (data.inviteId) return { href: '/invites', label: 'View invite', icon: 'email-open-outline' };
  if (data.budgetId && typeof data.roomId !== 'string') return { href: '/budgets', label: 'View budgets', icon: 'chart-donut' };
  if (typeof data.roomId === 'string') return { href: { pathname: '/room/[id]', params: { id: data.roomId } }, label: 'Open room', icon: 'door-open' };
  if (data.recurringId) return { href: '/recurring', label: 'View recurring', icon: 'calendar-sync' };
  return null;
};
