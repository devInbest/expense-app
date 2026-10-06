import { PREMIUM_THEME_PALETTES } from './premiumThemes';

export interface ThemePalette {
  label: string;
  description: string;
  category?: string;
  swatches: string[];
  /** Ten shades, 50 to 900. */
  shades: string[];
  primaryContrast?: string;
  brand: [string, string, string];
  darkBrand: [string, string, string];
  onBrand: string;
  surface: string;
  darkSurface: string;
  login: string[];
  accent: string;
}

// Theme used until the superadmin picks one in Control Center → Theme.
// `pnpm create-project --theme <key>` rewrites this line for new projects.
export const DEFAULT_THEME_COLOR = 'crimson-slate';

const SHADE_KEYS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];

/**
 * The single list of themes — the Control Center picker, the server and `create-project`
 * all read from here. To add a theme, add an entry (key = lowercase slug) with every field:
 *
 * - label / description: shown in Control Center → Theme
 * - swatches:    the source palette, shown on the theme card
 * - shades:      accent scale 50→900 for buttons, tabs, links (Tailwind `primary-*`, Mantine);
 *                700 is the main button color in light mode, 600 in dark mode
 * - primaryContrast (optional): text color on filled accent buttons/tabs, defaults to white
 * - brand:       sidebar / page banner gradient (deep → mid → light), white text sits on it
 * - darkBrand:   deeper, muted version of `brand` for dark mode
 * - onBrand:     soft text / icon color on the sidebar and banners (next to white)
 * - surface:     page background behind the cards in light mode
 * - darkSurface: tinted background for highlighted items in dark mode
 * - login:       login page background gradient
 * - accent:      login page pixel animation
 *
 * Premium themes live in premiumThemes.js with the same shape. Add new keys to THEME_GROUP_ORDER
 * below so they appear in the right color group in the picker.
 */
const STANDARD_THEME_PALETTES: Record<string, ThemePalette> = {
  ocean: {
    label: 'Ocean Depths',
    description: 'Deep navy with bright ocean blue',
    swatches: ['#001B48', '#02457A', '#018ABE', '#97CADB', '#D6E8EE'],
    shades: ['#eef6f9', '#D6E8EE', '#b7dbe7', '#97CADB', '#56b3d8', '#1c9bcb', '#018ABE', '#026d9f', '#02457A', '#001B48'],
    brand: ['#001B48', '#02457A', '#01679c'],
    darkBrand: ['#00112e', '#012a52', '#023d6b'],
    onBrand: '#bfe0ec',
    surface: '#f1f7fa',
    darkSurface: '#0c2f45',
    login: ['#000d24', '#001B48', '#02457A'],
    accent: '#97CADB',
  },
  lagoon: {
    label: 'Lagoon',
    description: 'Deep teal fading into fresh mint',
    swatches: ['#205072', '#329D9C', '#56C596', '#7BE495', '#CFF4D2'],
    shades: ['#effbf5', '#CFF4D2', '#a9ebc0', '#7BE495', '#56C596', '#3fb19a', '#329D9C', '#2a8586', '#256a78', '#205072'],
    brand: ['#205072', '#276f80', '#2f8e90'],
    darkBrand: ['#122e42', '#184353', '#1e5961'],
    onBrand: '#c2eed6',
    surface: '#f1f9f6',
    darkSurface: '#173f45',
    login: ['#0f2a3d', '#205072', '#276d7e'],
    accent: '#7BE495',
  },
  'crimson-slate': {
    label: 'Crimson Slate',
    description: 'Charcoal slate with a bold red accent',
    swatches: ['#2B2D42', '#8D99AE', '#EDF2F4', '#EF233C', '#D90429'],
    shades: ['#fef1f2', '#fde0e3', '#fbc5cb', '#f79aa5', '#f35f71', '#f23f55', '#EF233C', '#D90429', '#b0031f', '#8a0a1f'],
    brand: ['#2B2D42', '#363950', '#474b63'],
    darkBrand: ['#1b1c2a', '#232536', '#2d3044'],
    onBrand: '#c3cad6',
    surface: '#EDF2F4',
    darkSurface: '#3a1d25',
    login: ['#15161f', '#2B2D42', '#3b3e58'],
    accent: '#EF233C',
  },
  'chili-spice': {
    label: 'Chili Spice',
    description: 'Chili Spice palette',
    swatches: ['#CD1C18', '#FFA896', '#9B1313', '#c37171', '#38000A'],
    shades: ['#fbeded', '#f6d6d5', '#eeb2b0', '#e48482', '#da5754', '#d33734', '#CD1C18', '#ac1814', '#8b1310', '#6b0f0c'],
    brand: ['#9B1313', '#af1715', '#be1917'],
    darkBrand: ['#6d0d0d', '#7a100f', '#851210'],
    onBrand: '#c37171',
    surface: '#e1d9da',
    darkSurface: '#7c0f0f',
    login: ['#5d0b0b', '#9B1313', '#af1715'],
    accent: '#9B1313',
  },
  'stormy-morning': {
    label: 'Stormy Morning',
    description: 'Stormy Morning palette',
    swatches: ['#35465C', '#60758A', '#A5B2C0', '#c9d1d9', '#E7ECF0'],
    shades: ['#eff0f2', '#dbdee2', '#bac0c8', '#929ba7', '#6a7686', '#4d5c70', '#35465C', '#2d3b4d', '#24303f', '#1c2430'],
    brand: ['#35465C', '#46596e', '#53677c'],
    darkBrand: ['#253140', '#313e4d', '#3a4857'],
    onBrand: '#c9d1d9',
    surface: '#eef2f5',
    darkSurface: '#2a384a',
    login: ['#202a37', '#35465C', '#46596e'],
    accent: '#A5B2C0',
  },
  'mossy-hollow': {
    label: 'Mossy Hollow',
    description: 'Mossy Hollow palette',
    swatches: ['#38452C', '#66774B', '#A2AE7B', '#c7ceb0', '#E5E7D2'],
    shades: ['#eff0ee', '#dbded9', '#bbc0b7', '#949b8d', '#6c7563', '#505b45', '#38452C', '#2f3a25', '#262f1e', '#1d2417'],
    brand: ['#38452C', '#4a5938', '#586842'],
    darkBrand: ['#27301f', '#343e27', '#3e492e'],
    onBrand: '#c7ceb0',
    surface: '#edeee0',
    darkSurface: '#2d3723',
    login: ['#22291a', '#38452C', '#4a5938'],
    accent: '#A2AE7B',
  },
  'blue-eclipse': {
    label: 'Blue Eclipse',
    description: 'Blue Eclipse palette',
    swatches: ['#0B1026', '#172554', '#334B80', '#8593b3', '#849AC4'],
    shades: ['#ebecee', '#d3d4d8', '#acaeb5', '#7b7e8a', '#4a4e5e', '#282d40', '#0B1026', '#090d20', '#070b1a', '#060814'],
    brand: ['#0B1026', '#101838', '#131f46'],
    darkBrand: ['#080b1b', '#0b1127', '#0d1631'],
    onBrand: '#8593b3',
    surface: '#edf0f6',
    darkSurface: '#090d1e',
    login: ['#070a17', '#0B1026', '#101838'],
    accent: '#334B80',
  },
  'lush-forest': {
    label: 'Lush Forest',
    description: 'Lush Forest palette',
    swatches: ['#163D2B', '#286344', '#5F9870', '#9fc1a9', '#DCE9D9'],
    shades: ['#ecefee', '#d5dcd9', '#b0bdb7', '#81968d', '#536f62', '#325444', '#163D2B', '#123324', '#0f291d', '#0b2016'],
    brand: ['#163D2B', '#1d4c35', '#23583d'],
    darkBrand: ['#0f2b1e', '#143525', '#193e2b'],
    onBrand: '#9fc1a9',
    surface: '#e7f0e4',
    darkSurface: '#123122',
    login: ['#0d251a', '#163D2B', '#1d4c35'],
    accent: '#5F9870',
  },
  'chocolate-truffle': {
    label: 'Chocolate Truffle',
    description: 'Chocolate Truffle palette',
    swatches: ['#40251E', '#704634', '#B88961', '#d4b8a0', '#F2E4D1'],
    shades: ['#f0eeed', '#ddd8d7', '#beb5b3', '#988986', '#725e59', '#573f39', '#40251E', '#361f19', '#2c1914', '#211310'],
    brand: ['#40251E', '#533227', '#623c2d'],
    darkBrand: ['#2d1a15', '#3a231b', '#452a1f'],
    onBrand: '#d4b8a0',
    surface: '#f6ecdf',
    darkSurface: '#331e18',
    login: ['#261612', '#40251E', '#533227'],
    accent: '#B88961',
  },
  'golden-taupe': {
    label: 'Golden Taupe',
    description: 'Golden Taupe palette',
    swatches: ['#796344', '#A68A64', '#D2BE9B', '#e4d8c3', '#F5EFE4'],
    shades: ['#f4f3f0', '#e7e3dd', '#d1cabf', '#b7ab9a', '#9c8c75', '#89765a', '#796344', '#665339', '#52432e', '#3f3323'],
    brand: ['#796344', '#8b7351', '#997e5a'],
    darkBrand: ['#554530', '#615139', '#6b583f'],
    onBrand: '#e4d8c3',
    surface: '#f8f4ec',
    darkSurface: '#614f36',
    login: ['#493b29', '#796344', '#8b7351'],
    accent: '#D2BE9B',
  },
  'wisteria-bloom': {
    label: 'Wisteria Bloom',
    description: 'Wisteria Bloom palette',
    swatches: ['#4C2C78', '#8063AA', '#B9A4D5', '#d5c8e6', '#EEE7F6'],
    shades: ['#f1eef4', '#dfd9e7', '#c2b7d1', '#9e8db6', '#7b639b', '#614588', '#4C2C78', '#402565', '#341e52', '#28173e'],
    brand: ['#4C2C78', '#61428c', '#70539b'],
    darkBrand: ['#351f54', '#442e62', '#4e3a6d'],
    onBrand: '#d5c8e6',
    surface: '#f3eef9',
    darkSurface: '#3d2360',
    login: ['#2e1a48', '#4C2C78', '#61428c'],
    accent: '#B9A4D5',
  },
  'calm-blue': {
    label: 'Calm Blue',
    description: 'Calm Blue palette',
    swatches: ['#164E73', '#347FA5', '#8BC5D8', '#b9dce8', '#E5F3F7'],
    shades: ['#ecf1f4', '#d5dfe6', '#b0c3cf', '#819fb3', '#537c97', '#326384', '#164E73', '#124261', '#0f354e', '#0b293c'],
    brand: ['#164E73', '#226287', '#2b7096'],
    darkBrand: ['#0f3751', '#18455f', '#1e4e69'],
    onBrand: '#b9dce8',
    surface: '#edf7f9',
    darkSurface: '#123e5c',
    login: ['#0d2f45', '#164E73', '#226287'],
    accent: '#8BC5D8',
  },
  'eucalyptus-grove': {
    label: 'Eucalyptus Grove',
    description: 'Eucalyptus Grove palette',
    swatches: ['#354E45', '#718C7C', '#B4C7B8', '#d2ddd4', '#F0F3EE'],
    shades: ['#eff1f0', '#dbdfde', '#bac3c0', '#929f9b', '#6a7c75', '#4d635b', '#354E45', '#2d423a', '#24352f', '#1c2924'],
    brand: ['#354E45', '#4d675b', '#5f796c'],
    darkBrand: ['#253730', '#364840', '#43554c'],
    onBrand: '#d2ddd4',
    surface: '#f5f7f3',
    darkSurface: '#2a3e37',
    login: ['#202f29', '#354E45', '#4d675b'],
    accent: '#B4C7B8',
  },
  'golden-hour': {
    label: 'Golden Hour',
    description: 'Golden Hour palette',
    swatches: ['#F4A300', '#FFC857', '#E76F51', '#f1a997', '#FFF4D6'],
    shades: ['#fef8eb', '#fdeed1', '#fbe0a8', '#f9cd75', '#f7bb42', '#f5ae1f', '#F4A300', '#cd8900', '#a66f00', '#7f5500'],
    brand: ['#E76F51', '#ec8431', '#f09318'],
    darkBrand: ['#a24e39', '#a55c22', '#a86711'],
    onBrand: '#f1a997',
    surface: '#fff7e2',
    darkSurface: '#b95941',
    login: ['#8b4331', '#E76F51', '#ec8431'],
    accent: '#E76F51',
  },
  'zesty-lemon': {
    label: 'Zesty Lemon',
    description: 'Zesty Lemon palette',
    swatches: ['#D4E600', '#F0F76A', '#7CA800', '#b0cb66', '#FAFFD6'],
    shades: ['#fcfdeb', '#f7fbd1', '#f0f7a8', '#e8f275', '#dfed42', '#d9e91f', '#D4E600', '#b2c100', '#909c00', '#6e7800'],
    brand: ['#7CA800', '#9fc100', '#bad300'],
    darkBrand: ['#577600', '#6f8700', '#829400'],
    onBrand: '#b0cb66',
    surface: '#fcffe2',
    darkSurface: '#638600',
    login: ['#4a6500', '#7CA800', '#9fc100'],
    accent: '#7CA800',
  },
  'freshly-squeezed': {
    label: 'Freshly Squeezed',
    description: 'Freshly Squeezed palette',
    swatches: ['#FF8C00', '#FFC04D', '#FF5E35', '#ff9e86', '#FFF1DB'],
    shades: ['#fff6eb', '#ffead1', '#ffd8a8', '#ffc175', '#ffaa42', '#ff9a1f', '#FF8C00', '#d67600', '#ad5f00', '#854900'],
    brand: ['#FF5E35', '#ff7020', '#ff7e10'],
    darkBrand: ['#b34225', '#b34e16', '#b3580b'],
    onBrand: '#ff9e86',
    surface: '#fff5e6',
    darkSurface: '#cc4b2a',
    login: ['#993820', '#FF5E35', '#ff7020'],
    accent: '#FF5E35',
  },
  'electric-kiwi': {
    label: 'Electric Kiwi',
    description: 'Electric Kiwi palette',
    swatches: ['#7ED900', '#B5F550', '#00A86B', '#66cba6', '#F2FFD9'],
    shades: ['#f5fceb', '#e8f8d1', '#d3f2a8', '#b9ea75', '#a0e342', '#8dde1f', '#7ED900', '#6ab600', '#569400', '#427100'],
    brand: ['#00A86B', '#32bc40', '#58ca20'],
    darkBrand: ['#00764b', '#23842d', '#3e8d16'],
    onBrand: '#66cba6',
    surface: '#f6ffe4',
    darkSurface: '#008656',
    login: ['#006540', '#00A86B', '#32bc40'],
    accent: '#00A86B',
  },
  'tangerine-burst': {
    label: 'Tangerine Burst',
    description: 'Tangerine Burst palette',
    swatches: ['#FF6B00', '#FF8C42', '#FFC15E', '#ffda9e', '#FFF0D9'],
    shades: ['#fff3eb', '#ffe4d1', '#ffcda8', '#ffaf75', '#ff9142', '#ff7d1f', '#FF6B00', '#d65a00', '#ad4900', '#853800'],
    brand: ['#FF6B00', '#ff781a', '#ff822e'],
    darkBrand: ['#b34b00', '#b35412', '#b35b20'],
    onBrand: '#ffda9e',
    surface: '#fff5e4',
    darkSurface: '#cc5600',
    login: ['#994000', '#FF6B00', '#ff781a'],
    accent: '#FFC15E',
  },
  'tropical-punch': {
    label: 'Tropical Punch',
    description: 'Tropical Punch palette',
    swatches: ['#FF3366', '#FF6685', '#FF9EAA', '#ffc5cc', '#FFF0F3'],
    shades: ['#ffeff3', '#ffdae3', '#ffbacb', '#ff91ac', '#ff688e', '#ff4b78', '#FF3366', '#d62b56', '#ad2345', '#851b35'],
    brand: ['#FF3366', '#ff4772', '#ff577c'],
    darkBrand: ['#b32447', '#b33250', '#b33d57'],
    onBrand: '#ffc5cc',
    surface: '#fff5f7',
    darkSurface: '#cc2952',
    login: ['#991f3d', '#FF3366', '#ff4772'],
    accent: '#FF9EAA',
  },
  'coral-reef': {
    label: 'Coral Reef',
    description: 'Coral Reef palette',
    swatches: ['#FF4F5E', '#FF786B', '#FFB199', '#ffd0c2', '#FFF1E8'],
    shades: ['#fff1f2', '#ffdfe2', '#ffc3c8', '#ffa0a8', '#ff7d88', '#ff6471', '#FF4F5E', '#d6424f', '#ad3640', '#852931'],
    brand: ['#FF4F5E', '#ff5f63', '#ff6c67'],
    darkBrand: ['#b33742', '#b34345', '#b34c48'],
    onBrand: '#ffd0c2',
    surface: '#fff5ef',
    darkSurface: '#cc3f4b',
    login: ['#992f38', '#FF4F5E', '#ff5f63'],
    accent: '#FFB199',
  },
  'aqua-pop': {
    label: 'Aqua Pop',
    description: 'Aqua Pop palette',
    swatches: ['#00B8D9', '#00D4C7', '#7CEFE2', '#b0f5ee', '#E5FFFA'],
    shades: ['#ebf9fc', '#d1f2f8', '#a8e7f2', '#75d9ea', '#42cae3', '#1fc1de', '#00B8D9', '#009bb6', '#007d94', '#006071'],
    brand: ['#00B8D9', '#00c3d2', '#00cccc'],
    darkBrand: ['#008198', '#008993', '#008f8f'],
    onBrand: '#b0f5ee',
    surface: '#edfffc',
    darkSurface: '#0093ae',
    login: ['#006e82', '#00B8D9', '#00c3d2'],
    accent: '#7CEFE2',
  },
};

export const THEME_PALETTES: Record<string, ThemePalette> = { ...STANDARD_THEME_PALETTES, ...PREMIUM_THEME_PALETTES };

export const THEME_COLOR_KEYS = Object.keys(THEME_PALETTES);

// Order of the Control Center picker, by color. Themes missing from this list are shown last.
const THEME_GROUP_ORDER = [
  {
    label: 'Reds',
    keys: ['crimson-slate', 'chili-spice', 'burgundy-elegance', 'coral-reef', 'tropical-punch', 'rose-gold'],
  },
  {
    label: 'Oranges',
    keys: ['tangerine-burst', 'freshly-squeezed', 'copper-luxury', 'chocolate-truffle', 'golden-taupe', 'champagne-beige'],
  },
  {
    label: 'Yellows',
    keys: ['golden-hour', 'zesty-lemon', 'olive-gold'],
  },
  {
    label: 'Blues',
    keys: [
      'aqua-pop', 'arctic-blue', 'deep-ocean', 'ocean', 'ocean-blue', 'calm-blue', 'electric-blue',
      'sapphire-gold', 'midnight-navy', 'blue-eclipse', 'steel-blue', 'stormy-morning', 'slate-professional',
    ],
  },
  {
    label: 'Greens',
    keys: [
      'lagoon', 'corporate-teal', 'emerald-luxury', 'electric-kiwi', 'lush-forest', 'forest-luxury',
      'eucalyptus-grove', 'mossy-hollow', 'sage-minimal',
    ],
  },
  {
    label: 'Purples',
    keys: ['royal-indigo', 'soft-lavender', 'wisteria-bloom', 'royal-purple', 'midnight-plum'],
  },
  {
    label: 'Neutrals',
    keys: ['charcoal-gold', 'warm-taupe', 'monochrome-modern', 'onyx-platinum'],
  },
];

const orderedKeys = new Set(THEME_GROUP_ORDER.flatMap((group) => group.keys));
const otherKeys = THEME_COLOR_KEYS.filter((key) => !orderedKeys.has(key));

export const ORDERED_THEME_KEYS = [
  ...THEME_GROUP_ORDER.flatMap((group) => group.keys).filter((key) => Object.hasOwn(THEME_PALETTES, key)),
  ...otherKeys,
];

export const isThemeKey = (key: string | null | undefined): key is string =>
  typeof key === 'string' && Object.hasOwn(THEME_PALETTES, key);

export const getPalette = (key: string): ThemePalette => THEME_PALETTES[key] ?? THEME_PALETTES[DEFAULT_THEME_COLOR]!;

const hexToRgb = (hex: string) => {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
};

const hexToRgbTriplet = (hex: string) => hexToRgb(hex).join(' ');

/** WCAG relative luminance (0 = black, 1 = white). */
const relativeLuminance = (hex: string) => {
  const [r = 0, g = 0, b = 0] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG contrast ratio between two hex colors (1–21). */
const contrastRatio = (a: string, b: string) => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * Best-contrast text color for a given background. Returns near-black or white,
 * whichever has the higher contrast ratio — so text stays legible on both very
 * light (yellow/lime) and very dark theme colors.
 */
const contrastText = (bgHex: string, { dark = '#000000', light = '#ffffff' } = {}) =>
  contrastRatio(bgHex, dark) >= contrastRatio(bgHex, light) ? dark : light;

/** Writes the palette's CSS variables onto <html>; every themed style reads from these. */
export const applyThemeColor = (key: string) => {
  const palette = getPalette(key);
  const root = document.documentElement;
  palette.shades.forEach((hex, i) => {
    root.style.setProperty(`--primary-${SHADE_KEYS[i]}`, hexToRgbTriplet(hex));
  });
  // index.css maps --brand-deep/mid/light to the light or dark set based on data-theme.
  ['deep', 'mid', 'light'].forEach((step, i) => {
    root.style.setProperty(`--brand-light-${step}`, palette.brand[i]);
    root.style.setProperty(`--brand-dark-${step}`, palette.darkBrand[i]);
  });
  palette.login.forEach((hex, i) => root.style.setProperty(`--brand-login-${i + 1}`, hex));
  root.style.setProperty('--brand-accent', palette.accent);
  root.style.setProperty('--brand-surface', palette.surface);
  root.style.setProperty('--brand-dark-surface', palette.darkSurface);

  // ── Contrast-aware text colors ──────────────────────────────────────────────
  // Text sitting on the filled accent button (primary-700 light / primary-600 dark)
  // and on the brand gradient must stay legible for every palette — including the
  // very light ones (Zesty Lemon, Golden Hour, Aqua Pop…). We compute black-or-white
  // from luminance instead of assuming white. An explicit `primaryContrast` wins.
  const primaryContrast = palette.primaryContrast || contrastText(palette.shades[7]);
  root.style.setProperty('--primary-contrast', primaryContrast);
  root.style.setProperty('--primary-contrast-dark', palette.primaryContrast || contrastText(palette.shades[6]));

  // Main text (headings, active nav) sitting on the brand gradient, per mode.
  const brandTextLight = contrastText(palette.brand[1]);
  const brandTextDark = contrastText(palette.darkBrand[1]);
  root.style.setProperty('--brand-text-light', brandTextLight);
  root.style.setProperty('--brand-text-dark', brandTextDark);

  // Soft/secondary text on the gradient (subtitles, roles). Fall back to the main
  // text color when the palette's decorative `onBrand` is itself too low-contrast.
  const softOn = (bg: string, provided: string) =>
    contrastRatio(bg, provided) >= 3 ? provided : contrastText(bg);
  root.style.setProperty('--brand-on', softOn(palette.brand[1], palette.onBrand));
  root.style.setProperty('--brand-on-light', softOn(palette.brand[1], palette.onBrand));
  root.style.setProperty('--brand-on-dark', softOn(palette.darkBrand[1], palette.onBrand));

  root.setAttribute('data-theme-color', isThemeKey(key) ? key : DEFAULT_THEME_COLOR);
  root.setAttribute('data-theme-group', Object.hasOwn(PREMIUM_THEME_PALETTES, key) ? 'premium' : 'standard');
};
