import { CAR_PHOTOS } from "./data/carPhotos";
import type { CustomVehicle } from "./storage";
import type { ViewId } from "./theme";

export type AnyVehicle = {
  key: string;
  label: string;
  isCustom: boolean;
  views: Partial<Record<ViewId, { src?: string; w?: number; h?: number }>>;
};

export function mergeVehicles(custom: CustomVehicle[]): AnyVehicle[] {
  const builtins: AnyVehicle[] = Object.entries(CAR_PHOTOS).map(([k, v]: [string, any]) => ({
    key: k,
    label: v.label,
    isCustom: false,
    views: v.views || {},
  }));
  const customs: AnyVehicle[] = custom.map((c) => ({
    key: c.key,
    label: c.label,
    isCustom: true,
    views: c.views || {},
  }));
  return [...builtins, ...customs];
}

export function getVehicle(custom: CustomVehicle[], key: string): AnyVehicle | undefined {
  return mergeVehicles(custom).find((v) => v.key === key);
}
