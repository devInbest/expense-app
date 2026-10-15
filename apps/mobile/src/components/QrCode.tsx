import { Image } from 'expo-image';
import createQr from 'qrcode-generator';
import { useMemo } from 'react';
import { View } from 'react-native';
import { radius, spacing } from '@/theme';

/** Always dark-on-white, whatever the theme: scanners struggle with inverted codes. */
export function QrCode({ value, size = 220 }: { value: string; size?: number }) {
  const uri = useMemo(() => {
    const qr = createQr(0, 'M');
    qr.addData(value);
    qr.make();
    return qr.createDataURL(8, 0);
  }, [value]);

  return (
    <View style={{ backgroundColor: '#FFFFFF', padding: spacing.md, borderRadius: radius.lg }}>
      <Image source={{ uri }} style={{ width: size, height: size }} contentFit="contain" accessibilityLabel="UPI payment QR code" />
    </View>
  );
}
