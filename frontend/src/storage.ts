import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DamageType, ViewId } from "./theme";

export type Marker = {
  id: string;
  view: ViewId;
  x: number; // 0..1 (relative to image width)
  y: number; // 0..1 (relative to image height)
  type: DamageType;
  note: string;
  photo?: string; // base64 data uri
};

export type SignaturePath = { d: string }; // SVG path "M x y L x y ..."

export type Inspection = {
  id: string;
  createdAt: string; // ISO
  date: string; // yyyy-mm-dd
  plate: string;
  driver: string;
  model: string; // car model key
  markers: Marker[];
  signature?: SignaturePath[]; // multi-stroke
};

export type CustomVehicleView = {
  src: string; // data:image/jpeg;base64,...
  w: number;
  h: number;
};

export type CustomVehicle = {
  key: string;
  label: string;
  createdAt: string;
  views: Partial<Record<ViewId, CustomVehicleView>>;
};

const KEY_HISTORY = "@vistoria/history/v1";
const KEY_DRAFT = "@vistoria/draft/v1";
const KEY_CUSTOM_VEHICLES = "@vistoria/customVehicles/v1";

export async function loadHistory(): Promise<Inspection[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_HISTORY);
    return raw ? (JSON.parse(raw) as Inspection[]) : [];
  } catch {
    return [];
  }
}

export async function saveInspection(insp: Inspection): Promise<void> {
  const list = await loadHistory();
  const idx = list.findIndex((i) => i.id === insp.id);
  if (idx >= 0) list[idx] = insp;
  else list.unshift(insp);
  await AsyncStorage.setItem(KEY_HISTORY, JSON.stringify(list));
}

export async function deleteInspection(id: string): Promise<void> {
  const list = await loadHistory();
  await AsyncStorage.setItem(KEY_HISTORY, JSON.stringify(list.filter((i) => i.id !== id)));
}

export async function loadDraft(): Promise<Inspection | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY_DRAFT);
    return raw ? (JSON.parse(raw) as Inspection) : null;
  } catch {
    return null;
  }
}

export async function saveDraft(insp: Inspection): Promise<void> {
  await AsyncStorage.setItem(KEY_DRAFT, JSON.stringify(insp));
}

export async function clearDraft(): Promise<void> {
  await AsyncStorage.removeItem(KEY_DRAFT);
}

export async function loadCustomVehicles(): Promise<CustomVehicle[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_CUSTOM_VEHICLES);
    return raw ? (JSON.parse(raw) as CustomVehicle[]) : [];
  } catch {
    return [];
  }
}

export async function saveCustomVehicles(list: CustomVehicle[]): Promise<void> {
  await AsyncStorage.setItem(KEY_CUSTOM_VEHICLES, JSON.stringify(list));
}

export async function upsertCustomVehicle(v: CustomVehicle): Promise<CustomVehicle[]> {
  const list = await loadCustomVehicles();
  const idx = list.findIndex((x) => x.key === v.key);
  if (idx >= 0) list[idx] = v;
  else list.unshift(v);
  await saveCustomVehicles(list);
  return list;
}

export async function deleteCustomVehicle(key: string): Promise<CustomVehicle[]> {
  const list = await loadCustomVehicles();
  const next = list.filter((v) => v.key !== key);
  await saveCustomVehicles(next);
  return next;
}

export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
