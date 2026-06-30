import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  CustomVehicle,
  deleteCustomVehicle,
  loadCustomVehicles,
  newId,
  upsertCustomVehicle,
} from "@/src/storage";
import { COLORS, FONTS, RADIUS, SPACING, VIEWS, ViewId } from "@/src/theme";

export default function VehiclesScreen() {
  const router = useRouter();
  const [list, setList] = useState<CustomVehicle[]>([]);
  const [editing, setEditing] = useState<CustomVehicle | null>(null);

  const refresh = useCallback(async () => {
    setList(await loadCustomVehicles());
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const startCreate = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setEditing({
      key: "custom_" + newId(),
      label: "",
      createdAt: new Date().toISOString(),
      views: {},
    });
  };

  const startEdit = (v: CustomVehicle) => {
    Haptics.selectionAsync();
    setEditing({ ...v });
  };

  const onDelete = (v: CustomVehicle) => {
    const run = async () => {
      const next = await deleteCustomVehicle(v.key);
      setList(next);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    };
    if (Platform.OS === "web") {
      run();
      return;
    }
    Alert.alert("Excluir veículo?", v.label, [
      { text: "Cancelar", style: "cancel" },
      { text: "Excluir", style: "destructive", onPress: run },
    ]);
  };

  const renderItem = ({ item }: { item: CustomVehicle }) => {
    const filled = Object.keys(item.views).length;
    return (
      <Pressable
        testID={`vehicle-item-${item.key}`}
        style={styles.vehicleCard}
        onPress={() => startEdit(item)}
        onLongPress={() => onDelete(item)}
      >
        <View style={styles.vehicleIcon}>
          <MaterialCommunityIcons name="car-outline" size={28} color={COLORS.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.vehicleLabel} numberOfLines={1}>
            {item.label || "(sem nome)"}
          </Text>
          <Text style={styles.vehicleMeta}>
            {filled} DE {VIEWS.length} VISTA{VIEWS.length === 1 ? "" : "S"} CADASTRADA{filled === 1 ? "" : "S"}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={22} color={COLORS.inkDim} />
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} testID="vehicles-screen">
      <View style={styles.header}>
        <Pressable
          testID="vehicles-back"
          onPress={() => router.back()}
          hitSlop={10}
          style={styles.iconBtn}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color={COLORS.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>MEUS VEÍCULOS</Text>
          <Text style={styles.sub}>MODELOS PERSONALIZADOS</Text>
        </View>
        <Pressable
          testID="vehicle-create-button"
          onPress={startCreate}
          hitSlop={10}
          style={styles.iconBtn}
        >
          <MaterialCommunityIcons name="plus-circle" size={28} color={COLORS.accent} />
        </Pressable>
      </View>

      <FlatList
        data={list}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        contentContainerStyle={
          list.length === 0
            ? styles.emptyContainer
            : { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING["2xl"] }
        }
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="car-cog" size={72} color={COLORS.surface3} />
            <Text style={styles.emptyTitle}>NENHUM VEÍCULO PERSONALIZADO</Text>
            <Text style={styles.emptyText}>
              Toque em + para cadastrar um veículo com as suas próprias fotos.
            </Text>
          </View>
        }
      />

      <VehicleEditor
        vehicle={editing}
        onClose={() => setEditing(null)}
        onSaved={async () => {
          await refresh();
          setEditing(null);
        }}
        onDeleteRequest={onDelete}
      />
    </SafeAreaView>
  );
}

/* ---------- Editor Modal ---------- */

function VehicleEditor({
  vehicle,
  onClose,
  onSaved,
  onDeleteRequest,
}: {
  vehicle: CustomVehicle | null;
  onClose: () => void;
  onSaved: () => void;
  onDeleteRequest: (v: CustomVehicle) => void;
}) {
  const [draft, setDraft] = useState<CustomVehicle | null>(vehicle);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    setDraft(vehicle);
  }, [vehicle]);

  if (!draft) return null;

  const pickViewImage = async (view: ViewId) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permissão necessária", "Conceda acesso à galeria.");
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      allowsEditing: false,
      quality: 0.9,
      base64: false,
    });
    if (r.canceled || !r.assets[0]?.uri) return;
    setBusy(true);
    try {
      // resize to max 1200px wide to keep storage reasonable
      const manipulated = await ImageManipulator.manipulateAsync(
        r.assets[0].uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      const base64 = manipulated.base64;
      if (!base64) throw new Error("Falha ao processar imagem");
      const w = manipulated.width || r.assets[0].width || 1200;
      const h = manipulated.height || r.assets[0].height || 800;
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              views: {
                ...prev.views,
                [view]: { src: `data:image/jpeg;base64,${base64}`, w, h },
              },
            }
          : prev
      );
    } catch (e: any) {
      Alert.alert("Erro", e?.message || "Tente novamente");
    } finally {
      setBusy(false);
    }
  };

  const removeViewImage = (view: ViewId) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = { ...prev.views };
      delete next[view];
      return { ...prev, views: next };
    });
  };

  const onSave = async () => {
    if (!draft.label.trim()) {
      Alert.alert("Nome obrigatório", "Informe um nome para o veículo.");
      return;
    }
    await upsertCustomVehicle({ ...draft, label: draft.label.trim() });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSaved();
  };

  return (
    <Modal visible={!!vehicle} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} testID="vehicle-editor">
        <View style={styles.header}>
          <Pressable testID="editor-close" onPress={onClose} hitSlop={10} style={styles.iconBtn}>
            <MaterialCommunityIcons name="close" size={26} color={COLORS.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>
              {vehicle && Object.keys(vehicle.views).length === 0 ? "NOVO VEÍCULO" : "EDITAR VEÍCULO"}
            </Text>
            <Text style={styles.sub}>FOTOS DAS 5 VISTAS</Text>
          </View>
          <Pressable
            testID="editor-save"
            onPress={onSave}
            hitSlop={10}
            style={styles.iconBtn}
            disabled={busy}
          >
            <MaterialCommunityIcons name="content-save" size={26} color={COLORS.accent} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING["2xl"] }}>
          <Text style={styles.fieldLabel}>NOME DO VEÍCULO</Text>
          <TextInput
            testID="vehicle-name-input"
            value={draft.label}
            onChangeText={(v) => setDraft((p) => (p ? { ...p, label: v } : p))}
            placeholder="Ex.: Hilux SR 2020"
            placeholderTextColor={COLORS.inkDim}
            style={styles.input}
          />

          <Text style={[styles.fieldLabel, { marginTop: SPACING.xl }]}>FOTOS POR VISTA</Text>
          <Text style={styles.helper}>
            Cadastre uma foto para cada vista. Recomendado: foto limpa, fundo neutro, veículo centralizado.
          </Text>

          {VIEWS.map((v) => {
            const img = draft.views[v.id];
            return (
              <View key={v.id} style={styles.viewRow} testID={`view-row-${v.id}`}>
                <View style={styles.viewLabelBox}>
                  <Text style={styles.viewLabel}>{v.label.toUpperCase()}</Text>
                </View>
                {img?.src ? (
                  <>
                    <Image source={{ uri: img.src }} style={styles.viewThumb} contentFit="cover" />
                    <Pressable
                      testID={`view-replace-${v.id}`}
                      onPress={() => pickViewImage(v.id)}
                      hitSlop={6}
                      style={styles.viewActionBtn}
                    >
                      <MaterialCommunityIcons name="image-edit" size={20} color={COLORS.accent} />
                    </Pressable>
                    <Pressable
                      testID={`view-remove-${v.id}`}
                      onPress={() => removeViewImage(v.id)}
                      hitSlop={6}
                      style={styles.viewActionBtn}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={20} color={COLORS.error} />
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    testID={`view-add-${v.id}`}
                    onPress={() => pickViewImage(v.id)}
                    style={styles.viewAddBtn}
                  >
                    <MaterialCommunityIcons name="image-plus" size={20} color={COLORS.accent} />
                    <Text style={styles.viewAddText}>ADICIONAR</Text>
                  </Pressable>
                )}
              </View>
            );
          })}

          {busy && <Text style={styles.busy}>PROCESSANDO IMAGEM…</Text>}

          {vehicle && Object.keys(vehicle.views).length > 0 && (
            <Pressable
              testID="vehicle-delete-button"
              onPress={() => onDeleteRequest(draft)}
              style={styles.deleteBtn}
            >
              <MaterialCommunityIcons name="trash-can-outline" size={18} color={COLORS.error} />
              <Text style={styles.deleteText}>EXCLUIR ESTE VEÍCULO</Text>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
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
  fieldLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.inkDim,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  helper: {
    fontFamily: FONTS.text,
    fontSize: 11,
    color: COLORS.inkDim,
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    color: COLORS.ink,
    fontFamily: FONTS.text,
    fontSize: 14,
  },
  emptyContainer: { flexGrow: 1, justifyContent: "center" },
  empty: { alignItems: "center", padding: SPACING.xl, gap: SPACING.sm },
  emptyTitle: {
    fontFamily: FONTS.display,
    fontSize: 14,
    color: COLORS.inkDim,
    letterSpacing: 2,
    fontWeight: "700",
    marginTop: SPACING.md,
    textAlign: "center",
  },
  emptyText: {
    fontFamily: FONTS.text,
    color: COLORS.inkDim,
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
  },
  vehicleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.md,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
    borderRadius: RADIUS.md,
  },
  vehicleIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  vehicleLabel: {
    fontFamily: FONTS.display,
    fontSize: 15,
    color: COLORS.ink,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  vehicleMeta: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.inkDim,
    letterSpacing: 1,
    marginTop: 2,
  },
  viewRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  viewLabelBox: { width: 90 },
  viewLabel: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.ink,
    letterSpacing: 1,
    fontWeight: "600",
  },
  viewThumb: { width: 64, height: 44, borderRadius: RADIUS.sm, backgroundColor: COLORS.surface2 },
  viewAddBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.xs,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderStyle: "dashed",
    backgroundColor: COLORS.surface2,
  },
  viewAddText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.accent,
    letterSpacing: 0.5,
  },
  viewActionBtn: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface2,
    alignItems: "center",
    justifyContent: "center",
  },
  busy: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.accent,
    letterSpacing: 1.5,
    textAlign: "center",
    marginTop: SPACING.md,
  },
  deleteBtn: {
    marginTop: SPACING.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  deleteText: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.error,
    letterSpacing: 1.5,
    fontWeight: "800",
  },
});
