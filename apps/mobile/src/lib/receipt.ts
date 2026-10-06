import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { formatMoney } from '@expense/shared';
import type { LocalTransaction } from './transactions';

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const receiptHtml = (tx: LocalTransaction, categoryName: string, methodLabel: string) => {
  const when = new Date(tx.occurredAt);
  const rows: [string, string][] = [
    ['Type', tx.type === 'income' ? 'Income' : 'Expense'],
    ['Category', categoryName],
    [tx.type === 'income' ? 'Received via' : 'Paid with', methodLabel],
    ['Date', when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })],
    ['Time', when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })],
    ...(tx.note ? ([['Note', tx.note]] as [string, string][]) : []),
  ];
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Receipt</title>
<style>body{font-family:-apple-system,Roboto,sans-serif;max-width:420px;margin:24px auto;padding:0 16px;color:#111}
h1{font-size:18px;text-align:center;margin:0 0 4px}.amt{font-size:32px;font-weight:700;text-align:center;margin:8px 0 24px}
table{width:100%;border-collapse:collapse}td{padding:8px 0;border-bottom:1px solid #eee}td:last-child{text-align:right}
.total td{font-weight:700;border-bottom:none}.ref{color:#888;font-size:12px;text-align:center;margin-top:24px}</style></head>
<body><h1>Transaction receipt</h1><div class="amt">${escape(formatMoney(tx.amount, tx.currency))}</div><table>
${rows.map(([k, v]) => `<tr><td>${escape(k)}</td><td>${escape(v)}</td></tr>`).join('')}
<tr class="total"><td>Total</td><td>${escape(formatMoney(tx.amount, tx.currency))}</td></tr></table>
<div class="ref">Ref ${escape(tx.clientId)}</div></body></html>`;
};

/** Shares the attached receipt image when there is one, otherwise a generated HTML receipt. */
export const shareReceipt = async (tx: LocalTransaction, categoryName: string, methodLabel: string) => {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing isn’t available on this device');

  if (tx.receiptUrl) {
    const ext = tx.receiptUrl.split('?')[0]!.split('.').pop()?.toLowerCase();
    const isPng = ext === 'png';
    const target = new File(Paths.cache, `receipt-${tx.clientId}.${isPng ? 'png' : 'jpg'}`);
    if (target.exists) target.delete();
    const file = await File.downloadFileAsync(tx.receiptUrl, target, { idempotent: true });
    await Sharing.shareAsync(file.uri, { mimeType: isPng ? 'image/png' : 'image/jpeg', dialogTitle: 'Receipt' });
    return;
  }

  const file = new File(Paths.cache, `receipt-${tx.clientId}.html`);
  if (file.exists) file.delete();
  file.create();
  file.write(receiptHtml(tx, categoryName, methodLabel));
  await Sharing.shareAsync(file.uri, { mimeType: 'text/html', dialogTitle: 'Receipt', UTI: 'public.html' });
};
