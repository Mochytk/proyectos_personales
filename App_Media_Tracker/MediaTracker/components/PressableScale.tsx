import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Strong ease-out: the built-in curves are too gentle for a tap that should answer instantly.
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

interface Props extends Omit<PressableProps, 'style'> {
  style?: StyleProp<ViewStyle>;
  /** Turns the press feedback off when motion would be a distraction. */
  static?: boolean;
}

/**
 * Pressable that shrinks slightly while pressed. A timing animation (not a keyframe) so letting go
 * mid-press retargets smoothly. Spreads its props, so it works as the child of `<Link asChild>`.
 */
export default function PressableScale({ style, static: isStatic, onPressIn, onPressOut, ...rest }: Props) {
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  // Press snaps, release settles a little slower. Skipped entirely under reduced motion.
  const to = (value: number, duration: number) => {
    scale.set(withTiming(value, { duration, easing: EASE_OUT }));
  };
  const still = isStatic || reduceMotion;

  return (
    <AnimatedPressable
      {...rest}
      style={still ? style : [style, animatedStyle]}
      onPressIn={(e) => {
        if (!still) to(0.96, 100);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!still) to(1, 160);
        onPressOut?.(e);
      }}
    />
  );
}
