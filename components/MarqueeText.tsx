import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TextStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  cancelAnimation,
  Easing,
  runOnJS,
} from 'react-native-reanimated';

interface MarqueeTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  speed?: number;
}

export const MarqueeText = ({ text, style, speed = 50 }: MarqueeTextProps) => {
  const containerWidth = useSharedValue(0);
  const textWidth = useSharedValue(0);
  const translateX = useSharedValue(0);
  const measured = useSharedValue(0); // 0 = none, 1 = container, 2 = both

  const startAnimation = () => {
    const cw = containerWidth.value;
    const tw = textWidth.value;

    if (cw > 0 && tw > 0 && tw > cw) {
      const scrollDistance = tw - cw + 30;
      const duration = (scrollDistance / speed) * 1000;

      translateX.value = 0;
      translateX.value = withRepeat(
        withSequence(
          withDelay(2000, withTiming(-scrollDistance, { duration, easing: Easing.linear })),
          withDelay(1000, withTiming(0, { duration: 0 }))
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(translateX);
      translateX.value = 0;
    }
  };

  useEffect(() => {
    // Reset when text changes
    measured.value = 0;
    cancelAnimation(translateX);
    translateX.value = 0;
  }, [text]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={styles.container}
      pointerEvents="none"
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0) {
          containerWidth.value = w;
          if (measured.value >= 1) {
            measured.value = 2;
            startAnimation();
          } else {
            measured.value = 1;
          }
        }
      }}
    >
      {/* Hidden text for intrinsic height */}
      <Text style={[style, { opacity: 0 }]} numberOfLines={1}>
        {text}
      </Text>

      {/* Hidden text for full width measurement — no ScrollView */}
      <Text
        style={[style, styles.measureText]}
        numberOfLines={1}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) {
            textWidth.value = w;
            if (measured.value >= 1) {
              measured.value = 2;
              startAnimation();
            } else {
              measured.value = 1;
            }
          }
        }}
      >
        {text}
      </Text>

      {/* Visible animated text */}
      <Animated.Text
        numberOfLines={1}
        style={[style, styles.visibleText, animatedStyle]}
      >
        {text}
      </Animated.Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  measureText: {
    position: 'absolute',
    opacity: 0,
    top: -9999,
    left: 0,
    // No width constraint so it measures full intrinsic width
    width: 99999,
  },
  visibleText: {
    position: 'absolute',
    left: 0,
  },
});
