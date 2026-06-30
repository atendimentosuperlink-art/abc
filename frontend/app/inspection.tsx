import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
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

import { CAR_PHOTOS } from "@/src/data/carPhotos";
import { exportInspectionPdf } from "@/src/pdf";
import {
  Inspection,
  Marker,
  clearDraft,
  loadDraft,
  newId,
  saveDraft,
  saveInspection,
} from "@/src/storage";
import {
  COLORS,
  DAMAGE_TYPES,
  DamageType,
  FONTS,
  RADIUS,
  SPACING,
  VIEWS,
  ViewId,
} from "@/src/theme";

const MODEL_KEYS = Object.keys(CAR_PHOTOS);

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function InspectionScreen() {
  const router = useRouter();
  useLocalSearchParams<{ id?: string; mode?: string }>();

  const [insp, setInsp] = useState<Inspection | null>(null);
  const [activeView, setActiveView] = useState<ViewId>("topo");
  const [activeMarker, setActiveMarker] = useState<Marker | null>(null);
  const [canvasSize, setCanvasSize] = useState({ w: 0, h: 0 });
  const [photoModal, setPhotoModal] = useState<string | null>(null);
  const draftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load draft on mount
  useEffect(() => {
    (async () => {
      const draft = await loadDraft();
      if (draft) {
        setInsp(draft);
      } else {
        setInsp({
          id: newId(),
          createdAt: new Date().toISOString(),
          date: todayIso(),
          plate: "",
          driver: "",
          model: MODEL_KEYS[0],
          markers: [],
        });
      }
    })();
  }, []);

  // Autosave draft
  useEffect(() => {
    if (!insp) return;
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => {
      saveDraft(insp);
    }, 400);
    return () => {
      if (draftTimer.current) clearTimeout(draftTimer.current);
    };
  }, [insp]);

  const carPhotos = useMemo(() => (insp ? CAR_PHOTOS[insp.model] : null), [insp]);
  const currentImg = carPhotos?.views?.[activeView];

  const markersInView = useMemo(
    () => (insp ? insp.markers.filter((m) => m.view === activeView) : []),
    [insp, activeView]
  );

  if (!insp) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.loadingText}>CARREGANDO...</Text>
      </SafeAreaView>
    );
  }

  const updateInsp = (patch: Partial<Inspection>) =>
    setInsp((prev) => (prev ? { ...prev, ...patch } : prev));

  const handleCanvasTap = (evt: any) => {
    if (!currentImg || canvasSize.w === 0) return;
    const { locationX, locationY } = evt.nativeEvent;
    const x = Math.max(0, Math.min(1, locationX / canvasSize.w));
    const y = Math.max(0, Math.min(1, locationY / canvasSize.h));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const m: Marker = {
      id: newId(),
      view: activeView,
      x,
      y,
      type: "arranhao",
      note: "",
    };
    setInsp((prev) => (prev ? { ...prev, markers: [...prev.markers, m] } : prev));
    setActiveMarker(m);
  };

  const updateMarker = (id: string, patch: Partial<Marker>) => {
    setInsp((prev) => {
      if (!prev) return prev;
      const markers = prev.markers.map((m) => (m.id === id ? { ...m, ...patch } : m));
      return { ...prev, markers };
    });
    if (activeMarker?.id === id) setActiveMarker((prev) => (prev ? { ...prev, ...patch } : prev));
  };

  const deleteMarker = (id: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setInsp((prev) => (prev ? { ...prev, markers: prev.markers.filter((m) => m.id !== id) } : prev));
    setActiveMarker(null);
  };

  const pickPhoto = async (markerId: string) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!lib.granted) {
        Alert.alert("Permissão necessária", "Conceda acesso à câmera ou galeria para anexar fotos.");
        return;
      }
    }
    const pickFromLibrary = async () => {
      const r = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 0.6,
        base64: true,
      });
      if (!r.canceled && r.assets[0]?.base64) {
        updateMarker(markerId, { photo: `data:image/jpeg;base64,${r.assets[0].base64}` });
      }
    };
    const pickFromCamera = async () => {
      const r = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.6,
        base64: true,
      });
      if (!r.canceled && r.assets[0]?.base64) {
        updateMarker(markerId, { photo: `data:image/jpeg;base64,${r.assets[0].base64}` });
      }
    };
    if (Platform.OS === "web") {
      // Camera typically unavailable in web preview — go straight to library.
      await pickFromLibrary();
      return;
    }
    Alert.alert("Anexar foto", "Escolha a origem:", [
      { text: "Cancelar", style: "cancel" },
      { text: "Câmera", onPress: pickFromCamera },
      { text: "Galeria", onPress: pickFromLibrary },
    ]);
  };

  const onSave = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await saveInspection(insp);
    if (Platform.OS === "web") {
      await clearDraft();
      router.back();
      return;
    }
    Alert.alert("Vistoria salva", "Os dados foram armazenados no histórico.", [
      {
        text: "OK",
        onPress: async () => {
          await clearDraft();
          router.back();
        },
      },
    ]);
  };

  const onExport = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await saveInspection(insp);
      await exportInspectionPdf(insp);
    } catch (e: any) {
      Alert.alert("Erro ao exportar", e?.message || "Tente novamente.");
    }
  };

  const onClose = async () => {
    if (Platform.OS === "web") {
      // On web, Alert button callbacks don't fire reliably. Auto-save and exit.
      await saveInspection(insp);
      await clearDraft();
      router.back();
      return;
    }
    Alert.alert("Sair da vistoria?", "Alterações não salvas serão descartadas do histórico.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Salvar e sair",
        onPress: async () => {
          await saveInspection(insp);
          await clearDraft();
          router.back();
        },
      },
      {
        text: "Descartar",
        style: "destructive",
        onPress: async () => {
          await clearDraft();
          router.back();
        },
      },
    ]);
  };

  const aspectRatio =
    currentImg && currentImg.w && currentImg.h ? currentImg.w / currentImg.h : 16 / 10;

  return (
    <SafeAreaView style={styles.safe} testID="inspection-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Sticky Header */}
        <View style={styles.header}>
          <Pressable testID="back-button" onPress={onClose} hitSlop={10} style={styles.iconBtn}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={COLORS.ink} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>VISTORIA</Text>
            <Text style={styles.headerSub}>
              {insp.markers.length} PONTO{insp.markers.length === 1 ? "" : "S"} · {VIEWS.find((v) => v.id === activeView)?.label.toUpperCase()}
            </Text>
          </View>
          <Pressable testID="export-pdf-button" onPress={onExport} hitSlop={10} style={styles.iconBtn}>
            <MaterialCommunityIcons name="file-pdf-box" size={24} color={COLORS.accent} />
          </Pressable>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 100 }}>
          {/* Meta fields */}
          <View style={styles.metaRow}>
            <Field
              testID="field-date"
              label="DATA"
              value={insp.date}
              placeholder="AAAA-MM-DD"
              onChangeText={(v) => updateInsp({ date: v })}
              style={{ flex: 1.2 }}
            />
            <Field
              testID="field-plate"
              label="PLACA"
              value={insp.plate}
              placeholder="ABC1D23"
              autoCapitalize="characters"
              onChangeText={(v) => updateInsp({ plate: v.toUpperCase() })}
              style={{ flex: 1 }}
            />
          </View>
          <View style={[styles.metaRow, { marginTop: SPACING.sm }]}>
            <Field
              testID="field-driver"
              label="CONDUTOR"
              value={insp.driver}
              placeholder="Nome do condutor"
              onChangeText={(v) => updateInsp({ driver: v })}
              style={{ flex: 1 }}
            />
          </View>

          {/* Model chips */}
          <Text style={styles.chipsLabel}>MODELO DO VEÍCULO</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {MODEL_KEYS.map((k) => {
              const active = insp.model === k;
              return (
                <Pressable
                  testID={`model-chip-${k}`}
                  key={k}
                  onPress={() => {
                    Haptics.selectionAsync();
                    updateInsp({ model: k });
                  }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {CAR_PHOTOS[k].label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* View tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsRow}
          >
            {VIEWS.map((v) => {
              const active = activeView === v.id;
              const count = insp.markers.filter((m) => m.view === v.id).length;
              return (
                <Pressable
                  testID={`tab-${v.id}`}
                  key={v.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setActiveView(v.id);
                  }}
                  style={[styles.tab, active && styles.tabActive]}
                >
                  <Text style={[styles.tabText, active && styles.tabTextActive]}>
                    {v.label.toUpperCase()}
                  </Text>
                  {count > 0 && (
                    <View style={[styles.tabBadge, active && { backgroundColor: COLORS.bg }]}>
                      <Text style={[styles.tabBadgeText, active && { color: COLORS.accent }]}>{count}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Canvas */}
          <View style={styles.canvasCard}>
            <Pressable
              testID="canvas"
              onPress={handleCanvasTap}
              onLayout={(e) =>
                setCanvasSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
              }
              style={[styles.canvas, { aspectRatio }]}
            >
              {currentImg?.src ? (
                <Image
                  source={{ uri: currentImg.src }}
                  style={StyleSheet.absoluteFill}
                  contentFit="contain"
                  cachePolicy="memory"
                />
              ) : (
                <View style={styles.canvasPlaceholder}>
                  <MaterialCommunityIcons name="car-side" size={64} color={COLORS.surface3} />
                  <Text style={styles.canvasPlaceholderText}>SEM IMAGEM</Text>
                </View>
              )}

              {/* Pins */}
              {markersInView.map((m) => {
                const globalIdx = insp.markers.indexOf(m) + 1;
                const color = DAMAGE_TYPES[m.type].color;
                return (
                  <Pressable
                    testID={`pin-${m.id}`}
                    key={m.id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setActiveMarker(m);
                    }}
                    style={[
                      styles.pin,
                      {
                        left: `${m.x * 100}%`,
                        top: `${m.y * 100}%`,
                        backgroundColor: color,
                      },
                    ]}
                  >
                    <Text style={styles.pinText}>{globalIdx}</Text>
                  </Pressable>
                );
              })}
            </Pressable>
            <Text style={styles.canvasHint}>Toque em qualquer ponto do desenho para marcar uma avaria</Text>
            <View style={styles.legend}>
              {Object.entries(DAMAGE_TYPES).map(([key, val]) => (
                <View style={styles.legendItem} key={key}>
                  <View style={[styles.legendDot, { backgroundColor: val.color }]} />
                  <Text style={styles.legendText}>{val.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Marker list */}
          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>PONTOS MARCADOS</Text>
            <Text style={styles.listMeta}>{insp.markers.length}</Text>
          </View>

          {insp.markers.length === 0 ? (
            <Text style={styles.emptyMarkers}>
              Nenhum ponto marcado ainda. Toque no desenho do veículo acima.
            </Text>
          ) : (
            insp.markers.map((m, idx) => {
              const dt = DAMAGE_TYPES[m.type];
              const viewLabel = VIEWS.find((v) => v.id === m.view)?.label;
              return (
                <Pressable
                  testID={`marker-row-${m.id}`}
                  key={m.id}
                  style={styles.markerRow}
                  onPress={() => setActiveMarker(m)}
                >
                  <View style={[styles.markerNum, { backgroundColor: dt.color }]}>
                    <Text style={styles.markerNumText}>{idx + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.markerType}>
                      {dt.label.toUpperCase()} <Text style={styles.markerView}>· {viewLabel?.toUpperCase()}</Text>
                    </Text>
                    <Text style={styles.markerNote} numberOfLines={1}>
                      {m.note || "Sem observação"}
                    </Text>
                  </View>
                  {m.photo && (
                    <Pressable
                      testID={`marker-photo-${m.id}`}
                      onPress={() => setPhotoModal(m.photo!)}
                      hitSlop={6}
                    >
                      <Image source={{ uri: m.photo }} style={styles.markerThumb} contentFit="cover" />
                    </Pressable>
                  )}
                </Pressable>
              );
            })
          )}
        </ScrollView>

        {/* Bottom action bar */}
        <View style={styles.bottomBar}>
          <Pressable
            testID="save-inspection-button"
            style={({ pressed }) => [styles.saveBtn, pressed && { backgroundColor: COLORS.accentDim }]}
            onPress={onSave}
          >
            <MaterialCommunityIcons name="content-save" size={20} color={COLORS.bg} />
            <Text style={styles.saveBtnText}>SALVAR VISTORIA</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Marker detail sheet */}
      <MarkerSheet
        marker={activeMarker}
        index={activeMarker ? insp.markers.findIndex((m) => m.id === activeMarker.id) + 1 : 0}
        onClose={() => setActiveMarker(null)}
        onUpdate={updateMarker}
        onDelete={deleteMarker}
        onPickPhoto={pickPhoto}
        onViewPhoto={(uri) => setPhotoModal(uri)}
      />

      {/* Photo Lightbox */}
      <Modal
        visible={!!photoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoModal(null)}
      >
        <Pressable style={styles.lightboxBg} onPress={() => setPhotoModal(null)}>
          {photoModal && (
            <Image source={{ uri: photoModal }} style={styles.lightboxImg} contentFit="contain" />
          )}
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

/* -------------------- Components -------------------- */

function Field({
  label,
  testID,
  style,
  ...rest
}: {
  label: string;
  testID?: string;
  style?: any;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={[{ flexDirection: "column" }, style]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        testID={testID}
        placeholderTextColor={COLORS.inkDim}
        style={styles.input}
        {...rest}
      />
    </View>
  );
}

function MarkerSheet({
  marker,
  index,
  onClose,
  onUpdate,
  onDelete,
  onPickPhoto,
  onViewPhoto,
}: {
  marker: Marker | null;
  index: number;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Marker>) => void;
  onDelete: (id: string) => void;
  onPickPhoto: (id: string) => void;
  onViewPhoto: (uri: string) => void;
}) {
  return (
    <Modal
      visible={!!marker}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID="marker-sheet"
    >
      <Pressable style={styles.sheetBg} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {marker && (
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <View
                  style={[
                    styles.sheetPin,
                    { backgroundColor: DAMAGE_TYPES[marker.type].color },
                  ]}
                >
                  <Text style={styles.sheetPinText}>{index}</Text>
                </View>
                <Text style={styles.sheetTitle}>PONTO Nº {index}</Text>
                <Pressable onPress={onClose} hitSlop={10}>
                  <MaterialCommunityIcons name="close" size={24} color={COLORS.inkDim} />
                </Pressable>
              </View>

              <Text style={styles.sheetSection}>TIPO DE AVARIA</Text>
              <View style={styles.damageGrid}>
                {(Object.entries(DAMAGE_TYPES) as [DamageType, typeof DAMAGE_TYPES[DamageType]][]).map(
                  ([key, val]) => {
                    const active = marker.type === key;
                    return (
                      <Pressable
                        testID={`damage-type-${key}`}
                        key={key}
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          onUpdate(marker.id, { type: key });
                        }}
                        style={[
                          styles.damageChip,
                          { borderColor: val.color },
                          active && { backgroundColor: val.color },
                        ]}
                      >
                        <View style={[styles.damageDot, { backgroundColor: val.color }]} />
                        <Text style={[styles.damageText, active && { color: "#fff", fontWeight: "700" }]}>
                          {val.label}
                        </Text>
                      </Pressable>
                    );
                  }
                )}
              </View>

              <Text style={styles.sheetSection}>OBSERVAÇÃO</Text>
              <TextInput
                testID="marker-note"
                style={styles.noteInput}
                value={marker.note}
                onChangeText={(v) => onUpdate(marker.id, { note: v })}
                placeholder="Descreva a avaria"
                placeholderTextColor={COLORS.inkDim}
                multiline
              />

              <Text style={styles.sheetSection}>FOTO</Text>
              <View style={styles.photoRow}>
                {marker.photo ? (
                  <>
                    <Pressable
                      testID="marker-photo-thumb"
                      onPress={() => onViewPhoto(marker.photo!)}
                    >
                      <Image source={{ uri: marker.photo }} style={styles.photoThumb} contentFit="cover" />
                    </Pressable>
                    <Pressable
                      testID="marker-photo-replace"
                      onPress={() => onPickPhoto(marker.id)}
                      style={styles.photoBtn}
                    >
                      <MaterialCommunityIcons name="camera-retake" size={18} color={COLORS.accent} />
                      <Text style={styles.photoBtnText}>SUBSTITUIR</Text>
                    </Pressable>
                    <Pressable
                      testID="marker-photo-remove"
                      onPress={() => onUpdate(marker.id, { photo: undefined })}
                      style={styles.photoBtn}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={18} color={COLORS.error} />
                      <Text style={[styles.photoBtnText, { color: COLORS.error }]}>REMOVER</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    testID="marker-photo-add"
                    onPress={() => onPickPhoto(marker.id)}
                    style={styles.photoAdd}
                  >
                    <MaterialCommunityIcons name="camera-plus" size={28} color={COLORS.accent} />
                    <Text style={styles.photoBtnText}>ANEXAR FOTO</Text>
                  </Pressable>
                )}
              </View>

              <Pressable
                testID="marker-delete"
                onPress={() => onDelete(marker.id)}
                style={styles.deleteBtn}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={COLORS.error} />
                <Text style={styles.deleteBtnText}>EXCLUIR PONTO</Text>
              </Pressable>
            </KeyboardAvoidingView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* -------------------- Styles -------------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  loadingText: {
    color: COLORS.inkDim,
    fontFamily: FONTS.mono,
    textAlign: "center",
    marginTop: 60,
    letterSpacing: 2,
  },
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
  headerTitle: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.ink,
    letterSpacing: 1.5,
    fontWeight: "800",
  },
  headerSub: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.inkDim,
    letterSpacing: 1.5,
    marginTop: 1,
  },
  metaRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  fieldLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.inkDim,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
    color: COLORS.ink,
    fontFamily: FONTS.mono,
    fontSize: 13,
  },
  chipsLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.inkDim,
    letterSpacing: 1.5,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  chipsRow: { paddingHorizontal: SPACING.lg, gap: SPACING.sm },
  chip: {
    paddingHorizontal: SPACING.md,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.line,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  chipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  chipText: {
    fontFamily: FONTS.display,
    fontSize: 12,
    color: COLORS.inkDim,
    letterSpacing: 0.5,
    fontWeight: "700",
  },
  chipTextActive: { color: COLORS.bg },
  tabsRow: {
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
    gap: SPACING.xs,
  },
  tab: {
    paddingHorizontal: SPACING.md,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: "transparent",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 0,
  },
  tabActive: { borderBottomColor: COLORS.accent },
  tabText: {
    fontFamily: FONTS.display,
    fontSize: 12,
    color: COLORS.inkDim,
    letterSpacing: 1.2,
    fontWeight: "700",
  },
  tabTextActive: { color: COLORS.accent },
  tabBadge: {
    backgroundColor: COLORS.accent,
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  tabBadgeText: {
    color: COLORS.bg,
    fontFamily: FONTS.mono,
    fontSize: 10,
    fontWeight: "700",
  },
  canvasCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    backgroundColor: COLORS.paper,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  canvas: {
    width: "100%",
    backgroundColor: COLORS.paper,
    overflow: "hidden",
  },
  canvasPlaceholder: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  canvasPlaceholderText: {
    fontFamily: FONTS.mono,
    color: COLORS.inkDim,
    letterSpacing: 2,
  },
  canvasHint: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: "#5a5a5a",
    textAlign: "center",
    marginTop: SPACING.sm,
    letterSpacing: 0.5,
  },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: SPACING.md,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: "#d5d3ce",
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: FONTS.mono, fontSize: 10, color: "#3a3a3a" },
  pin: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    marginLeft: -13,
    marginTop: -13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  pinText: {
    color: "#fff",
    fontFamily: FONTS.display,
    fontWeight: "800",
    fontSize: 12,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    paddingBottom: SPACING.sm,
  },
  listTitle: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.ink,
    letterSpacing: 2,
    fontWeight: "700",
  },
  listMeta: {
    fontFamily: FONTS.display,
    fontSize: 18,
    color: COLORS.accent,
    fontWeight: "800",
  },
  emptyMarkers: {
    fontFamily: FONTS.text,
    color: COLORS.inkDim,
    fontSize: 12,
    textAlign: "center",
    paddingHorizontal: SPACING.lg,
    fontStyle: "italic",
    marginTop: SPACING.md,
  },
  markerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: SPACING.md,
  },
  markerNum: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  markerNumText: { color: "#fff", fontFamily: FONTS.display, fontWeight: "800", fontSize: 14 },
  markerType: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.ink,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  markerView: { color: COLORS.inkDim, fontSize: 11 },
  markerNote: { fontFamily: FONTS.text, color: COLORS.inkDim, fontSize: 12, marginTop: 2 },
  markerThumb: { width: 44, height: 44, borderRadius: RADIUS.sm },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: SPACING.md,
    backgroundColor: COLORS.bg,
    borderTopWidth: 1,
    borderTopColor: COLORS.line,
  },
  saveBtn: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: RADIUS.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
  },
  saveBtnText: {
    fontFamily: FONTS.display,
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 1.5,
    color: COLORS.bg,
  },

  /* Sheet */
  sheetBg: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: SPACING.lg,
    paddingBottom: SPACING["2xl"],
    borderTopWidth: 3,
    borderTopColor: COLORS.accent,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.line,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: SPACING.md,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  sheetPin: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  sheetPinText: { color: "#fff", fontFamily: FONTS.display, fontWeight: "800", fontSize: 16 },
  sheetTitle: {
    flex: 1,
    fontFamily: FONTS.display,
    fontSize: 16,
    color: COLORS.ink,
    letterSpacing: 1.5,
    fontWeight: "800",
  },
  sheetSection: {
    fontFamily: FONTS.mono,
    fontSize: 10,
    color: COLORS.inkDim,
    letterSpacing: 1.5,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  damageGrid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  damageChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    backgroundColor: COLORS.surface2,
  },
  damageDot: { width: 10, height: 10, borderRadius: 5 },
  damageText: { fontFamily: FONTS.text, fontSize: 12, color: COLORS.ink },
  noteInput: {
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    color: COLORS.ink,
    fontFamily: FONTS.text,
    fontSize: 13,
    minHeight: 60,
    textAlignVertical: "top",
  },
  photoRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap" },
  photoThumb: { width: 64, height: 64, borderRadius: RADIUS.md },
  photoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface2,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  photoBtnText: {
    fontFamily: FONTS.mono,
    fontSize: 11,
    color: COLORS.accent,
    letterSpacing: 0.5,
  },
  photoAdd: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    paddingVertical: 16,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderStyle: "dashed",
    backgroundColor: COLORS.surface2,
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
  deleteBtnText: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: COLORS.error,
    letterSpacing: 1.5,
    fontWeight: "800",
  },

  /* Lightbox */
  lightboxBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
  },
  lightboxImg: { width: "100%", height: "80%" },
});
