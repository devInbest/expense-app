import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { formatMoney } from '@expense/shared';
import { detectInstalledApps, openUpiApp, UPI_APPS, type UpiApp } from '@/lib/upi';
import { spacing, useTheme } from '@/theme';
import { AppText, Card, Divider, Icon, IconButton, ListItem, Row, Sheet } from './ui';

export interface PayDetails {
  payeeName: string;
  upiId?: string;
  /** Minor units. */
  amount: number;
  currency: string;
}

/** Lists the UPI apps installed on this phone; tapping one opens it so the person can pay. */
export function PaySheet({ visible, onClose, payment }: { visible: boolean; onClose: () => void; payment: PayDetails }) {
  const { colors } = useTheme();
  const [installed, setInstalled] = useState<Record<string, string> | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    void detectInstalledApps().then((found) => alive && setInstalled(found));
    return () => {
      alive = false;
    };
  }, [visible]);

  const apps = installed ? UPI_APPS.filter((app) => app.key in installed) : [];

  const open = async (app: UpiApp) => {
    try {
      await openUpiApp(app);
      onClose();
    } catch {
      Alert.alert(`Couldn't open ${app.name}`, 'Try another app.');
    }
  };

  const copy = async (text: string) => {
    await Clipboard.setStringAsync(text);
    setCopied(true);
  };

  return (
    <Sheet visible={visible} title="Pay with" onClose={onClose}>
      <Card style={{ alignItems: 'center', gap: spacing.xs }}>
        <AppText muted>Pay {payment.payeeName}</AppText>
        <AppText variant="title">{formatMoney(payment.amount, payment.currency)}</AppText>
        {payment.upiId ? (
          <Row gap={spacing.xs}>
            <AppText variant="caption" muted selectable>
              {payment.upiId}
            </AppText>
            <IconButton
              icon={copied ? 'check' : 'content-copy'}
              label={copied ? 'Copied' : 'Copy UPI ID'}
              size={16}
              color={copied ? colors.success : colors.primary}
              onPress={() => void copy(payment.upiId!)}
            />
          </Row>
        ) : null}
      </Card>

      {!installed ? (
        <ActivityIndicator color={colors.primary} />
      ) : apps.length ? (
        <Card style={{ paddingVertical: 0 }}>
          {apps.map((app, i) => (
            <View key={app.key}>
              {i ? <Divider /> : null}
              <ListItem title={app.name} left={<AppBadge icon={app.icon} color={app.color} image={installed[app.key]} />} onPress={() => void open(app)} />
            </View>
          ))}
        </Card>
      ) : (
        <AppText muted style={{ textAlign: 'center' }}>
          No UPI apps found on this phone
        </AppText>
      )}
    </Sheet>
  );
}

function AppBadge({ icon, color, image }: { icon: string; color: string; image?: string }) {
  if (image) return <Image source={{ uri: image }} style={{ width: 36, height: 36, borderRadius: 10 }} />;
  return (
    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: `${color}1A`, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={icon} size={20} color={color} />
    </View>
  );
}
