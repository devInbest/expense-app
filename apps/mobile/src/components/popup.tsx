import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, useTheme } from '@/theme';
import { AppText, FrostedSurface, Icon, OverlayScrim, SheetFrame, linearGradient, useOverlayMotion, usePressScale } from './ui';

export type PopupTone = 'neutral' | 'primary' | 'danger' | 'success' | 'warning';

export type PopupAction = {
  label: string;
  icon?: string;
  role?: 'cancel' | 'destructive' | 'primary' | 'warning' | 'default';
  onPress?: () => void | Promise<void>;
};

type Variant = 'dialog' | 'menu' | 'toast';

type Entry = {
  id: number;
  variant: Variant;
  title: string;
  message?: string;
  icon: string;
  tone: PopupTone;
  actions: PopupAction[];
};

const TONE_ICON: Record<PopupTone, string> = {
  neutral: 'information-outline',
  primary: 'help-circle-outline',
  danger: 'close-circle-outline',
  success: 'check-circle-outline',
  warning: 'alert-outline',
};

const queue: Entry[] = [];
const listeners = new Set<() => void>();
let seq = 0;

function enqueue(partial: Omit<Entry, 'id'>) {
  queue.push({ ...partial, id: ++seq });
  listeners.forEach((listener) => listener());
}

type ConfirmOptions = {
  title: string;
  message?: string;
  icon?: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  tone?: PopupTone;
  onConfirm: () => void | Promise<void>;
};

/** Themed replacements for system alerts, action sheets, and brief success notices. */
export const popup = {
  alert(title: string, message?: string, tone: PopupTone = 'neutral') {
    enqueue({
      variant: 'dialog',
      title,
      message,
      tone,
      icon: TONE_ICON[tone],
      actions: [{ label: 'OK', role: 'primary' }],
    });
  },
  error(title: string, message?: string) {
    enqueue({
      variant: 'dialog',
      title,
      message,
      tone: 'danger',
      icon: 'close-circle-outline',
      actions: [{ label: 'OK', role: 'primary' }],
    });
  },
  success(title: string, message?: string) {
    enqueue({
      variant: 'toast',
      title,
      message,
      tone: 'success',
      icon: 'check',
      actions: [],
    });
  },
  confirm(opts: ConfirmOptions) {
    const tone: PopupTone = opts.tone ?? (opts.destructive ? 'danger' : 'primary');
    const role: PopupAction['role'] = opts.destructive ? 'destructive' : tone === 'warning' ? 'warning' : 'primary';
    enqueue({
      variant: 'dialog',
      title: opts.title,
      message: opts.message,
      tone,
      icon: opts.icon ?? (opts.destructive ? 'alert-circle-outline' : TONE_ICON[tone]),
      actions: [
        { label: opts.cancelLabel ?? 'Cancel', role: 'cancel' },
        { label: opts.confirmLabel, role, onPress: opts.onConfirm },
      ],
    });
  },
  menu(opts: { title: string; message?: string; actions: PopupAction[] }) {
    const actions = opts.actions.some((a) => a.role === 'cancel')
      ? opts.actions
      : [...opts.actions, { label: 'Cancel', role: 'cancel' as const }];
    enqueue({ variant: 'menu', title: opts.title, message: opts.message, tone: 'neutral', icon: 'menu', actions });
  },
};

/** Capitalizes each word in a popup heading, leaving apostrophes alone. */
function capitalizeHeading(value: string) {
  return value.replace(/(^|\s)([a-z])/g, (_, gap: string, letter: string) => gap + letter.toUpperCase());
}

function toneColor(tone: PopupTone, colors: { danger: string; success: string; warning: string; primary: string }) {
  if (tone === 'danger') return colors.danger;
  if (tone === 'success') return colors.success;
  if (tone === 'warning') return colors.warning;
  return colors.primary;
}

export function PopupHost() {
  const [current, setCurrent] = useState<Entry | null>(null);
  const [open, setOpen] = useState(false);
  const currentRef = useRef<Entry | null>(null);

  const take = useCallback(() => {
    if (currentRef.current) return;
    const next = queue.shift();
    if (!next) return;
    currentRef.current = next;
    setCurrent(next);
    setOpen(true);
  }, []);

  const finish = useCallback(() => {
    currentRef.current = null;
    const next = queue.shift() ?? null;
    currentRef.current = next;
    setCurrent(next);
    setOpen(!!next);
  }, []);

  const requestClose = useCallback(() => setOpen(false), []);

  useEffect(() => {
    listeners.add(take);
    // A popup can be requested before this host is mounted, or React may remount it in development.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drain the imperative queue when the host starts listening
    take();
    return () => {
      listeners.delete(take);
      if (currentRef.current) {
        queue.unshift(currentRef.current);
        currentRef.current = null;
      }
    };
  }, [take]);

  useEffect(() => {
    if (!current) return;
    const play =
      current.variant === 'toast' || current.tone === 'success'
        ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
        : current.tone === 'danger'
          ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
          : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    void play.catch(() => {});
  }, [current]);

  if (!current) return null;
  if (current.variant === 'toast') return <ToastCard key={current.id} item={current} visible={open} onClose={requestClose} onHidden={finish} />;
  if (current.variant === 'menu') return <MenuSheet key={current.id} item={current} visible={open} onClose={requestClose} onHidden={finish} />;
  return <DialogCard key={current.id} item={current} visible={open} onClose={requestClose} onHidden={finish} />;
}

function runAction(action: PopupAction, close: () => void) {
  close();
  if (action.role === 'cancel' || !action.onPress) return;
  const press = action.onPress;
  setTimeout(() => void press(), 0);
}

function DialogCard({ item, visible, onClose, onHidden }: { item: Entry; visible: boolean; onClose: () => void; onHidden: () => void }) {
  const { colors } = useTheme();
  const { mounted, scrimStyle, cardStyle } = useOverlayMotion(visible, onHidden);
  const accent = toneColor(item.tone, colors);
  return (
    <Modal visible={mounted} transparent statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View style={{ flex: 1 }} accessibilityRole="alert">
        <OverlayScrim style={scrimStyle} onPress={onClose} />
        <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'center', paddingHorizontal: spacing.xl }}>
          <Animated.View pointerEvents="box-none" style={cardStyle}>
            <View pointerEvents="box-none" style={{ width: '100%', maxWidth: 380, alignSelf: 'center' }}>
              <FrostedSurface style={{ paddingTop: spacing.xl, paddingHorizontal: spacing.xl, paddingBottom: spacing.lg }}>
                <View style={{ alignItems: 'center' }}>
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: `${accent}1F`,
                      borderWidth: 1,
                      borderColor: `${accent}40`,
                    }}>
                    <Icon name={item.icon} size={30} color={accent} />
                  </View>
                  <AppText variant="heading" style={{ textAlign: 'center', marginTop: spacing.md }}>
                    {capitalizeHeading(item.title)}
                  </AppText>
                  {item.message ? (
                    <AppText muted style={{ textAlign: 'center', lineHeight: 22, marginTop: spacing.sm }}>
                      {item.message}
                    </AppText>
                  ) : null}
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xl }}>
                  {item.actions.map((action) => (
                    <PopupButton key={action.label} fill action={action} onPress={() => runAction(action, onClose)} />
                  ))}
                </View>
              </FrostedSurface>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}

function MenuSheet({ item, visible, onClose, onHidden }: { item: Entry; visible: boolean; onClose: () => void; onHidden: () => void }) {
  const { colors } = useTheme();
  const choices = item.actions.filter((a) => a.role !== 'cancel');
  const cancel = item.actions.find((a) => a.role === 'cancel');
  return (
    <SheetFrame visible={visible} onClose={onClose} onHidden={onHidden} dismissOnScrim>
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, gap: spacing.md }}>
        <View style={{ alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.textSubtle, opacity: 0.45 }} />
        <View style={{ gap: spacing.xs }}>
          <AppText variant="heading">{capitalizeHeading(item.title)}</AppText>
          {item.message ? <AppText muted>{item.message}</AppText> : null}
        </View>
        <View style={{ borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border }}>
          {choices.map((action, index) => (
            <View key={action.label}>
              {index ? <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 68 }} /> : null}
              <MenuRow action={action} onPress={() => runAction(action, onClose)} />
            </View>
          ))}
        </View>
        {cancel ? <PopupButton action={cancel} onPress={onClose} /> : null}
      </View>
    </SheetFrame>
  );
}

function MenuRow({ action, onPress }: { action: PopupAction; onPress: () => void }) {
  const { colors } = useTheme();
  const press = usePressScale(0.98);
  const danger = action.role === 'destructive';
  const tint = danger ? colors.danger : colors.text;
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14, paddingHorizontal: spacing.md }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 14,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: danger ? `${colors.danger}1A` : colors.primaryMuted,
          }}>
          <Icon name={action.icon ?? 'chevron-right'} size={20} color={danger ? colors.danger : colors.primary} />
        </View>
        <AppText style={{ flex: 1, fontWeight: '600' }} color={tint}>
          {action.label}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

function PopupButton({ action, onPress, fill }: { action: PopupAction; onPress: () => void; fill?: boolean }) {
  const { colors, dark } = useTheme();
  const press = usePressScale(0.97);
  const role = action.role ?? 'default';
  const primary = role === 'primary';
  const fg =
    role === 'destructive' ? colors.onPrimary : role === 'warning' ? '#1A1A1A' : primary ? colors.onPrimary : colors.text;
  const bg =
    role === 'destructive' ? colors.danger : role === 'warning' ? colors.warning : primary ? colors.primary : dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)';
  return (
    <Animated.View style={[fill ? { flex: 1 } : undefined, press.style]}>
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={{
          minHeight: 50,
          borderRadius: radius.pill,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.md,
          backgroundColor: bg,
          ...(primary
            ? { experimental_backgroundImage: linearGradient('#FF6A2E', colors.primaryDeep), boxShadow: `0 8px 22px ${colors.primaryGlow}` }
            : {}),
          ...(role === 'destructive' ? { boxShadow: '0 8px 20px rgba(229,56,59,0.35)' } : {}),
        }}>
        <Text style={{ color: fg, fontWeight: '700', fontSize: 16 }} numberOfLines={1}>
          {action.label}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

function ToastCard({ item, visible, onClose, onHidden }: { item: Entry; visible: boolean; onClose: () => void; onHidden: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { mounted, toastStyle } = useOverlayMotion(visible, onHidden);
  const accent = toneColor(item.tone, colors);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onClose, 2600);
    return () => clearTimeout(t);
  }, [visible, onClose, item.id]);

  if (!mounted) return null;
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 40 }]}>
      <Animated.View style={[{ position: 'absolute', top: insets.top + spacing.sm, left: spacing.lg, right: spacing.lg }, toastStyle]}>
        <Pressable accessibilityRole="alert" onPress={onClose}>
          <FrostedSurface rounded={radius.lg} style={{ paddingVertical: spacing.md, paddingHorizontal: spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: `${accent}1F`,
                }}>
                <Icon name={item.icon} size={18} color={accent} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText style={{ fontWeight: '700' }}>{capitalizeHeading(item.title)}</AppText>
                {item.message ? (
                  <AppText variant="caption" muted>
                    {item.message}
                  </AppText>
                ) : null}
              </View>
            </View>
          </FrostedSurface>
        </Pressable>
      </Animated.View>
    </View>
  );
}
