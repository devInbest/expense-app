import * as Haptics from 'expo-haptics';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { radius, spacing, useTheme } from '@/theme';
import { BackdropSlice, linearGradient, MOTION, TAB_BAR_BOTTOM_GAP, TAB_BAR_FADE, TAB_BAR_HEIGHT } from './ui';

const PAD = 5;

function TabItem({
  focused,
  label,
  icon,
  onPress,
  onLongPress,
}: {
  focused: boolean;
  label: string;
  icon: (color: string) => React.ReactNode;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const { colors } = useTheme();
  const lift = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    lift.set(withTiming(focused ? 1 : 0, MOTION));
  }, [focused, lift]);
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: 1 + lift.get() * 0.08 }, { translateY: -lift.get() * 1 }] }));
  const color = focused ? colors.onPrimary : colors.textMuted;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
      <Animated.View style={iconStyle}>{icon(color)}</Animated.View>
      <Text numberOfLines={1} style={{ fontSize: 10, fontWeight: focused ? '700' : '600', color }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Solid pill tab bar on an opaque strip, so scrolled content never shows through; screens pad with `useTabBarInset`. */
export function GlassTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { colors, dark } = useTheme();
  const [width, setWidth] = useState(0);
  const segment = width > 0 ? (width - PAD * 2) / state.routes.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    x.set(withTiming(state.index * segment, MOTION));
  }, [state.index, segment, x]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingTop: TAB_BAR_FADE,
        paddingHorizontal: spacing.lg,
        paddingBottom: insets.bottom + TAB_BAR_BOTTOM_GAP,
      }}>
      <BackdropSlice fade={TAB_BAR_FADE} />
      <View
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        style={{
          height: TAB_BAR_HEIGHT,
          borderRadius: radius.pill,
          flexDirection: 'row',
          padding: PAD,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: dark ? colors.glassBorder : colors.border,
          boxShadow: `0 8px 24px ${colors.shadow}`,
        }}>
        {segment > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                top: PAD,
                bottom: PAD,
                left: PAD,
                width: segment,
                borderRadius: radius.pill,
                backgroundColor: colors.primary,
                experimental_backgroundImage: linearGradient('#FF6A2E', colors.primaryDeep),
                boxShadow: `0 6px 16px ${colors.primaryGlow}`,
              },
              indicator,
            ]}
          />
        ) : null}
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key]!;
          const focused = state.index === index;
          const label = typeof options.title === 'string' ? options.title : route.name;
          return (
            <TabItem
              key={route.key}
              focused={focused}
              label={label}
              icon={(color) => options.tabBarIcon?.({ focused, color, size: 22 })}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) {
                  void Haptics.selectionAsync();
                  navigation.navigate(route.name, route.params);
                }
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            />
          );
        })}
      </View>
    </View>
  );
}
