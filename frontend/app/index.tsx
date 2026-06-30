import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { COLORS, FONTS, RADIUS, SPACING } from "@/src/theme";
import {
  Inspection,
  deleteInspection,
  loadHistory,
  newId,
  saveDraft,
} from "@/src/storage";
import { exportInspectionPdf } from "@/src/pdf";
import { CAR_PHOTOS } from "@/src/data/carPhotos";

function todayIso(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export default function HomeScreen() {
  const router = useRouter();
  const [history, setHistory] = useState<Inspection[]>([]);

  const refresh = useCallback(async () => {
    const list = await loadHistory();
    setHistory(list);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const startNew = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const draft: Inspection = {
      id: newId(),
      createdAt: new Date().toISOString(),
      date: todayIso(),
      plate: "",
      driver: "",
      model: Object.keys(CAR_PHOTOS)[0],
      markers: [],
    };
    await saveDraft(draft);
    router.push({ pathname: "/inspection", params: { id: draft.id, mode: "new" } });
  };

  const openInspection = async (insp: Inspection) => {
    Haptics.selectionAsync();
    await saveDraft(insp);
    router.push({ pathname: "/inspection", params: { id: insp.id, mode: "edit" } });
  };

  const onDelete = (insp: Inspection) => {
    Alert.alert(
      "Excluir vistoria?",
      `${insp.plate || "(sem placa)"} · ${formatDate(insp.date)}`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            await deleteInspection(insp.id);
            await refresh();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          },
        },
      ]
    );
  };

  const onExport = async (insp: Inspection) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await exportInspectionPdf(insp);
    } catch (e: any) {
      Alert.alert("Erro ao exportar", e?.message || "Tente novamente.");
    }
  };

  const renderItem = ({ item }: { item: Inspection }) => {
    const modelLabel = CAR_PHOTOS[item.model]?.label || item.model;
    return (
      <Pressable
        testID={`history-item-${item.id}`}
        style={({ pressed }) => [styles.histCard, pressed && { opacity: 0.7 }]}
        onPress={() => openInspection(item)}
        onLongPress={() => onDelete(item)}
      >
        <View style={styles.histLeft}>
          <Text style={styles.histDate}>{formatDate(item.date)}</Text>
          <Text style={styles.histPlate}>{item.plate || "—"}</Text>
        </View>
        <View style={styles.histMid}>
          <Text style={styles.histLabel}>CONDUTOR</Text>
          <Text style={styles.histText} numberOfLines={1}>{item.driver || "—"}</Text>
          <Text style={[styles.histLabel, { marginTop: 4 }]}>MODELO</Text>
          <Text style={styles.histText} numberOfLines={1}>{modelLabel}</Text>
        </View>
        <View style={styles.histRight}>
          <View style={styles.countBadge}>
            <Text style={styles.countNum}>{item.markers.length}</Text>
            <Text style={styles.countLbl}>AVARIA{item.markers.length === 1 ? "" : "S"}</Text>
          </View>
          <Pressable
            testID={`history-export-${item.id}`}
            onPress={() => onExport(item)}
            hitSlop={10}
            style={styles.exportBtn}
          >
            <MaterialCommunityIcons name="file-pdf-box" size={22} color={COLORS.accent} />
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} testID="home-screen">
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>VISTORIA DIÁRIA</Text>
          <Text style={styles.subtitle}>CHECKLIST VISUAL DE INSPEÇÃO</Text>
        </View>
        <MaterialCommunityIcons name="car-wrench" size={32} color={COLORS.accent} />
      </View>

      <Pressable
        testID="new-inspection-button"
        style={({ pressed }) => [styles.cta, pressed && { backgroundColor: COLORS.accentDim }]}
        onPress={startNew}
      >
        <MaterialCommunityIcons name="plus-circle" size={22} color={COLORS.bg} />
        <Text style={styles.ctaText}>NOVA VISTORIA</Text>
      </Pressable>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>HISTÓRICO</Text>
        <Text style={styles.sectionMeta}>{history.length} REGISTRO{history.length === 1 ? "" : "S"}</Text>
      </View>

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={
          history.length === 0 ? styles.emptyContainer : { paddingBottom: SPACING["2xl"] }
        }
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="clipboard-text-outline" size={80} color={COLORS.surface3} />
            <Text style={styles.emptyTitle}>NENHUMA VISTORIA</Text>
            <Text style={styles.emptyText}>Toque em &quot;Nova Vistoria&quot; para começar.</Text>
          </View>
        }
      />

      {history.length > 0 && (
        <Text style={styles.hint} testID="long-press-hint">
          Toque para abrir · Mantenha pressionado para excluir
        </Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: COLORS.accent,
  },
  title: {
    fontFamily: FONTS.display,
    fontSize: 26,
    color: COLORS.ink,
    letterSpacing: 1,
    fontWeight: "800",
  },
  subtitle: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.inkDim,
    letterSpacing: 1.5,
    marginTop: 2,
  },
  cta: {
    backgroundColor: COLORS.accent,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  ctaText: {
    fontFamily: FONTS.display,
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 1.5,
    color: COLORS.bg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.ink,
    letterSpacing: 2,
    fontWeight: "700",
  },
  sectionMeta: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.inkDim,
    letterSpacing: 1,
  },
  histCard: {
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
    borderRadius: RADIUS.md,
  },
  histLeft: { width: 88 },
  histDate: { fontFamily: FONTS.mono, color: COLORS.ink, fontSize: 13, fontWeight: "600" },
  histPlate: {
    fontFamily: FONTS.display,
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: 4,
  },
  histMid: { flex: 1, paddingHorizontal: SPACING.sm },
  histLabel: { fontFamily: FONTS.mono, fontSize: 9, color: COLORS.inkDim, letterSpacing: 1 },
  histText: { fontFamily: FONTS.text, fontSize: 12, color: COLORS.ink, marginTop: 1 },
  histRight: { alignItems: "center", gap: SPACING.sm },
  countBadge: {
    backgroundColor: COLORS.surface2,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    alignItems: "center",
    minWidth: 56,
  },
  countNum: { fontFamily: FONTS.display, color: COLORS.accent, fontSize: 20, fontWeight: "800" },
  countLbl: { fontFamily: FONTS.mono, fontSize: 8, color: COLORS.inkDim, letterSpacing: 1 },
  exportBtn: { padding: 4 },
  emptyContainer: { flexGrow: 1, justifyContent: "center" },
  empty: { alignItems: "center", padding: SPACING.xl, gap: SPACING.md },
  emptyTitle: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.inkDim,
    letterSpacing: 2,
    fontWeight: "700",
    marginTop: SPACING.md,
  },
  emptyText: { fontFamily: FONTS.text, color: COLORS.inkDim, fontSize: 12 },
  hint: {
    textAlign: "center",
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.inkDim,
    paddingVertical: SPACING.sm,
    letterSpacing: 0.5,
  },
});
