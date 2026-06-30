import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useRef, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  PanResponder,
  GestureResponderEvent,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { COLORS, FONTS, RADIUS, SPACING } from "@/src/theme";
import type { SignaturePath } from "@/src/storage";

type Props = {
  visible: boolean;
  initial?: SignaturePath[];
  onClose: () => void;
  onSave: (paths: SignaturePath[]) => void;
};

export default function SignatureModal({ visible, initial, onClose, onSave }: Props) {
  const [paths, setPaths] = useState<SignaturePath[]>(initial || []);
  const currentPath = useRef<string>("");
  const [pathDraft, setPathDraft] = useState<string>("");

  // Reset state on open
  React.useEffect(() => {
    if (visible) {
      setPaths(initial || []);
      currentPath.current = "";
      setPathDraft("");
    }
  }, [visible, initial]);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        currentPath.current = `M${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        setPathDraft(currentPath.current);
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        currentPath.current += ` L${locationX.toFixed(1)},${locationY.toFixed(1)}`;
        setPathDraft(currentPath.current);
      },
      onPanResponderRelease: () => {
        if (currentPath.current) {
          setPaths((prev) => [...prev, { d: currentPath.current }]);
          currentPath.current = "";
          setPathDraft("");
        }
      },
      onPanResponderTerminate: () => {
        if (currentPath.current) {
          setPaths((prev) => [...prev, { d: currentPath.current }]);
          currentPath.current = "";
          setPathDraft("");
        }
      },
    })
  ).current;

  const clear = () => {
    setPaths([]);
    currentPath.current = "";
    setPathDraft("");
  };

  const undo = () => {
    setPaths((prev) => prev.slice(0, -1));
  };

  const save = () => {
    onSave(paths);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent={false}>
      <View style={styles.container} testID="signature-modal">
        <View style={styles.header}>
          <Pressable testID="signature-close" onPress={onClose} hitSlop={10} style={styles.iconBtn}>
            <MaterialCommunityIcons name="close" size={26} color={COLORS.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>ASSINATURA</Text>
            <Text style={styles.sub}>ASSINE COM O DEDO NO ESPAÇO ABAIXO</Text>
          </View>
          <Pressable testID="signature-save" onPress={save} hitSlop={10} style={styles.iconBtn}>
            <MaterialCommunityIcons name="check-bold" size={26} color={COLORS.accent} />
          </Pressable>
        </View>

        <View style={styles.canvasWrap}>
          <View style={styles.canvas} {...responder.panHandlers} testID="signature-canvas">
            <Svg style={StyleSheet.absoluteFill}>
              {paths.map((p, i) => (
                <Path
                  key={i}
                  d={p.d}
                  stroke={COLORS.bg}
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
              {pathDraft ? (
                <Path
                  d={pathDraft}
                  stroke={COLORS.bg}
                  strokeWidth={3}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ) : null}
            </Svg>
            {paths.length === 0 && !pathDraft && (
              <View style={styles.placeholder} pointerEvents="none">
                <MaterialCommunityIcons name="draw" size={48} color="#bbb" />
                <Text style={styles.placeholderText}>TOQUE E ARRASTE PARA ASSINAR</Text>
              </View>
            )}
            <View style={styles.guideLine} pointerEvents="none" />
            <Text style={styles.guideText}>x ASSINATURA DO CONDUTOR</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable testID="signature-undo" onPress={undo} style={styles.actionBtn}>
            <MaterialCommunityIcons name="undo" size={18} color={COLORS.ink} />
            <Text style={styles.actionText}>DESFAZER</Text>
          </Pressable>
          <Pressable testID="signature-clear" onPress={clear} style={styles.actionBtn}>
            <MaterialCommunityIcons name="eraser" size={18} color={COLORS.error} />
            <Text style={[styles.actionText, { color: COLORS.error }]}>LIMPAR</Text>
          </Pressable>
          <Pressable testID="signature-confirm" onPress={save} style={[styles.actionBtn, styles.confirmBtn]}>
            <MaterialCommunityIcons name="check-bold" size={18} color={COLORS.bg} />
            <Text style={[styles.actionText, { color: COLORS.bg }]}>CONFIRMAR</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export function SignaturePreview({ paths, width = 280, height = 110 }: { paths: SignaturePath[]; width?: number; height?: number }) {
  return (
    <View style={[styles.preview, { width, height }]}>
      <Svg style={StyleSheet.absoluteFill}>
        {paths.map((p, i) => (
          <Path
            key={i}
            d={p.d}
            stroke={COLORS.ink}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
      </Svg>
      <View style={styles.previewGuide} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
    paddingTop: Platform.OS === "android" ? SPACING.lg : SPACING.sm,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
    gap: SPACING.xs,
  },
  iconBtn: { padding: SPACING.xs },
  title: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.ink,
    letterSpacing: 1.5,
    fontWeight: "800",
  },
  sub: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.inkDim,
    letterSpacing: 1.5,
    marginTop: 1,
  },
  canvasWrap: {
    flex: 1,
    padding: SPACING.lg,
    justifyContent: "center",
  },
  canvas: {
    flex: 1,
    backgroundColor: COLORS.paper,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    position: "relative",
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  placeholderText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: "#8a8a8a",
    letterSpacing: 1.5,
  },
  guideLine: {
    position: "absolute",
    left: 24,
    right: 24,
    bottom: 40,
    height: 1,
    backgroundColor: "#999",
  },
  guideText: {
    position: "absolute",
    left: 24,
    bottom: 18,
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: "#666",
    letterSpacing: 1,
  },
  actions: {
    flexDirection: "row",
    gap: SPACING.sm,
    padding: SPACING.lg,
    paddingTop: 0,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
  },
  confirmBtn: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  actionText: {
    fontFamily: FONTS.display,
    fontSize: 12,
    color: COLORS.ink,
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  preview: {
    backgroundColor: COLORS.surface2,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  previewGuide: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 12,
    height: 1,
    backgroundColor: COLORS.line,
  },
});
