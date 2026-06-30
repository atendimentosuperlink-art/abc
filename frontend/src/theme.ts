import { Platform } from "react-native";

export const COLORS = {
  bg: "#1c1c1e",
  surface: "#262628",
  surface2: "#2f2f32",
  surface3: "#323235",
  line: "#3a3a3d",
  lineStrong: "#525256",
  divider: "#2f2f32",
  paper: "#e8e6e1",
  ink: "#f2f0eb",
  inkDim: "#a3a19b",
  accent: "#ff6b35",
  accentDim: "#c4522a",
  success: "#4CAF50",
  error: "#e5484d",
  // damage types
  rust: "#a8702f",
  dent: "#4a90d9",
  scratch: "#f2c94c",
  broken: "#e5484d",
  other: "#9b9b9b",
};

export const FONTS = {
  display: Platform.select({ ios: "Impact", android: "sans-serif-condensed", default: "System" }) as string,
  mono: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }) as string,
  text: Platform.select({ ios: "System", android: "sans-serif", default: "System" }) as string,
};

export const RADIUS = { sm: 2, md: 4, lg: 8, pill: 999 };
export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, "2xl": 32 };

export const DAMAGE_TYPES = {
  ferrugem: { label: "Ferrugem", color: COLORS.rust },
  amassado: { label: "Amassado", color: COLORS.dent },
  arranhao: { label: "Arranhão", color: COLORS.scratch },
  quebrado: { label: "Quebrado", color: COLORS.broken },
  outro: { label: "Outro", color: COLORS.other },
} as const;

export type DamageType = keyof typeof DAMAGE_TYPES;

export const VIEWS = [
  { id: "topo", label: "Topo" },
  { id: "frente", label: "Frente" },
  { id: "tras", label: "Traseira" },
  { id: "esq", label: "Lat. Esq." },
  { id: "dir", label: "Lat. Dir." },
] as const;

export type ViewId = (typeof VIEWS)[number]["id"];
