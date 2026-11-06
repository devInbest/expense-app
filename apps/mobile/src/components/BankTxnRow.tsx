import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector, usePanGesture, type PanGestureActiveEvent } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { BankTransactionDTO, BankTxnLinkKind } from '@expense/shared';
import { formatDay, formatTime } from '@/lib/dates';
import { spacing, useTheme } from '@/theme';
import { Money } from './finance';
import { AppText, CategoryIcon, Icon } from './ui';

export const LINK_LABEL: Record<BankTxnLinkKind, string> = {
  transaction: 'Saved as personal',
  room_expense: 'Added to a room',
  room_payment: 'Room payment',
};

export const bankTxnTitle = (t: BankTransactionDTO) => t.counterparty || (t.direction === 'debit' ? 'Money sent' : 'Money received');

export const bankTxnSource = (t: BankTransactionDTO) => [t.bank, t.accountMask ? `••${t.accountMask}` : null].filter(Boolean).join(' ');

type Corners = {
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomLeftRadius?: number;
  borderBottomRightRadius?: number;
};

export function BankTxnRow({ item, onPress }: { item: BankTransactionDTO; onPress?: () => void }) {
  const { colors } = useTheme();
  const debit = item.direction === 'debit';
  const account = [bankTxnSource(item), item.link ? LINK_LABEL[item.link.kind] : null].filter(Boolean).join(' · ');
  const when = `${formatDay(item.occurredAt)}, ${formatTime(item.occurredAt)}`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm + 2, opacity: pressed ? 0.6 : 1 })}>
      <CategoryIcon icon={debit ? 'arrow-top-right' : 'arrow-bottom-left'} color={debit ? colors.danger : colors.income} size={44} square />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText numberOfLines={1} style={{ fontWeight: '600' }}>
          {bankTxnTitle(item)}
        </AppText>
        {account ? (
          <AppText variant="caption" muted numberOfLines={1}>
            {account}
          </AppText>
        ) : null}
        <AppText variant="caption" muted numberOfLines={1}>
          {when}
        </AppText>
      </View>
      <Money amount={item.amount} currency={item.currency} type={debit ? 'expense' : 'income'} variant="body" />
    </Pressable>
  );
}

/** Swipe right → open the marking page. Swipe left → ignore (red). */
export function SwipeableBankTxnRow(props: {
  item: BankTransactionDTO;
  onPress?: () => void;
  onIgnore: () => void | Promise<void>;
  onMark: () => void;
  shellStyle?: StyleProp<ViewStyle>;
  corners?: Corners;
}) {
  const { colors } = useTheme();
  return (
    <SwipeableBankAction
      item={props.item}
      onPress={props.onPress}
      shellStyle={props.shellStyle}
      corners={props.corners}
      left={{
        color: colors.primary,
        icon: 'arrow-right',
        armedIcon: 'check',
        idleLabel: 'Swipe to mark',
        armedLabel: 'Opening',
        keep: true,
        onAction: props.onMark,
      }}
      right={{
        color: colors.danger,
        icon: 'eye-off-outline',
        idleLabel: 'Ignore',
        armedLabel: 'Ignored',
        onAction: props.onIgnore,
      }}
    />
  );
}

/** Swipe right → restore (green). Swipe left → delete permanently (red). */
export function SwipeableIgnoredBankTxnRow(props: {
  item: BankTransactionDTO;
  onPress?: () => void;
  onRestore: () => void | Promise<void>;
  onDelete: () => void | Promise<void>;
  shellStyle?: StyleProp<ViewStyle>;
  corners?: Corners;
}) {
  const { colors } = useTheme();
  return (
    <SwipeableBankAction
      item={props.item}
      onPress={props.onPress}
      shellStyle={props.shellStyle}
      corners={props.corners}
      left={{
        color: colors.success,
        icon: 'backup-restore',
        idleLabel: 'Restore',
        armedLabel: 'Restored',
        onAction: props.onRestore,
      }}
      right={{
        color: colors.danger,
        icon: 'delete-outline',
        idleLabel: 'Delete',
        armedLabel: 'Deleted',
        onAction: props.onDelete,
      }}
    />
  );
}

type SwipeAction = {
  color: string;
  icon: string;
  armedIcon?: string;
  idleLabel: string;
  armedLabel: string;
  /** Leave the row in the list and just run the action (used to open the marking page). */
  keep?: boolean;
  onAction: () => void | Promise<void>;
};

function SwipeableBankAction({
  item,
  onPress,
  shellStyle,
  corners,
  side,
  color,
  icon,
  idleLabel,
  armedLabel,
  onAction,
  left,
  right,
}: {
  item: BankTransactionDTO;
  onPress?: () => void;
  shellStyle?: StyleProp<ViewStyle>;
  corners?: Corners;
  side?: 'left' | 'right';
  color?: string;
  icon?: string;
  idleLabel?: string;
  armedLabel?: string;
  onAction?: () => void | Promise<void>;
  left?: SwipeAction;
  right?: SwipeAction;
}) {
  const { colors } = useTheme();
  const resolvedLeft = left ?? (side === 'left' && color && icon && idleLabel && armedLabel && onAction
    ? { color, icon, idleLabel, armedLabel, onAction }
    : undefined);
  const resolvedRight = right ?? (side === 'right' && color && icon && idleLabel && armedLabel && onAction
    ? { color, icon, idleLabel, armedLabel, onAction }
    : undefined);
  const drag = useSharedValue(0);
  const rowWidthSv = useSharedValue(0);
  const canLeft = useSharedValue(false);
  const canRight = useSharedValue(false);
  const moved = useSharedValue(false);
  const [rowWidth, setRowWidth] = useState(0);
  const committed = useRef(false);
  const pending = useRef<SwipeAction | null>(null);
  const measuredH = useRef(0);
  const ignorePress = useRef(false);
  const height = useSharedValue(-1);
  canLeft.set(!!resolvedLeft);
  canRight.set(!!resolvedRight);

  const commit = () => {
    void pending.current?.onAction();
  };

  const finishSideRef = useRef<(openLeft: boolean) => void>(() => {});
  finishSideRef.current = (openLeft: boolean) => {
    const action = openLeft ? resolvedLeft : resolvedRight;
    if (!action) {
      drag.set(withTiming(0, { duration: 180 }));
      return;
    }
    if (committed.current) return;
    if (action.keep) {
      drag.set(withTiming(0, { duration: 180 }));
      action.onAction();
      return;
    }
    committed.current = true;
    pending.current = action;
    const h = measuredH.current || 64;
    height.set(h);
    requestAnimationFrame(() => {
      height.set(
        withTiming(0, { duration: 200 }, (done) => {
          if (done) scheduleOnRN(commit);
        }),
      );
    });
  };

  const finishFromSide = useCallback((openLeft: boolean) => {
    finishSideRef.current(openLeft);
  }, []);
  const lockPress = useCallback(() => {
    ignorePress.current = true;
  }, []);
  const unlockPress = useCallback(() => {
    setTimeout(() => {
      ignorePress.current = false;
    }, 280);
  }, []);

  const pan = usePanGesture(
    useMemo(
      () => ({
        // A vertical drag fails this gesture so the list keeps scrolling. A swipe starts only after a press.
        activateAfterLongPress: 250,
        activeOffsetX: [-16, 16] as [number, number],
        failOffsetY: [-12, 12] as [number, number],
        onUpdate: (event: PanGestureActiveEvent) => {
          'worklet';
          let x = event.translationX;
          const width = rowWidthSv.get();
          if (!canLeft.get() && x > 0) x = 0;
          if (!canRight.get() && x < 0) x = 0;
          if (width > 0) x = Math.max(-width, Math.min(width, x));
          drag.set(x);
          if (!moved.get() && Math.abs(x) > 8) {
            moved.set(true);
            scheduleOnRN(lockPress);
          }
        },
        onDeactivate: (event: PanGestureActiveEvent) => {
          'worklet';
          const width = rowWidthSv.get();
          const flung = drag.get() + event.velocityX * 0.05;
          const openLeft = flung > 0;
          const allowed = openLeft ? canLeft.get() : canRight.get();
          if (width <= 0 || !allowed || Math.abs(flung) < width * 0.5) {
            drag.set(withTiming(0, { duration: 180 }));
            return;
          }
          drag.set(
            withTiming(openLeft ? width : -width, { duration: 160 }, (done) => {
              if (done) scheduleOnRN(finishFromSide, openLeft);
            }),
          );
        },
        onFinalize: () => {
          'worklet';
          moved.set(false);
          scheduleOnRN(unlockPress);
        },
      }),
      [canLeft, canRight, drag, finishFromSide, lockPress, moved, rowWidthSv, unlockPress],
    ),
  );

  const wrapStyle = useAnimatedStyle(() => {
    const h = height.get();
    if (h < 0) return { overflow: 'hidden' as const };
    return {
      height: h,
      overflow: 'hidden' as const,
      opacity: interpolate(h, [0, Math.max(measuredH.current, 1)], [0, 1]),
    };
  });

  const edgeStyle = useAnimatedStyle(() => {
    const offset = drag.get();
    const fromLeft = offset > 1;
    const fromRight = offset < -1;
    return {
      borderTopLeftRadius: fromLeft ? 0 : (corners?.borderTopLeftRadius ?? 0),
      borderBottomLeftRadius: fromLeft ? 0 : (corners?.borderBottomLeftRadius ?? 0),
      borderTopRightRadius: fromRight ? 0 : (corners?.borderTopRightRadius ?? 0),
      borderBottomRightRadius: fromRight ? 0 : (corners?.borderBottomRightRadius ?? 0),
    };
  });

  const rowShift = useAnimatedStyle(() => ({
    transform: [{ translateX: drag.get() }],
  }));

  const handlePress = () => {
    if (ignorePress.current || Math.abs(drag.get()) > 1) return;
    onPress?.();
  };

  const action = (side: 'left' | 'right', config: SwipeAction | undefined) =>
    config && rowWidth > 0 ? (
      <FullSwipeAction
        width={rowWidth}
        translation={drag}
        side={side}
        color={config.color}
        icon={config.icon}
        armedIcon={config.armedIcon}
        idleLabel={config.idleLabel}
        armedLabel={config.armedLabel}
        corners={corners}
      />
    ) : null;

  return (
    <Animated.View style={[{ overflow: 'hidden', backgroundColor: colors.surface }, corners, wrapStyle]}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {action('left', resolvedLeft)}
        {action('right', resolvedRight)}
      </View>
      <GestureDetector gesture={pan} touchAction="pan-y">
        <Animated.View
          style={[{ backgroundColor: colors.surface }, shellStyle, edgeStyle, rowShift]}
          onLayout={(e) => {
            const { width, height: h } = e.nativeEvent.layout;
            if (width > 0) rowWidthSv.set(width);
            if (width > 0 && width !== rowWidth) setRowWidth(width);
            measuredH.current = h;
          }}>
          <BankTxnRow item={item} onPress={handlePress} />
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

function FullSwipeAction({
  width,
  translation,
  side,
  color,
  icon,
  armedIcon,
  idleLabel,
  armedLabel,
  corners,
}: {
  width: number;
  translation: SharedValue<number>;
  side: 'left' | 'right';
  color: string;
  icon: string;
  armedIcon?: string;
  idleLabel: string;
  armedLabel: string;
  corners?: Corners;
}) {
  const [armed, setArmed] = useState(false);
  const halfway = width * 0.5;
  const fromLeft = side === 'left';

  const fillStyle = useAnimatedStyle(() => {
    const raw = translation.get();
    const revealed = Math.min(width, Math.max(0, fromLeft ? raw : -raw));
    return {
      width: revealed,
      borderTopLeftRadius: fromLeft ? (corners?.borderTopLeftRadius ?? 0) : 0,
      borderBottomLeftRadius: fromLeft ? (corners?.borderBottomLeftRadius ?? 0) : 0,
      borderTopRightRadius: fromLeft ? 0 : (corners?.borderTopRightRadius ?? 0),
      borderBottomRightRadius: fromLeft ? 0 : (corners?.borderBottomRightRadius ?? 0),
    };
  });

  const iconStyle = useAnimatedStyle(() => {
    const raw = translation.get();
    const revealed = Math.min(width, Math.max(0, fromLeft ? raw : -raw));
    const scale = interpolate(revealed, [0, width * 0.35, width * 0.5, width], [0.7, 1, 1.05, 1.1], Extrapolation.CLAMP);
    const opacity = interpolate(revealed, [0, width * 0.08, width], [0, 1, 1], Extrapolation.CLAMP);
    return { transform: [{ scale }], opacity };
  });

  useAnimatedReaction(
    () => {
      const raw = translation.get();
      return Math.min(width, Math.max(0, fromLeft ? raw : -raw));
    },
    (revealed, prev) => {
      const crossed = revealed >= halfway;
      const wasCrossed = prev != null && prev >= halfway;
      if (crossed !== wasCrossed || prev == null) {
        scheduleOnRN(setArmed, crossed);
      }
    },
  );

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        justifyContent: 'center',
        alignItems: fromLeft ? 'flex-start' : 'flex-end',
      }}>
      <Animated.View
        style={[
          {
            height: '100%',
            backgroundColor: color,
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden',
          },
          fillStyle,
        ]}>
        <Animated.View style={[{ minWidth: 148, alignItems: 'center', gap: 2, paddingHorizontal: 8 }, iconStyle]}>
          <Icon name={armed && armedIcon ? armedIcon : icon} size={24} color="#FFFFFF" />
          <AppText variant="caption" color="#FFFFFF" numberOfLines={1} style={{ minWidth: 132, fontWeight: '700', textAlign: 'center' }}>
            {armed ? armedLabel : idleLabel}
          </AppText>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
