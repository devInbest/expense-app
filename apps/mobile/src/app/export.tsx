import { useState } from 'react';
import { DateField } from '@/components/finance';
import { AppText, Button, Card, Chip, Row, Screen } from '@/components/ui';
import { trackFeature } from '@/lib/analytics';
import { isOffline, showError } from '@/lib/api';
import { monthRange } from '@/lib/dates';
import { downloadAndShare } from '@/lib/exports';
import { useSyncStatus } from '@/hooks/data';

const PRESETS = [
  { label: 'This month', range: () => monthRange() },
  { label: 'Last month', range: () => monthRange(new Date(), -1) },
  { label: 'Last 3 months', range: () => ({ from: monthRange(new Date(), -2).from, to: monthRange().to }) },
];

export default function Export() {
  const sync = useSyncStatus();
  const initial = monthRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(new Date(initial.to.getTime() - 1));
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const stamp = from.toISOString().slice(0, 10);
      await downloadAndShare('/exports/transactions', { from, to }, `expenses-${stamp}.pdf`, 'application/pdf');
      trackFeature('export_pdf');
    } catch (err) {
      showError(isOffline(err) ? new Error('Exports need an internet connection.') : err, 'Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={[]}>
      <AppText muted>Download a PDF statement of your transactions to share with an accountant or keep for your records.</AppText>
      {sync.pending > 0 ? (
        <AppText variant="caption" muted>
          {sync.pending} recent change(s) haven’t synced yet and won’t be in the export.
        </AppText>
      ) : null}
      <Row style={{ flexWrap: 'wrap' }}>
        {PRESETS.map((p) => (
          <Chip
            key={p.label}
            label={p.label}
            onPress={() => {
              const r = p.range();
              setFrom(r.from);
              setTo(new Date(r.to.getTime() - 1));
            }}
          />
        ))}
      </Row>
      <Card>
        <DateField label="From" value={from} onChange={setFrom} />
        <DateField label="To" value={to} onChange={setTo} />
      </Card>
      <Button title="Export PDF" icon="file-pdf-box" onPress={run} loading={loading} disabled={from > to} />
    </Screen>
  );
}
