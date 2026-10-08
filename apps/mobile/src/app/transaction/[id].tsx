import { Image } from 'expo-image';
import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, View } from 'react-native';
import { PAYMENT_METHOD_VALUES, toMinor, type PaymentMethod, type TransactionType, LIMITS } from '@expense/shared';
import { AmountInput, CategoryGrid, DateField } from '@/components/finance';
import { Appear, Button, Chip, ErrorText, Field, Glass, Row, Screen, Section, Segmented } from '@/components/ui';
import { useCategories } from '@/hooks/data';
import { trackFeature } from '@/lib/analytics';
import { errorMessage, isOffline } from '@/lib/api';
import { useUser } from '@/lib/auth';
import { createTransaction } from '@/lib/transactions';
import { pickAndUploadImage } from '@/lib/uploads';
import { radius, spacing } from '@/theme';

const METHOD_LABEL: Record<PaymentMethod, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', bank: 'Bank', other: 'Other' };
const METHOD_ICON: Record<PaymentMethod, string> = { cash: 'cash', upi: 'qrcode-scan', card: 'credit-card-outline', bank: 'bank-outline', other: 'wallet-outline' };

/** Add-only: saved transactions are read-only and open in the details page instead. */
export default function TransactionForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (id !== 'new') return <Redirect href={{ pathname: '/transaction/view/[id]', params: { id } }} />;
  return <NewTransactionForm />;
}

function NewTransactionForm() {
  const user = useUser();
  const { categories } = useCategories();

  const [type, setType] = useState<TransactionType>('expense');
  const [maxDate] = useState(() => new Date(Date.now() + 86_400_000));
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [note, setNote] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [date, setDate] = useState(new Date());
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const currency = user.defaultCurrency;
  const visibleCategories = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);

  const save = async () => {
    const minor = toMinor(amount || '0', currency);
    if (minor <= 0) return setError('Enter an amount');
    if (minor > LIMITS.MAX_AMOUNT_MINOR) return setError('That amount is too large');
    if (!categoryId) return setError('Pick a category');
    setSaving(true);
    try {
      await createTransaction({
        type,
        amount: minor,
        currency,
        categoryId,
        note: note.trim(),
        paymentMethod: method,
        occurredAt: date.toISOString(),
        receiptUrl,
        tags: [],
      });
      trackFeature('transaction_add');
      router.back();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const attach = async (source: 'library' | 'camera') => {
    setUploading(true);
    try {
      const url = await pickAndUploadImage('receipt', source);
      if (url) {
        setReceiptUrl(url);
        trackFeature('receipt_upload');
      }
    } catch (err) {
      Alert.alert('Upload failed', isOffline(err) ? 'Receipts need an internet connection.' : errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const chooseReceiptSource = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Take photo', 'Choose from library', 'Cancel'], cancelButtonIndex: 2 },
        (i) => {
          if (i === 0) void attach('camera');
          if (i === 1) void attach('library');
        },
      );
    } else {
      Alert.alert('Add receipt', undefined, [
        { text: 'Camera', onPress: () => void attach('camera') },
        { text: 'Gallery', onPress: () => void attach('library') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  return (
    <Screen edges={['bottom']} contentStyle={{ paddingBottom: spacing.lg }}>
      <Stack.Screen options={{ title: 'Add transaction' }} />
      <Appear>
        <Glass blur style={{ padding: spacing.md, gap: spacing.xs }} rounded={radius.xl}>
          <Segmented
            glass
            options={[
              { value: 'expense', label: 'Expense' },
              { value: 'income', label: 'Income' },
            ]}
            value={type}
            onChange={(t) => {
              setType(t);
              setCategoryId(undefined);
            }}
          />
          <AmountInput value={amount} onChange={setAmount} currency={currency} autoFocus />
        </Glass>
      </Appear>

      <Appear index={1}>
        <Section title="Category">
          <CategoryGrid categories={visibleCategories} value={categoryId} onChange={setCategoryId} />
        </Section>
      </Appear>

      <Appear index={2} style={{ gap: spacing.lg }}>
        <Field label="Note" value={note} onChangeText={setNote} placeholder="What was it for?" maxLength={280} />

        <Section title={type === 'income' ? 'Received via' : 'Paid with'}>
          <Row style={{ flexWrap: 'wrap' }}>
            {PAYMENT_METHOD_VALUES.map((m) => (
              <Chip key={m} label={METHOD_LABEL[m]} icon={METHOD_ICON[m]} selected={method === m} onPress={() => setMethod(m)} />
            ))}
          </Row>
        </Section>

        <DateField label="Date" value={date} onChange={setDate} maximumDate={maxDate} />

        <View style={{ gap: spacing.sm }}>
          <Section title="Receipt">
            {receiptUrl ? (
              <View style={{ gap: spacing.sm }}>
                <Image source={{ uri: receiptUrl }} style={{ width: '100%', height: 200, borderRadius: radius.lg }} contentFit="cover" />
                <Button title="Remove receipt" variant="ghost" compact onPress={() => setReceiptUrl(null)} />
              </View>
            ) : (
              <Button title="Attach receipt" icon="camera-outline" variant="glass" loading={uploading} onPress={chooseReceiptSource} />
            )}
          </Section>
          <ErrorText>{error}</ErrorText>
          <Button title="Save" icon="check" onPress={save} loading={saving} />
        </View>
      </Appear>
    </Screen>
  );
}
