export interface Range {
  from: Date;
  to: Date;
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const monthRange = (d = new Date(), offset = 0): Range => ({
  from: new Date(d.getFullYear(), d.getMonth() + offset, 1),
  to: new Date(d.getFullYear(), d.getMonth() + offset + 1, 1),
});

export const weekRange = (d = new Date()): Range => {
  const day = (d.getDay() + 6) % 7; // Monday = 0
  const from = startOfDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() - day));
  return { from, to: new Date(from.getFullYear(), from.getMonth(), from.getDate() + 7) };
};

export const yearRange = (d = new Date()): Range => ({
  from: new Date(d.getFullYear(), 0, 1),
  to: new Date(d.getFullYear() + 1, 0, 1),
});

export const iso = (r: Range) => ({ from: r.from.toISOString(), to: r.to.toISOString() });

export const formatMonth = (d: Date) => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

export const formatDate = (value: string | Date) =>
  new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDay = (value: string | Date) => {
  const d = startOfDay(new Date(value));
  const today = startOfDay(new Date());
  const diff = Math.round((today.getTime() - d.getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
};

export const formatTime = (value: string | Date) =>
  new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export const timeAgo = (value: string | Date) => {
  const s = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)}d ago`;
  return formatDate(value);
};
