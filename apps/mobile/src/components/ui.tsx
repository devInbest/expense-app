import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Image } from 'expo-image';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type PressableProps,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { radius, spacing, useTheme } from '@/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const Icon = ({ name, size = 22, color }: { name: string; size?: number; color?: string }) => {
  const { colors } = useTheme();
  const glyph = (name in MaterialCommunityIcons.glyphMap ? name : 'tag-outline') as IconName;
  return <MaterialCommunityIcons name={glyph} size={size} color={color ?? colors.text} />;
};

// ---------- layout ----------
export function Screen({
  children,
  scroll = true,
  edges = ['top'],
  padded = true,
  refreshControl,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  padded?: boolean;
  refreshControl?: ScrollViewProps['refreshControl'];
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const inner = [padded && { padding: spacing.lg }, { gap: spacing.lg }, contentStyle];
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: colors.background }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[padded && { padding: spacing.lg }, { gap: spacing.lg, paddingBottom: 120 }, contentStyle]}
          keyboardShouldPersistTaps="handled"
          refreshControl={refreshControl}>
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export const Row = ({ children, style, gap = spacing.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
);

export const Spacer = () => <View style={{ flex: 1 }} />;

// ---------- text ----------
type Variant = 'title' | 'heading' | 'subheading' | 'body' | 'caption' | 'label';
const variantStyle: Record<Variant, TextStyle> = {
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 20, fontWeight: '700' },
  subheading: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 15 },
  caption: { fontSize: 13 },
  label: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
};

export function AppText({
  variant = 'body',
  muted,
  color,
  style,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean; color?: string }) {
  const { colors } = useTheme();
  return (
    <Text style={[variantStyle[variant], { color: color ?? (muted ? colors.textMuted : colors.text) }, style]} {...rest} />
  );
}

export function ErrorText({ children }: { children?: string | null }) {
  const { colors } = useTheme();
  if (!children) return null;
  return (
    <AppText color={colors.danger} style={{ textAlign: 'center' }}>
      {children}
    </AppText>
  );
}

// ---------- containers ----------
export function Card({
  children,
  style,
  onPress,
  onLongPress,
  delayLongPress,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
}) {
  const { colors } = useTheme();
  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  };
  if (!onPress && !onLongPress) return <View style={[base, style]}>{children}</View>;
  return (
    <Pressable onPress={onPress} onLongPress={onLongPress} delayLongPress={delayLongPress} style={({ pressed }) => [base, pressed && { opacity: 0.7 }, style]}>
      {children}
    </Pressable>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Row>
        <AppText variant="label" muted>
          {title}
        </AppText>
        <Spacer />
        {action}
      </Row>
      {children}
    </View>
  );
}

// ---------- buttons ----------
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  compact,
}: {
  title: string;
  onPress?: PressableProps['onPress'];
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const bg: Record<ButtonVariant, string> = {
    primary: colors.primary,
    secondary: colors.primaryMuted,
    ghost: 'transparent',
    danger: colors.danger,
    warning: `${colors.warning}26`,
  };
  const fg: Record<ButtonVariant, string> = {
    primary: colors.onPrimary,
    secondary: colors.primary,
    ghost: colors.primary,
    danger: '#FFFFFF',
    warning: colors.warning,
  };
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        {
          backgroundColor: bg[variant],
          borderRadius: radius.md,
          paddingVertical: compact ? spacing.sm : 14,
          paddingHorizontal: compact ? spacing.md : spacing.lg,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
          opacity: inactive ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg[variant]} /> : icon ? <Icon name={icon} size={18} color={fg[variant]} /> : null}
      <Text style={{ color: fg[variant], fontWeight: '600', fontSize: compact ? 14 : 16 }}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  color,
  size = 22,
  label,
}: {
  icon: string;
  onPress: () => void;
  color?: string;
  size?: number;
  label: string;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      hitSlop={10}
      onPress={onPress}
      style={({ pressed }) => ({ padding: spacing.xs, opacity: pressed ? 0.5 : 1 })}>
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

/** `safeBottom` is for screens without a tab bar, where the button must clear the home indicator. */
export function Fab({ onPress, icon = 'plus', label, safeBottom }: { onPress: () => void; icon?: string; label: string; safeBottom?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute',
        right: spacing.lg,
        bottom: spacing.lg + (safeBottom ? insets.bottom : 0),
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        opacity: pressed ? 0.85 : 1,
      })}>
      <Icon name={icon} size={28} color={colors.onPrimary} />
    </Pressable>
  );
}

// ---------- inputs ----------
export function Field({
  label,
  error,
  hint,
  style,
  ...input
}: TextInputProps & { label?: string; error?: string | null; hint?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <AppText variant="caption" muted>
          {label}
        </AppText>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
            borderWidth: 1,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
            paddingVertical: 12,
            fontSize: 16,
            color: colors.text,
          },
          style,
        ]}
        {...input}
      />
      {error ? (
        <AppText variant="caption" color={colors.danger}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  compact,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surfaceAlt,
        borderRadius: compact ? radius.sm + 2 : radius.md,
        padding: compact ? 2 : 3,
      }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              paddingVertical: compact ? 4 : 8,
              paddingHorizontal: compact ? spacing.sm : undefined,
              borderRadius: radius.sm,
              alignItems: 'center',
              backgroundColor: active ? colors.surface : 'transparent',
            }}>
            <Text style={{ fontSize: compact ? 12 : undefined, fontWeight: active ? '700' : '500', color: active ? colors.text : colors.textMuted }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: string }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: spacing.md,
        paddingVertical: 6,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primaryMuted : colors.surface,
      }}>
      {icon ? <Icon name={icon} size={14} color={selected ? colors.primary : colors.textMuted} /> : null}
      <Text style={{ color: selected ? colors.primary : colors.text, fontWeight: selected ? '600' : '400' }}>{label}</Text>
    </Pressable>
  );
}

export function ToggleRow({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Row style={{ paddingVertical: spacing.xs }}>
      <View style={{ flex: 1 }}>
        <AppText>{label}</AppText>
        {description ? (
          <AppText variant="caption" muted>
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ true: colors.primary }} />
    </Row>
  );
}

// ---------- lists ----------
export function ListItem({
  title,
  subtitle,
  left,
  right,
  onPress,
  icon,
  iconColor,
  destructive,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  icon?: string;
  iconColor?: string;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.md,
        opacity: pressed ? 0.6 : 1,
      })}>
      {left ?? (icon ? <Icon name={icon} color={destructive ? colors.danger : iconColor ?? colors.textMuted} /> : null)}
      <View style={{ flex: 1 }}>
        <AppText color={destructive ? colors.danger : undefined} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" muted numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={20} color={colors.textMuted} /> : null)}
    </Pressable>
  );
}

export const Divider = () => {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }} />;
};

/** Profile photo, or the first letter of the name when there is no photo (or it fails to load). */
export function Avatar({ name, uri, size = 36, color }: { name: string; uri?: string | null; size?: number; color?: string }) {
  const { colors } = useTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const letter = name.trim().charAt(0).toUpperCase();
  const showPhoto = Boolean(uri) && failedUri !== uri;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        overflow: 'hidden',
        backgroundColor: color ?? colors.primaryMuted,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      {showPhoto ? (
        <Image
          source={{ uri: uri! }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          onError={() => setFailedUri(uri ?? null)}
          accessibilityLabel={`${name}'s photo`}
        />
      ) : (
        <Text style={{ color: colors.primary, fontWeight: '700', fontSize: size * 0.42 }}>{letter || '?'}</Text>
      )}
    </View>
  );
}

export function CategoryIcon({
  icon,
  color,
  size = 40,
  square,
}: {
  icon: string;
  color: string;
  size?: number;
  square?: boolean;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: square ? size * 0.3 : size / 2,
        backgroundColor: `${color}22`,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon name={icon} size={size * 0.5} color={color} />
    </View>
  );
}

// ---------- states ----------
export function EmptyState({ icon, title, message, action }: { icon: string; title: string; message?: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: spacing.xxl, gap: spacing.sm }}>
      <Icon name={icon} size={48} color={colors.textMuted} />
      <AppText variant="subheading">{title}</AppText>
      {message ? (
        <AppText muted style={{ textAlign: 'center' }}>
          {message}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xxl }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="cloud-off-outline"
      title="Couldn't load"
      message={message}
      action={onRetry ? <Button title="Try again" variant="secondary" compact onPress={onRetry} /> : undefined}
    />
  );
}

export function ProgressBar({ percent, color, height = 8 }: { percent: number; color?: string; height?: number }) {
  const { colors } = useTheme();
  const tone = color ?? (percent >= 100 ? colors.danger : percent >= 80 ? colors.warning : colors.success);
  return (
    <View style={{ height, backgroundColor: colors.surfaceAlt, borderRadius: height / 2, overflow: 'hidden' }}>
      <View style={{ width: `${Math.min(100, Math.max(0, percent))}%`, height: '100%', backgroundColor: tone }} />
    </View>
  );
}

/** Page-sheet modal with a title bar; content scrolls. */
export function Sheet({ visible, title, onClose, children }: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <Row style={{ padding: spacing.lg }}>
          <AppText variant="heading" style={{ flex: 1 }}>
            {title}
          </AppText>
          <IconButton icon="close" label="Close" onPress={onClose} />
        </Row>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.lg, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export function Banner({
  icon,
  text,
  tone = 'info',
  onPress,
}: {
  icon?: string;
  text: string;
  tone?: 'info' | 'success' | 'warning' | 'danger';
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const color = { info: colors.primary, success: colors.success, warning: colors.warning, danger: colors.danger }[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.md,
        backgroundColor: `${color}1A`,
      }}>
      {icon ? <Icon name={icon} size={18} color={color} /> : null}
      <AppText variant="caption" color={color} style={{ flex: 1, lineHeight: 18 }}>
        {text}
      </AppText>
      {onPress ? <Icon name="chevron-right" size={18} color={color} /> : null}
    </Pressable>
  );
}
