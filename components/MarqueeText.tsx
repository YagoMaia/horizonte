import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent, TextStyle, StyleProp, ScrollView } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  withSequence,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';

interface MarqueeTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  speed?: number;
}

export const MarqueeText = ({ text, style, speed = 50 }: MarqueeTextProps) => {
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (containerWidth > 0 && textWidth > 0) {
      if (textWidth > containerWidth) {
        const scrollDistance = textWidth - containerWidth + 30; // Small buffer at the end
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
    }
  }, [textWidth, containerWidth, text, speed]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const onContainerLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0) setContainerWidth(width);
  };

  const onTextLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0) setTextWidth(width);
  };

  return (
    <View style={styles.container} onLayout={onContainerLayout} pointerEvents="none">
      {/* 1. Dummy Text: Provides exact intrinsic height to the flex:1 container without showing */}
      <Text style={[style, { opacity: 0 }]} numberOfLines={1}>
        {text}
      </Text>

      {/* 2. Ghost ScrollView: Provides infinite horizontal space for accurate Android native measurement */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        pointerEvents="none"
        style={styles.ghostScroll}
      >
        <Text style={[style, { flexShrink: 0 }]} onLayout={onTextLayout}>
          {text}
        </Text>
      </ScrollView>

      {/* 3. Visible Animated Text: Absolutely positioned to ignore container Flexbox crushing */}
      <Animated.Text
        numberOfLines={1}
        style={[
          style,
          styles.visibleText,
          animatedStyle,
          textWidth > 0 ? { width: textWidth } : undefined,
        ]}
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
  ghostScroll: {
    position: 'absolute',
    opacity: 0,
    zIndex: -1,
    top: -10000, // Move entirely off-screen
  },
  visibleText: {
    position: 'absolute',
    left: 0,
  },
});
