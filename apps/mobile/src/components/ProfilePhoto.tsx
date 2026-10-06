import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, View } from 'react-native';
import { Avatar, Icon } from '@/components/ui';
import { trackFeature } from '@/lib/analytics';
import { api, showError } from '@/lib/api';
import { useAuth, useUser } from '@/lib/auth';
import { pickAndUploadImage } from '@/lib/uploads';
import { useTheme } from '@/theme';

/** The signed-in user's avatar; tap to take, choose or remove a profile photo. */
export function ProfilePhoto({ size = 72 }: { size?: number }) {
  const user = useUser();
  const { setUser } = useAuth();
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);

  const save = async (avatarUrl: string) => {
    setBusy(true);
    try {
      setUser(await api.me.update({ avatarUrl }));
      trackFeature(avatarUrl ? 'avatar_updated' : 'avatar_removed');
    } catch (err) {
      showError(err, "Couldn't update your photo");
    } finally {
      setBusy(false);
    }
  };

  const upload = async (source: 'camera' | 'library') => {
    try {
      setBusy(true);
      const url = await pickAndUploadImage('avatar', source);
      if (url) await save(url);
    } catch (err) {
      showError(err, 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const openMenu = () =>
    Alert.alert('Profile photo', undefined, [
      { text: 'Take photo', onPress: () => void upload('camera') },
      { text: 'Choose from library', onPress: () => void upload('library') },
      ...(user.avatarUrl
        ? [{ text: 'Remove photo', style: 'destructive' as const, onPress: () => void save('') }]
        : []),
      { text: 'Cancel', style: 'cancel' },
    ]);

  const badge = Math.max(22, Math.round(size * 0.32));

  return (
    <Pressable
      onPress={openMenu}
      disabled={busy}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Change profile photo">
      <Avatar name={user.name} uri={user.avatarUrl} size={size} />
      {busy ? (
        <View
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: size / 2,
            backgroundColor: 'rgba(0,0,0,0.35)',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
      <View
        style={{
          position: 'absolute',
          right: -2,
          bottom: -2,
          width: badge,
          height: badge,
          borderRadius: badge / 2,
          backgroundColor: colors.primary,
          borderWidth: 2,
          borderColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name="camera" size={badge * 0.55} color={colors.onPrimary} />
      </View>
    </Pressable>
  );
}
