import { useRef, useState } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import ReanimatedSwipeable, { SwipeDirection, type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
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
  const meta = [
    item.link ? LINK_LABEL[item.link.kind] : bankTxnSource(item),
    `${formatDay(item.occurredAt)}, ${formatTime(item.occurredAt)}`,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm + 2, opacity: pressed ? 0.6 : 1 })}>
      <CategoryIcon icon={debit ? 'arrow-top-right' : 'arrow-bottom-left'} color={debit ? colors.danger : colors.income} size={44} square />
      <View style={{ flex: 1 }}>
        <AppText numberOfLines={1} style={{ fontWeight: '600' }}>
          {bankTxnTitle(item)}
        </AppText>
        <AppText variant="caption" muted numberOfLines={1}>
          {meta}
        </AppText>
      </View>
      <Money amount={item.amount} currency={item.currency} type={debit ? 'expense' : 'income'} variant="body" />
    </Pressable>
  );
}

/** Swipe left → ignore (red). */
export function SwipeableBankTxnRow(props: {
  item: BankTransactionDTO;
  onPress?: () => void;
  onIgnore: () => void | Promise<void>;
  shellStyle?: StyleProp<ViewStyle>;
  corners?: Corners;
}) {
  const { colors } = useTheme();
  return (
    <SwipeableBankAction
      item={props.item}
      onPress={props.onPress}
      onAction={props.onIgnore}
      shellStyle={props.shellStyle}
      corners={props.corners}
      side="right"
      color={colors.danger}
      icon="eye-off-outline"
      idleLabel="Ignore"
      armedLabel="Ignored"
    />
  );
}

/** Swipe right → restore (green). */
export function SwipeableRestoreBankTxnRow(props: {
  item: BankTransactionDTO;
  onPress?: () => void;
  onRestore: () => void | Promise<void>;
  shellStyle?: StyleProp<ViewStyle>;
  corners?: Corners;
}) {
  const { colors } = useTheme();
  return (
    <SwipeableBankAction
      item={props.item}
      onPress={props.onPress}
      onAction={props.onRestore}
      shellStyle={props.shellStyle}
      corners={props.corners}
      side="left"
      color={colors.success}
      icon="backup-restore"
      idleLabel="Restore"
      armedLabel="Restored"
    />
  );
}

function SwipeableBankAction({
  item,
  onPress,
  onAction,
  shellStyle,
  corners,
  side,
  color,
  icon,
  idleLabel,
  armedLabel,
}: {
  item: BankTransactionDTO;
  onPress?: () => void;
  onAction: () => void | Promise<void>;
  shellStyle?: StyleProp<ViewStyle>;
  corners?: Corners;
  side: 'left' | 'right';
  color: string;
  icon: string;
  idleLabel: string;
  armedLabel: string;
}) {
  const { colors } = useTheme();
  const swipeRef = useRef<SwipeableMethods>(null);
  const [rowWidth, setRowWidth] = useState(0);
  const committed = useRef(false);
  const measuredH = useRef(0);
  const height = useSharedValue(-1);
  const threshold = Math.max(120, rowWidth * 0.5);
  const openDirection = side === 'right' ? SwipeDirection.LEFT : SwipeDirection.RIGHT;

  const commit = () => {
    void onAction();
  };

  const finish = () => {
    if (committed.current) return;
    committed.current = true;
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

  const wrapStyle = useAnimatedStyle(() => {
    const h = height.get();
    if (h < 0) return { overflow: 'hidden' as const };
    return {
      height: h,
      overflow: 'hidden' as const,
      opacity: interpolate(h, [0, Math.max(measuredH.current, 1)], [0, 1]),
    };
  });

  const renderAction = (progress: SharedValue<number>, translation: SharedValue<number>) =>
    rowWidth > 0 ? (
      <FullSwipeAction
        width={rowWidth}
        progress={progress}
        translation={translation}
        side={side}
        color={color}
        icon={icon}
        idleLabel={idleLabel}
        armedLabel={armedLabel}
        corners={corners}
      />
    ) : null;

  return (
    <Animated.View style={[corners, wrapStyle]}>
      <ReanimatedSwipeable
        ref={swipeRef}
        friction={1}
        rightThreshold={side === 'right' ? threshold : undefined}
        leftThreshold={side === 'left' ? threshold : undefined}
        overshootRight={false}
        overshootLeft={false}
        containerStyle={[{ overflow: 'hidden', backgroundColor: colors.surface }, corners]}
        childrenContainerStyle={{ backgroundColor: colors.surface }}
        onSwipeableOpen={(direction) => {
          if (direction === openDirection) finish();
        }}
        renderRightActions={side === 'right' ? renderAction : undefined}
        renderLeftActions={side === 'left' ? renderAction : undefined}>
        <View
          style={[{ backgroundColor: colors.surface }, shellStyle, corners]}
          onLayout={(e) => {
            const { width, height: h } = e.nativeEvent.layout;
            if (width > 0 && width !== rowWidth) setRowWidth(width);
            measuredH.current = h;
          }}>
          <BankTxnRow item={item} onPress={onPress} />
        </View>
      </ReanimatedSwipeable>
    </Animated.View>
  );
}

function FullSwipeAction({
  width,
  progress,
  translation,
  side,
  color,
  icon,
  idleLabel,
  armedLabel,
  corners,
}: {
  width: number;
  progress: SharedValue<number>;
  translation: SharedValue<number>;
  side: 'left' | 'right';
  color: string;
  icon: string;
  idleLabel: string;
  armedLabel: string;
  corners?: Corners;
}) {
  const [label, setLabel] = useState(idleLabel);
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
    const opacity = interpolate(progress.get(), [0, 0.08, 1], [0, 1, 1], Extrapolation.CLAMP);
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
        scheduleOnRN(setLabel, crossed ? armedLabel : idleLabel);
      }
    },
  );

  return (
    <View
      style={{
        width,
        height: '100%',
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
        <Animated.View style={[{ alignItems: 'center', gap: 2 }, iconStyle]}>
          <Icon name={icon} size={24} color="#FFFFFF" />
          <AppText variant="caption" color="#FFFFFF" style={{ fontWeight: '700' }}>
            {label}
          </AppText>
        </Animated.View>
      </Animated.View>
    </View>
  );
}
