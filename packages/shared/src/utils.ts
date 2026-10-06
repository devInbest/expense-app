/** Compares semver-like "1.2.3" strings. Returns -1, 0 or 1. */
export const compareVersions = (a: string, b: string): number => {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
};

export const maskPhone = (phone?: string | null): string | undefined =>
  phone ? `••••${phone.slice(-4)}` : undefined;

export const buildInviteLink = (base: string, code: string) => `${base.replace(/\/$/, '')}/join/${code}`;

export const APP_SCHEME = 'expenseapp';
