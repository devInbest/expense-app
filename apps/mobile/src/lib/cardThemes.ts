import type { PaymentAccount } from '@expense/shared';

/**
 * Colour themes for the card drawn on an account's page, matched from the name the user typed
 * ("SBI Savings", "Axis Neo", ...). Colours only: no logos or artwork.
 *
 * Bank colours follow each bank's brand palette. Card-variant colours are close approximations
 * of how those cards look; tweak any hex here and every card using it updates.
 */
export interface CardTheme {
  /** Gradient start (top-left) and end (bottom-right). */
  from: string;
  to: string;
  /** Tint for the soft light sweep in the bottom-left corner. */
  accent: string;
}

type Rule = { match: RegExp; theme: CardTheme };

const t = (from: string, to: string, accent = 'rgba(255,255,255,0.10)'): CardTheme => ({ from, to, accent });

/** Specific cards, checked before banks so "Axis Neo" beats plain "Axis". */
const CARD_VARIANTS: Rule[] = [
  // Axis
  { match: /\baxis\b.*\bneo\b|\bneo\b.*\baxis\b/, theme: t('#E0457B', '#7A1846', 'rgba(255,170,200,0.22)') },
  { match: /\bmagnus\b/, theme: t('#5A1030', '#1C0710', 'rgba(214,170,98,0.22)') },
  { match: /\baxis\b.*\bace\b|\bace\b.*\baxis\b/, theme: t('#3A3D45', '#121317', 'rgba(255,255,255,0.08)') },
  { match: /\baxis\b.*\bflipkart\b|\bflipkart\b.*\baxis\b/, theme: t('#2A55C9', '#0E2463', 'rgba(255,214,0,0.22)') },
  { match: /\batlas\b/, theme: t('#2E3A59', '#0D1424', 'rgba(150,180,255,0.18)') },
  // HDFC
  { match: /\binfinia\b/, theme: t('#2B2B2E', '#050506', 'rgba(255,255,255,0.08)') },
  { match: /\bdiners\b.*\bblack\b|\bdcb\b/, theme: t('#1F2023', '#000000', 'rgba(255,255,255,0.08)') },
  { match: /\bregalia\b/, theme: t('#23324F', '#0B1224', 'rgba(214,176,98,0.22)') },
  { match: /\bmillennia\b/, theme: t('#4C3FC9', '#1B1770', 'rgba(140,210,255,0.22)') },
  { match: /\bswiggy\b/, theme: t('#FF7A1A', '#C2410C', 'rgba(255,255,255,0.14)') },
  { match: /\btata\s*neu\b/, theme: t('#7B3FB8', '#3A1466', 'rgba(255,140,200,0.22)') },
  // ICICI
  { match: /\bamazon\b/, theme: t('#1E2A3A', '#0A0F17', 'rgba(255,153,0,0.24)') },
  { match: /\bsapphiro\b/, theme: t('#2B6CB0', '#0E2F5E', 'rgba(170,215,255,0.22)') },
  { match: /\brubyx\b/, theme: t('#B3203A', '#560C1B', 'rgba(255,150,170,0.20)') },
  { match: /\bemeralde?\b/, theme: t('#0F6B5A', '#05312A', 'rgba(150,255,220,0.18)') },
  { match: /\bcoral\b/, theme: t('#F06A55', '#9E2B22', 'rgba(255,210,190,0.22)') },
  // SBI
  { match: /\bsimply\s*click\b/, theme: t('#1C8CD8', '#0B3E7A', 'rgba(140,230,255,0.22)') },
  { match: /\bsbi\b.*\bcashback\b|\bcashback\b.*\bsbi\b/, theme: t('#6D3FC0', '#2C1568', 'rgba(180,150,255,0.22)') },
  { match: /\bsbi\b.*\belite\b|\belite\b.*\bsbi\b/, theme: t('#2B2D33', '#0B0C0F', 'rgba(214,176,98,0.20)') },
  // Others
  { match: /\bonecard\b|\bone\s*card\b/, theme: t('#2A2A2A', '#0A0A0A', 'rgba(255,255,255,0.10)') },
  { match: /\bplatinum\b.*\bamex\b|\bamex\b.*\bplatinum\b/, theme: t('#C9CDD3', '#7E848D', 'rgba(255,255,255,0.20)') },
];

/** Banks, by their brand colours. */
const BANKS: Rule[] = [
  { match: /\bsbi\b|\bstate bank\b/, theme: t('#2D3092', '#0D1350', 'rgba(0,181,239,0.28)') },
  { match: /\bkotak\b/, theme: t('#ED1C24', '#7F0A12', 'rgba(0,56,116,0.35)') },
  { match: /\bstandard chartered\b|\bstan\s*chart\b|\bsc bank\b|\bscb\b/, theme: t('#0473EA', '#06553A', 'rgba(56,210,0,0.30)') },
  { match: /\baxis\b/, theme: t('#97144D', '#4A0726', 'rgba(255,255,255,0.10)') },
  { match: /\bhdfc\b/, theme: t('#004C8F', '#00264A', 'rgba(237,35,42,0.28)') },
  { match: /\bicici\b/, theme: t('#B02A30', '#5E1015', 'rgba(243,126,32,0.32)') },
  { match: /\byes bank\b|^yes\b/, theme: t('#00518F', '#002A4D', 'rgba(237,28,36,0.22)') },
  { match: /\bindusind\b/, theme: t('#98272A', '#4A1012', 'rgba(255,255,255,0.10)') },
  { match: /\bidfc\b/, theme: t('#9C1D26', '#4E0A10', 'rgba(255,255,255,0.10)') },
  { match: /\bbob\b|\bbank of baroda\b|\bbaroda\b/, theme: t('#F15A22', '#9A2F0A', 'rgba(255,255,255,0.12)') },
  { match: /\bpnb\b|\bpunjab national\b/, theme: t('#A20A3A', '#55041D', 'rgba(251,184,19,0.28)') },
  { match: /\bcanara\b/, theme: t('#0091D2', '#00507A', 'rgba(255,213,0,0.30)') },
  { match: /\bunion bank\b/, theme: t('#D71920', '#123F8C', 'rgba(255,255,255,0.10)') },
  { match: /\bbank of india\b|\bboi\b/, theme: t('#F37021', '#1A3C8C', 'rgba(255,255,255,0.10)') },
  { match: /\bindian bank\b/, theme: t('#1B4E9B', '#0B2552', 'rgba(244,121,32,0.30)') },
  { match: /\bidbi\b/, theme: t('#00836C', '#00402F', 'rgba(244,121,32,0.30)') },
  { match: /\bfederal\b/, theme: t('#1B3F94', '#0A1D4D', 'rgba(255,205,0,0.30)') },
  { match: /\brbl\b/, theme: t('#21409A', '#0C1C4E', 'rgba(255,255,255,0.10)') },
  { match: /\bau\b|\bau small\b/, theme: t('#EC6608', '#5B2A86', 'rgba(255,255,255,0.12)') },
  { match: /\bciti\b|\bcitibank\b/, theme: t('#003B70', '#001F3D', 'rgba(255,60,60,0.24)') },
  { match: /\bhsbc\b/, theme: t('#DB0011', '#6E0009', 'rgba(255,255,255,0.12)') },
  { match: /\bamex\b|\bamerican express\b/, theme: t('#006FCF', '#00335F', 'rgba(255,255,255,0.12)') },
];

/** Defaults when the name doesn't match a known bank or card. */
const DEFAULT_DEBIT = t('#334155', '#0B1220', 'rgba(255,107,44,0.15)');
const DEFAULT_CREDIT = t('#FF8A4C', '#C2410C', 'rgba(255,255,255,0.07)');

const find = (rules: Rule[], name: string) => rules.find((r) => r.match.test(name))?.theme;

/** The theme for an account. Card variants apply to credit cards only; bank colours apply to both. */
export const cardThemeFor = (account: Pick<PaymentAccount, 'kind' | 'name'>): CardTheme => {
  const name = account.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  return (
    (account.kind === 'card' ? find(CARD_VARIANTS, name) : undefined) ??
    find(BANKS, name) ??
    (account.kind === 'card' ? DEFAULT_CREDIT : DEFAULT_DEBIT)
  );
};
