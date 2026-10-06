import { Router, type Response } from 'express';
import PDFDocument from 'pdfkit';
import { exportQuerySchema, fromMinor } from '@expense/shared';
import { asyncHandler } from '../../core/asyncHandler';
import { query, validate } from '../../core/validate';
import { inTz } from '../../lib/dates';
import { logUser } from '../activity/activity.service';
import { Category } from '../categories/category.model';
import { visibleCategoryFilter } from '../categories/category.service';
import { loadRoomForMember } from '../rooms/access';
import { RoomExpense } from '../rooms/room.models';
import { loadPublicUsers } from '../users/publicUser';
import { Transaction } from '../transactions/transaction.model';

const router = Router();
const MAX_ROWS = 10_000;

interface PdfTable {
  filename: string;
  title: string;
  columns: { label: string; width: number }[];
  rows: string[][];
  footer: string;
}

const sendPdf = (res: Response, { filename, title, columns, rows, footer }: PdfTable) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const doc = new PDFDocument({ margin: 36, size: 'A4' });
  doc.pipe(res);
  doc.fontSize(16).text(title).moveDown(0.5);
  const drawRow = (cells: string[], bold = false) => {
    if (doc.y > 780) doc.addPage();
    const y = doc.y;
    let x = 36;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(9);
    cells.forEach((c, i) => {
      const width = columns[i]?.width ?? 80;
      doc.text(c, x, y, { width: width - 6, ellipsis: true, lineBreak: false });
      x += width;
    });
    doc.x = 36;
    doc.y = y + 15;
  };
  drawRow(columns.map((c) => c.label), true);
  rows.forEach((r) => drawRow(r));
  if (!rows.length) doc.font('Helvetica').fontSize(10).text('No entries in this period.', 36);
  doc.moveDown().font('Helvetica-Bold').fontSize(10).text(footer, 36);
  doc.end();
};

router.get(
  '/transactions',
  validate(exportQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { from, to } = query(req, exportQuerySchema);
    const [rows, categories] = await Promise.all([
      Transaction.find({ userId: user._id, deletedAt: null, binnedAt: null, occurredAt: { $gte: from, $lte: to } }).sort({ occurredAt: 1 }).limit(MAX_ROWS).lean(),
      Category.find(visibleCategoryFilter(user._id)).select('name').lean(),
    ]);
    const catName = new Map(categories.map((c) => [String(c._id), c.name]));
    const tz = user.timezone;
    const name = `transactions_${inTz(from, tz).format('YYYYMMDD')}_${inTz(to, tz).format('YYYYMMDD')}`;
    logUser(req, 'export.transactions', { meta: { format: 'pdf', rows: rows.length } });

    const net = rows.reduce((a, t) => a + (t.type === 'expense' ? -t.amount : t.amount), 0);
    sendPdf(res, {
      filename: `${name}.pdf`,
      title: `Transactions ${inTz(from, tz).format('D MMM YYYY')} - ${inTz(to, tz).format('D MMM YYYY')}`,
      columns: [
        { label: 'Date', width: 70 },
        { label: 'Category', width: 110 },
        { label: 'Note', width: 160 },
        { label: 'Type', width: 70 },
        { label: 'Amount', width: 110 },
      ],
      rows: rows.map((t) => [
        inTz(t.occurredAt, tz).format('YYYY-MM-DD'),
        catName.get(String(t.categoryId)) ?? 'Uncategorized',
        t.note ?? '',
        t.type,
        `${fromMinor(t.type === 'expense' ? -t.amount : t.amount, t.currency).toFixed(2)} ${t.currency}`,
      ]),
      footer: `Net: ${fromMinor(net, user.defaultCurrency).toFixed(2)} ${user.defaultCurrency} across ${rows.length} entries`,
    });
  }),
);

router.get(
  '/rooms/:id',
  validate(exportQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const { from, to } = query(req, exportQuerySchema);
    const { room } = await loadRoomForMember(String(req.params.id), user._id, { allowFormer: true });
    const expenses = await RoomExpense.find({ roomId: room._id, deletedAt: null, occurredAt: { $gte: from, $lte: to } })
      .sort({ occurredAt: 1 })
      .limit(MAX_ROWS)
      .lean();
    const users = await loadPublicUsers(expenses.flatMap((e) => [...e.paidBy.map((p) => String(p.userId)), ...e.splits.map((s) => String(s.userId))]));
    const nameOf = (id: unknown) => users.get(String(id))?.name ?? 'Unknown';
    const tz = user.timezone;
    logUser(req, 'export.room', { roomId: room._id, meta: { format: 'pdf', rows: expenses.length } });

    const total = expenses.reduce((a, e) => a + e.amount, 0);
    sendPdf(res, {
      filename: `${room.name.replace(/[^\w-]+/g, '_')}.pdf`,
      title: `${room.name} · ${inTz(from, tz).format('D MMM YYYY')} - ${inTz(to, tz).format('D MMM YYYY')}`,
      columns: [
        { label: 'Date', width: 62 },
        { label: 'Note', width: 120 },
        { label: `Amount (${room.currency})`, width: 75 },
        { label: 'Paid by', width: 132 },
        { label: 'Split', width: 134 },
      ],
      rows: expenses.map((e) => [
        inTz(e.occurredAt, tz).format('YYYY-MM-DD'),
        e.note ?? '',
        fromMinor(e.amount, room.currency).toFixed(2),
        e.paidBy.map((p) => `${nameOf(p.userId)} ${fromMinor(p.amount, room.currency).toFixed(2)}`).join(', '),
        e.splits.map((s) => `${nameOf(s.userId)} ${fromMinor(s.amount, room.currency).toFixed(2)}`).join(', '),
      ]),
      footer: `Total: ${fromMinor(total, room.currency).toFixed(2)} ${room.currency} across ${expenses.length} expenses`,
    });
  }),
);

export default router;
