import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
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
import { KeyboardAvoidingView, KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  makeMutable,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaFrame, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { radius, spacing, useTheme } from '@/theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export const SPRING = { damping: 16, stiffness: 220, mass: 0.6 } as const;
export const TAB_BAR_HEIGHT = 64;
/** Height of the fade above the tab bar strip. */
export const TAB_BAR_FADE = 14;
/** Gap between the tab bar pill and the bottom safe-area edge. */
export const TAB_BAR_BOTTOM_GAP = spacing.sm;
/** Gap between the floating action button and the top of the tab bar pill; the button never dips into the strip's fade. */
const FAB_GAP = 14;

/** Bottom space a tab screen must leave so content clears the tab bar strip. */
export const useTabBarInset = () => {
  const insets = useSafeAreaInsets();
  return TAB_BAR_FADE + TAB_BAR_HEIGHT + insets.bottom + TAB_BAR_BOTTOM_GAP;
};

export const linearGradient = (from: string, to: string, angle = 135) => `linear-gradient(${angle}deg, ${from}, ${to})`;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Spring scale-down while pressed. */
export function usePressScale(to = 0.97) {
  const scale = useSharedValue(1);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return {
    style,
    onPressIn: () => scale.set(withSpring(to, SPRING)),
    onPressOut: () => scale.set(withSpring(1, SPRING)),
  };
}

export const Icon = ({ name, size = 22, color }: { name: string; size?: number; color?: string }) => {
  const { colors } = useTheme();
  const glyph = (name in MaterialCommunityIcons.glyphMap ? name : 'tag-outline') as IconName;
  return <MaterialCommunityIcons name={glyph} size={size} color={color ?? colors.text} />;
};

// ---------- motion ----------
/** Fades and slides children in on mount; `index` staggers siblings. */
export function Appear({ children, index = 0, style }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <Animated.View entering={FadeInDown.duration(420).delay(Math.min(index, 10) * 60).springify().damping(18)} style={style}>
      {children}
    </Animated.View>
  );
}

// ---------- backdrop & glass ----------
/** One clock for every backdrop, so overlapping copies (screen + tab bar strip) stay in sync. */
const glowClock = makeMutable(0);
let glowClockStarted = false;

function Glow({ color, size, style, drift }: { color: string; size: number; style: ViewStyle; drift: number }) {
  const t = glowClock;
  useEffect(() => {
    if (glowClockStarted) return;
    glowClockStarted = true;
    t.set(withRepeat(withTiming(1, { duration: 10000, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [t]);
  const animated = useAnimatedStyle(() => ({
    transform: [{ translateX: (t.get() - 0.5) * 40 * drift }, { translateY: (0.5 - t.get()) * 30 }, { scale: 1 + t.get() * 0.08 }],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: size,
          height: size,
          experimental_backgroundImage: `radial-gradient(circle at center, ${color} 0%, rgba(255,79,15,0) 70%)`,
        },
        style,
        animated,
      ]}
    />
  );
}

/** Screen background: base color with slowly drifting orange glows for the glass to sit on. */
export function Backdrop() {
  const { colors } = useTheme();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, overflow: 'hidden' }]}>
      <Glow color={colors.glow} size={460} style={{ top: -200, right: -170 }} drift={1} />
      <Glow color={colors.glowSoft} size={420} style={{ top: 280, left: -220 }} drift={-1.4} />
      <Glow color={colors.glowSoft} size={380} style={{ bottom: -180, right: -140 }} drift={0.8} />
    </View>
  );
}

const FADE_STEPS = 8;

/**
 * The part of a full-screen backdrop that falls inside this bottom-anchored box, so overlays blend with the screen.
 * RN has no mask support, so the top `fade` px are drawn as thin bands of rising opacity.
 */
export function BackdropSlice({ fade = 0, screenHeight }: { fade?: number; /** Height of the backdrop being matched; defaults to the full window. */ screenHeight?: number }) {
  const safeFrame = useSafeAreaFrame();
  const frame = { height: screenHeight ?? safeFrame.height };
  const [height, setHeight] = useState(0);
  const band = fade / FADE_STEPS;
  const layer = (top: number, h: number, opacity: number, key: string) => (
    <View key={key} style={{ position: 'absolute', left: 0, right: 0, top, height: h, overflow: 'hidden', opacity }}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: height - frame.height - top, height: frame.height }}>
        <Backdrop />
      </View>
    </View>
  );
  return (
    <View pointerEvents="none" onLayout={(e) => setHeight(e.nativeEvent.layout.height)} style={StyleSheet.absoluteFill}>
      {height > 0 ? (
        <>
          {Array.from({ length: fade > 0 ? FADE_STEPS : 0 }, (_, i) => {
            const t = (i + 1) / (FADE_STEPS + 1);
            return layer(i * band, band + 0.5, t * t * (3 - 2 * t), `fade-${i}`);
          })}
          {layer(fade, height - fade, 1, 'solid')}
        </>
      ) : null}
    </View>
  );
}

/**
 * Frosted panel. iOS blurs whatever is behind it; Android can only blur a registered target view,
 * so there `blur` falls back to a denser translucent fill.
 */
export function Glass({
  children,
  style,
  blur,
  strong,
  rounded = radius.lg,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  blur?: boolean;
  strong?: boolean;
  rounded?: number;
}) {
  const { colors, dark } = useTheme();
  const realBlur = blur && Platform.OS === 'ios';
  return (
    <View
      style={[
        {
          borderRadius: rounded,
          backgroundColor: realBlur ? colors.glass : strong || blur ? colors.glassStrong : colors.glass,
          borderWidth: 1,
          borderColor: colors.glassBorder,
          boxShadow: `0 10px 30px ${colors.shadow}`,
        },
        style,
      ]}>
      {realBlur ? (
        <BlurView
          intensity={dark ? 40 : 60}
          tint={dark ? 'systemThinMaterialDark' : 'systemThinMaterialLight'}
          style={[StyleSheet.absoluteFill, { borderRadius: rounded, overflow: 'hidden' }]}
        />
      ) : null}
      <View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: rounded, experimental_backgroundImage: `linear-gradient(180deg, ${colors.glassHighlight} 0%, rgba(255,255,255,0) 55%)` },
        ]}
      />
      {children}
    </View>
  );
}

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
  const inner = [padded && { padding: spacing.lg }, { gap: spacing.lg }, contentStyle];
  return (
    <View style={{ flex: 1 }}>
      <Backdrop />
      <SafeAreaView edges={edges} style={{ flex: 1 }}>
        {scroll ? (
          <KeyboardAwareScrollView
            bottomOffset={spacing.xl}
            contentContainerStyle={[padded && { padding: spacing.lg }, { gap: spacing.lg, paddingBottom: 120 }, contentStyle]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            refreshControl={refreshControl}>
            {children}
          </KeyboardAwareScrollView>
        ) : (
          <KeyboardAvoidingView behavior="padding" automaticOffset style={[{ flex: 1 }, inner]}>
            {children}
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </View>
  );
}

/** Frosted action bar pinned to the bottom of a stack screen. */
export function BottomBar({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardStickyView offset={{ opened: insets.bottom }}>
      <SafeAreaView
        edges={['bottom']}
        style={[
          {
            paddingHorizontal: spacing.lg,
            paddingTop: spacing.md,
            paddingBottom: spacing.sm,
            gap: spacing.sm,
            backgroundColor: colors.glassStrong,
            borderTopWidth: 1,
            borderColor: colors.glassBorder,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            boxShadow: `0 -8px 24px ${colors.shadow}`,
          },
          style,
        ]}>
        {children}
      </SafeAreaView>
    </KeyboardStickyView>
  );
}

export const Row = ({ children, style, gap = spacing.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>
);

export const Spacer = () => <View style={{ flex: 1 }} />;

// ---------- text ----------
type Variant = 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'caption' | 'label';
const variantStyle: Record<Variant, TextStyle> = {
  display: { fontSize: 38, fontWeight: '800', letterSpacing: -1 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -0.6 },
  heading: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  subheading: { fontSize: 16, fontWeight: '600', letterSpacing: -0.1 },
  body: { fontSize: 15 },
  caption: { fontSize: 13 },
  label: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
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
  blur,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  delayLongPress?: number;
  blur?: boolean;
}) {
  const press = usePressScale(0.98);
  const base: ViewStyle = { padding: spacing.lg, gap: spacing.sm };
  if (!onPress && !onLongPress) {
    return (
      <Glass blur={blur} style={[base, style]}>
        {children}
      </Glass>
    );
  }
  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={press.style}>
      <Glass blur={blur} style={[base, style]}>
        {children}
      </Glass>
    </AnimatedPressable>
  );
}

export function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Row style={{ paddingHorizontal: spacing.xs, minHeight: 28 }}>
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

/** Icon + title header with an optional pill link, shown above a card. */
export function SectionHeader({ icon, title, actionLabel, onAction }: { icon: string; title: string; actionLabel?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <Row gap={spacing.sm}>
      <CategoryIcon icon={icon} color={colors.primary} size={32} square />
      <AppText variant="subheading" style={{ flex: 1 }}>
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          accessibilityRole="button"
          style={{ backgroundColor: colors.primaryMuted, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 5 }}>
          <Row gap={2}>
            <AppText variant="caption" color={colors.primary} style={{ fontWeight: '700' }}>
              {actionLabel}
            </AppText>
            <Icon name="chevron-right" size={16} color={colors.primary} />
          </Row>
        </Pressable>
      ) : null}
    </Row>
  );
}

// ---------- buttons ----------
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning' | 'glass';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  compact,
  color,
}: {
  title: string;
  onPress?: PressableProps['onPress'];
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
  /** Overrides the variant's text and icon color. */
  color?: string;
}) {
  const { colors, dark } = useTheme();
  const press = usePressScale(0.96);
  const bg: Record<ButtonVariant, string> = {
    primary: colors.primary,
    secondary: colors.primaryMuted,
    ghost: 'transparent',
    danger: `${colors.danger}1A`,
    warning: `${colors.warning}26`,
    glass: dark ? 'rgba(255,255,255,0.07)' : 'rgba(120,120,128,0.14)',
  };
  const fg: Record<ButtonVariant, string> = {
    primary: colors.onPrimary,
    secondary: colors.primary,
    ghost: colors.primary,
    danger: colors.danger,
    warning: colors.warning,
    glass: colors.text,
  };
  const tint = color ?? fg[variant];
  const inactive = disabled || loading;
  const primary = variant === 'primary';
  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={inactive}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        {
          backgroundColor: bg[variant],
          borderRadius: radius.pill,
          minHeight: compact ? 36 : 54,
          paddingHorizontal: compact ? spacing.md : spacing.xl,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: spacing.sm,
          opacity: inactive ? 0.5 : 1,
        },
        primary && {
          experimental_backgroundImage: linearGradient('#FF6A2E', colors.primaryDeep),
          boxShadow: inactive ? undefined : `0 8px 22px ${colors.primaryGlow}`,
        },
        variant === 'glass' && {
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.7)',
          boxShadow: dark
            ? 'inset 0 1px 0 rgba(255,255,255,0.18), 0 8px 24px rgba(0,0,0,0.45)'
            : 'inset 0 1px 1px rgba(255,255,255,0.9), inset 0 -2px 6px rgba(0,0,0,0.05), 0 6px 18px rgba(17,17,17,0.06)',
        },
        press.style,
        style,
      ]}>
      {variant === 'glass' ? (
        <>
          {Platform.OS === 'ios' ? (
            <BlurView intensity={dark ? 30 : 40} tint={dark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'} style={StyleSheet.absoluteFill} />
          ) : null}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                experimental_backgroundImage: dark
                  ? 'linear-gradient(180deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.02) 50%, rgba(255,255,255,0.06) 100%)'
                  : 'linear-gradient(180deg, rgba(255,255,255,0.45) 0%, rgba(255,255,255,0) 50%, rgba(255,255,255,0.15) 100%)',
              },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              {
                experimental_backgroundImage: `radial-gradient(ellipse at 30% 0%, ${dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.5)'} 0%, rgba(255,255,255,0) 60%)`,
              },
            ]}
          />
        </>
      ) : null}
      {loading ? <ActivityIndicator color={tint} /> : icon ? <Icon name={icon} size={compact ? 16 : 20} color={tint} /> : null}
      <Text style={{ color: tint, fontWeight: '700', fontSize: compact ? 14 : 16, letterSpacing: 0.1 }}>{title}</Text>
    </AnimatedPressable>
  );
}

export function IconButton({
  icon,
  onPress,
  color,
  size = 22,
  label,
  glass,
}: {
  icon: string;
  onPress: () => void;
  color?: string;
  size?: number;
  label: string;
  /** Renders as a round frosted button. */
  glass?: boolean;
}) {
  const { colors } = useTheme();
  const press = usePressScale(0.88);
  return (
    <AnimatedPressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={10}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={[
        glass
          ? {
              width: 42,
              height: 42,
              borderRadius: 21,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.glass,
              borderWidth: 1,
              borderColor: colors.glassBorder,
              boxShadow: `0 4px 14px ${colors.shadow}`,
            }
          : { padding: spacing.xs },
        press.style,
      ]}>
      <Icon name={icon} size={glass ? Math.min(size, 20) : size} color={color} />
    </AnimatedPressable>
  );
}

/** `safeBottom` is for screens without a tab bar, where the button must clear the home indicator. */
export function Fab({ onPress, icon = 'plus', label, safeBottom }: { onPress: () => void; icon?: string; label: string; safeBottom?: boolean }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tabInset = useTabBarInset();
  const press = usePressScale(0.9);
  return (
    <Animated.View
      entering={FadeIn.delay(200).duration(300)}
      style={{ position: 'absolute', right: spacing.lg, bottom: safeBottom ? spacing.lg + insets.bottom : tabInset + Math.max(0, FAB_GAP - TAB_BAR_FADE) }}>
      <AnimatedPressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        style={[
          {
            width: 60,
            height: 60,
            borderRadius: 30,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.primary,
            experimental_backgroundImage: linearGradient('#FF6A2E', colors.primaryDeep),
            boxShadow: `0 10px 26px ${colors.primaryGlow}`,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.35)',
          },
          press.style,
        ]}>
        <Icon name={icon} size={30} color={colors.onPrimary} />
      </AnimatedPressable>
    </Animated.View>
  );
}

// ---------- inputs ----------
/** Box style shared by text inputs and tap-to-pick fields. */
export const useFieldBoxStyle = (): ViewStyle => {
  const { colors } = useTheme();
  return {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.glass,
    borderWidth: 1.5,
    borderColor: colors.glassBorder,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    boxShadow: `0 4px 14px ${colors.shadow}`,
  };
};

export function Field({
  label,
  error,
  hint,
  style,
  onFocus,
  onBlur,
  ...input
}: TextInputProps & { label?: string; error?: string | null; hint?: string }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? (
        <AppText variant="caption" muted style={{ fontWeight: '600', paddingHorizontal: spacing.xs }}>
          {label}
        </AppText>
      ) : null}
      <TextInput
        placeholderTextColor={colors.textSubtle}
        selectionColor={colors.primary}
        cursorColor={colors.primary}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          {
            backgroundColor: focused ? colors.glassStrong : colors.glass,
            borderColor: error ? colors.danger : focused ? colors.primary : colors.glassBorder,
            borderWidth: 1.5,
            borderRadius: radius.md,
            paddingHorizontal: spacing.lg,
            paddingVertical: 14,
            fontSize: 16,
            color: colors.text,
            boxShadow: focused ? `0 0 0 4px ${colors.primaryMuted}` : `0 4px 14px ${colors.shadow}`,
          },
          style,
        ]}
        {...input}
      />
      {error ? (
        <AppText variant="caption" color={colors.danger} style={{ paddingHorizontal: spacing.xs }}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption" muted style={{ paddingHorizontal: spacing.xs }}>
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
  glass,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  compact?: boolean;
  /** Frosted track with a liquid-glass indicator instead of a solid one. */
  glass?: boolean;
}) {
  const { colors, dark } = useTheme();
  const [width, setWidth] = useState(0);
  const pad = compact ? 3 : 4;
  const segment = width > 0 ? (width - pad * 2) / options.length : 0;
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const x = useSharedValue(0);
  useEffect(() => {
    x.set(withSpring(index * segment, SPRING));
  }, [index, segment, x]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[
        {
          flexDirection: 'row',
          backgroundColor: colors.glass,
          borderWidth: 1,
          borderColor: colors.glassBorder,
          borderRadius: radius.pill,
          padding: pad,
        },
        glass && {
          backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(120,120,128,0.12)',
          borderColor: dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.6)',
          boxShadow: dark ? 'inset 0 1px 3px rgba(0,0,0,0.4)' : 'inset 0 1px 3px rgba(0,0,0,0.06)',
        },
      ]}>
      {segment > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: pad,
              bottom: pad,
              left: pad,
              width: segment,
              borderRadius: radius.pill,
              backgroundColor: dark ? 'rgba(255,255,255,0.14)' : '#FFFFFF',
              boxShadow: `0 3px 10px ${colors.shadow}`,
            },
            glass && {
              overflow: 'hidden',
              backgroundColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.55)',
              borderWidth: 1,
              borderColor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.9)',
              boxShadow: dark
                ? 'inset 0 1px 0 rgba(255,255,255,0.2), 0 4px 12px rgba(0,0,0,0.4)'
                : 'inset 0 1px 1px rgba(255,255,255,0.95), inset 0 -2px 5px rgba(0,0,0,0.04), 0 4px 12px rgba(17,17,17,0.08)',
              experimental_backgroundImage: dark
                ? 'linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0.02) 55%, rgba(255,255,255,0.06) 100%)'
                : 'linear-gradient(180deg, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.15) 55%, rgba(255,255,255,0.35) 100%)',
            },
            indicator,
          ]}
        />
      ) : null}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={{ flex: 1, paddingVertical: compact ? 6 : 10, paddingHorizontal: compact ? spacing.sm : undefined, alignItems: 'center' }}>
            <Text style={{ fontSize: compact ? 12 : 14, fontWeight: active ? '700' : '600', color: active ? colors.primary : colors.textMuted }}>
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
  const press = usePressScale(0.94);
  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: spacing.md + 2,
          paddingVertical: 8,
          borderRadius: radius.pill,
          borderWidth: 1,
          borderColor: selected ? 'rgba(255,255,255,0.3)' : colors.glassBorder,
          backgroundColor: selected ? colors.primary : colors.glass,
        },
        selected && {
          experimental_backgroundImage: linearGradient('#FF6A2E', colors.primaryDeep),
          boxShadow: `0 6px 16px ${colors.primaryGlow}`,
        },
        press.style,
      ]}>
      {icon ? <Icon name={icon} size={14} color={selected ? colors.onPrimary : colors.textMuted} /> : null}
      <Text style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: selected ? '700' : '500', fontSize: 14 }}>{label}</Text>
    </AnimatedPressable>
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
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: colors.surfaceAlt }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={colors.surfaceAlt}
      />
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
  const tint = destructive ? colors.danger : (iconColor ?? colors.primary);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingVertical: spacing.sm + 2,
        opacity: pressed ? 0.6 : 1,
      })}>
      {left ??
        (icon ? (
          <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: `${tint}1F`, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={19} color={tint} />
          </View>
        ) : null)}
      <View style={{ flex: 1 }}>
        <AppText color={destructive ? colors.danger : undefined} numberOfLines={1} style={{ fontWeight: '500' }}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" muted numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={20} color={colors.textSubtle} /> : null)}
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
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: 'hidden',
          backgroundColor: color ?? colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: size >= 40 ? 2 : 0,
          borderColor: colors.glassBorder,
        },
        !color && !showPhoto && { experimental_backgroundImage: linearGradient('#FF8A50', colors.primaryDeep) },
      ]}>
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
        <Text style={{ color: color ? colors.primary : colors.onPrimary, fontWeight: '800', fontSize: size * 0.42 }}>{letter || '?'}</Text>
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
        borderRadius: square ? size * 0.32 : size / 2,
        backgroundColor: `${color}1F`,
        borderWidth: 1,
        borderColor: `${color}26`,
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
  const float = useSharedValue(0);
  useEffect(() => {
    float.set(withRepeat(withSequence(withTiming(-6, { duration: 1600 }), withTiming(0, { duration: 1600 })), -1));
  }, [float]);
  const floating = useAnimatedStyle(() => ({ transform: [{ translateY: float.get() }] }));
  return (
    <Animated.View entering={FadeIn.duration(400)} style={{ alignItems: 'center', padding: spacing.xxl, gap: spacing.sm }}>
      <Animated.View style={floating}>
        <Glass rounded={36} style={{ width: 84, height: 84, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm }}>
          <Icon name={icon} size={38} color={colors.primary} />
        </Glass>
      </Animated.View>
      <AppText variant="subheading">{title}</AppText>
      {message ? (
        <AppText muted style={{ textAlign: 'center' }}>
          {message}
        </AppText>
      ) : null}
      {action}
    </Animated.View>
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
  const tone = color ?? (percent >= 100 ? colors.danger : percent >= 80 ? colors.warning : colors.primary);
  const target = Math.min(100, Math.max(0, percent));
  const width = useSharedValue(0);
  useEffect(() => {
    width.set(withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [target, width]);
  const fill = useAnimatedStyle(() => ({ width: `${width.get()}%` }));
  return (
    <View style={{ height, backgroundColor: colors.surfaceAlt, borderRadius: height / 2, overflow: 'hidden' }}>
      <Animated.View
        style={[
          { height: '100%', borderRadius: height / 2, backgroundColor: tone, experimental_backgroundImage: `linear-gradient(90deg, ${tone}B3, ${tone})` },
          fill,
        ]}
      />
    </View>
  );
}

/** Page-sheet modal with a title bar; content scrolls. */
export function Sheet({
  visible,
  title,
  icon,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  icon?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1 }}>
        <Backdrop />
        <SafeAreaView style={{ flex: 1 }}>
          <SheetHeader title={title} icon={icon} onClose={onClose} />
          <KeyboardAwareScrollView
            bottomOffset={spacing.xl}
            contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, paddingTop: 0, gap: spacing.lg }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {children}
          </KeyboardAwareScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

export function SheetHeader({ title, icon, onClose }: { title: string; icon?: string; onClose: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.lg, gap: spacing.md }}>
      <View style={{ alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.textSubtle, opacity: 0.5 }} />
      <Row style={{ gap: spacing.sm }}>
        {icon ? <Icon name={icon} size={22} color={colors.primary} /> : null}
        <AppText variant="heading" style={{ flex: 1 }}>
          {title}
        </AppText>
        <IconButton icon="close" label="Close" glass onPress={onClose} />
      </Row>
    </View>
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
    <Animated.View entering={FadeInDown.duration(350)}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: radius.md,
          backgroundColor: `${color}14`,
          borderWidth: 1,
          borderColor: `${color}33`,
          opacity: pressed ? 0.7 : 1,
        })}>
        {icon ? (
          <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: `${color}22`, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={16} color={color} />
          </View>
        ) : null}
        <AppText variant="caption" color={color} style={{ flex: 1, lineHeight: 18, fontWeight: '600' }}>
          {text}
        </AppText>
        {onPress ? <Icon name="chevron-right" size={18} color={color} /> : null}
      </Pressable>
    </Animated.View>
  );
}
