import {
  DESIGN_PRESETS,
  detectPreset,
  isDesignPreset,
  resolveDesignSystem,
} from "../design";
import type { DesignPresetId, DesignSystem } from "../types";

/** Backward-compatible helper used by the AI layer when no model is configured. */
export function DETECTED_PRESET_FALLBACK(text?: string): DesignPresetId {
  if (!text?.trim()) return "modern-editorial";
  if (isDesignPreset(text.trim())) return text.trim() as DesignPresetId;
  return detectPreset(text);
}

export function resolveRequestedDesign(
  input?: Partial<DesignSystem> | null,
  preset?: string | DesignPresetId | null,
  instruction?: string,
): DesignSystem {
  const detected = preset
    ? DETECTED_PRESET_FALLBACK(String(preset))
    : instruction
      ? DETECTED_PRESET_FALLBACK(instruction)
      : undefined;
  return resolveDesignSystem(input, detected);
}

export function presetOptions() {
  return Object.values(DESIGN_PRESETS).map((preset) => ({
    id: preset.preset,
    name: preset.name,
    mode: preset.mode,
    accent: preset.palette.accent,
    bg: preset.palette.bg,
    motif: preset.motif ?? "plain",
  }));
}
