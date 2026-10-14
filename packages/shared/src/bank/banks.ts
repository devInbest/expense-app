/**
 * Display names for DLT sender headers (the `HDFCBK` in `AX-HDFCBK-S`). Parsing never depends on
 * this list: unknown banks still parse, they just show the header or the bank named in the text.
 */
const BANK_HEADERS: [RegExp, string][] = [
  [/HDFC/, 'HDFC Bank'],
  [/^(SBI|ATMSBI|CBSSBI|SBIUPI|SBIINB|SBIPSG|SBICRD|SBMSBI)|SBICARD/, 'SBI'],
  [/ICICI/, 'ICICI Bank'],
  [/AXIS/, 'Axis Bank'],
  [/KOTAK|KMBL/, 'Kotak Bank'],
  [/^(PNB|PUNB)/, 'Punjab National Bank'],
  [/^BOB|BARODA/, 'Bank of Baroda'],
  [/CANBNK|CANARA|CNRB/, 'Canara Bank'],
  [/^UNION|^UBI/, 'Union Bank'],
  [/^BOI/, 'Bank of India'],
  [/IDFC/, 'IDFC FIRST Bank'],
  [/INDUS/, 'IndusInd Bank'],
  [/^YES/, 'Yes Bank'],
  [/^FED|FEDFIB/, 'Federal Bank'],
  [/^INDBNK|^INDIAN/, 'Indian Bank'],
  [/^IOB/, 'Indian Overseas Bank'],
  [/^CENT|^CBOI/, 'Central Bank of India'],
  [/^UCO/, 'UCO Bank'],
  [/^MAHA/, 'Bank of Maharashtra'],
  [/^AU(BANK|SFB)|^AUBNK/, 'AU Small Finance Bank'],
  [/^RBL/, 'RBL Bank'],
  [/BANDHN|BANDHAN/, 'Bandhan Bank'],
  [/IDBI/, 'IDBI Bank'],
  [/^SIB/, 'South Indian Bank'],
  [/^KVB/, 'Karur Vysya Bank'],
  [/^KBL|KTKBNK/, 'Karnataka Bank'],
  [/^DBS/, 'DBS Bank'],
  [/^SCB|STANC/, 'Standard Chartered'],
  [/CITI/, 'Citi'],
  [/HSBC/, 'HSBC'],
  [/PAYTM/, 'Paytm'],
  [/AIRBNK|AIRTEL/, 'Airtel Payments Bank'],
  [/^JIOP/, 'Jio Payments Bank'],
  [/^FINO/, 'Fino Payments Bank'],
  [/EQUTAS|EQUITA/, 'Equitas Bank'],
  [/UJJIV/, 'Ujjivan Bank'],
  [/AMEX/, 'American Express'],
  [/ONECRD|ONECARD/, 'OneCard'],
  [/SLICE/, 'slice'],
  [/^JKB|^JKBANK/, 'J&K Bank'],
  [/^TMB/, 'Tamilnad Mercantile Bank'],
  [/^CSB/, 'CSB Bank'],
  [/^DCB/, 'DCB Bank'],
  [/^SARASW/, 'Saraswat Bank'],
  [/^COSMOS/, 'Cosmos Bank'],
];

const BANK_IN_TEXT = /\b(Bank of [A-Z][a-z]+|[A-Z]{2,}(?:\s[A-Z][a-z]+)?\sBank)\b/;

/** `known` means we're confident the sender is a bank (or names one), not a merchant or app. */
export const bankFromSender = (code: string, body: string): { name: string; known: boolean } => {
  for (const [rx, name] of BANK_HEADERS) if (rx.test(code)) return { name, known: true };
  const named = BANK_IN_TEXT.exec(body);
  if (named) return { name: named[1]!, known: true };
  return { name: code, known: false };
};
