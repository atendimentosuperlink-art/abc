import React, { useRef, useState } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import {
  Gesture,
  GestureDetector,
} from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

type Props = {
  style?: ViewStyle;
  children: React.ReactNode;
  onTap?: (x: number, y: number, size: { w: number; h: number }) => void;
  testID?: string;
};

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const TAP_MAX_DURATION = 250;

/**
 * A pinch-to-zoom + pan + tap-to-mark wrapper.
 *
 * - Tap (no movement): invokes onTap with image-space coordinates (in unzoomed/pre-translation
 *   pixel space relative to the container size — caller can convert to 0..1 by dividing by size).
 * - Pinch: zoom in/out (centered on the focal point).
 * - Pan: pans while zoomed; clamped so the image cannot leave the viewport.
 * - Double tap: resets zoom & translation.
 *
 * The children should fill the container; we apply a transform on a wrapper Animated.View.
 */
export default function ZoomableCanvas({ style, children, onTap, testID }: Props) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const savedScale = useSharedValue(1);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);

  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

  const clampTranslation = (s: number, tx: number, ty: number) => {
    "worklet";
    // The image is `size.w x size.h` and gets scaled by s centered.
    // When scaled, overflow on each side is (s-1) * size.{w|h} / 2.
    const w = sizeRef.current.w;
    const h = sizeRef.current.h;
    const maxX = ((s - 1) * w) / 2;
    const maxY = ((s - 1) * h) / 2;
    return {
      tx: Math.min(maxX, Math.max(-maxX, tx)),
      ty: Math.min(maxY, Math.max(-maxY, ty)),
    };
  };

  const fireTap = (cx: number, cy: number) => {
    if (!onTap) return;
    const { w, h } = sizeRef.current;
    if (w <= 0 || h <= 0) return;
    // Map screen point (cx, cy) on container to image coords:
    // Transform applied is: translate(tx,ty) then scale(s) around center.
    // Center of container is (w/2, h/2). Image-space point:
    //   ix = (cx - w/2 - tx) / s + w/2
    //   iy = (cy - h/2 - ty) / s + h/2
    const s = scale.value;
    const tx = translateX.value;
    const ty = translateY.value;
    const ix = (cx - w / 2 - tx) / s + w / 2;
    const iy = (cy - h / 2 - ty) / s + h / 2;
    const ixClamped = clamp(ix, 0, w);
    const iyClamped = clamp(iy, 0, h);
    onTap(ixClamped, iyClamped, { w, h });
  };

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
    })
    .onUpdate((e) => {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, savedScale.value * e.scale));
      scale.value = next;
      const clamped = clampTranslation(next, translateX.value, translateY.value);
      translateX.value = clamped.tx;
      translateY.value = clamped.ty;
    })
    .onEnd(() => {
      if (scale.value < MIN_SCALE + 0.02) {
        scale.value = withTiming(MIN_SCALE);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
      }
    });

  const pan = Gesture.Pan()
    .minPointers(1)
    .maxPointers(2)
    .averageTouches(true)
    .onStart(() => {
      savedTx.value = translateX.value;
      savedTy.value = translateY.value;
    })
    .onUpdate((e) => {
      const clamped = clampTranslation(scale.value, savedTx.value + e.translationX, savedTy.value + e.translationY);
      translateX.value = clamped.tx;
      translateY.value = clamped.ty;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(TAP_MAX_DURATION)
    .onEnd(() => {
      scale.value = withTiming(1);
      translateX.value = withTiming(0);
      translateY.value = withTiming(0);
      savedScale.value = 1;
      savedTx.value = 0;
      savedTy.value = 0;
    });

  const singleTap = Gesture.Tap()
    .numberOfTaps(1)
    .maxDuration(TAP_MAX_DURATION)
    .maxDistance(8)
    .onEnd((e, success) => {
      if (!success) return;
      runOnJS(fireTap)(e.x, e.y);
    });

  const composed = Gesture.Simultaneous(
    pinch,
    pan,
    Gesture.Exclusive(doubleTap, singleTap)
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View
      style={[styles.container, style]}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      collapsable={false}
      testID={testID}
    >
      <GestureDetector gesture={composed}>
        <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]} collapsable={false}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: "hidden" },
});
