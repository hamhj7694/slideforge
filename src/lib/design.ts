import type { DesignPresetId, DesignSystem } from "./types";

const SANS = '"Inter", "Noto Sans KR", system-ui, sans-serif';
const SERIF = '"Instrument Serif", "Noto Serif KR", Georgia, serif';
const KR_SERIF = '"Noto Serif KR", "Instrument Serif", Georgia, serif';
const GROTESK = '"Space Grotesk", "Noto Sans KR", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", monospace';

export const DESIGN_PRESETS: Record<DesignPresetId, DesignSystem> = {
  "swiss-editorial": {
    preset: "swiss-editorial",
    name: "Swiss Editorial",
    mode: "light",
    palette: {
      bg: "#F3F0E8",
      surface: "#E9E4D8",
      ink: "#151514",
      muted: "#706C61",
      accent: "#D8452D",
      accentSoft: "#EFD9D2",
      line: "#D3CDC0",
    },
    typography: {
      displayFont: GROTESK,
      bodyFont: SANS,
      displayWeight: 500,
      bodyWeight: 400,
      displayTracking: "-0.045em",
      headingScale: 1,
      bodyScale: 1,
      lineHeight: 1.55,
    },
    grid: { margin: 76, gutter: 28, columns: 12 },
    shape: { radius: 0, rule: 1 },
    image: { treatment: "warm", overlay: 0.18 },
    details: { pageNumber: "index", footer: true, kicker: true },
  },
  "modern-editorial": {
    preset: "modern-editorial",
    name: "Modern Editorial",
    mode: "light",
    palette: {
      bg: "#F7F5F1",
      surface: "#EDE9E1",
      ink: "#1A1A18",
      muted: "#727067",
      accent: "#2F5D50",
      accentSoft: "#DDE8E2",
      line: "#DAD5CB",
    },
    typography: {
      displayFont: SERIF,
      bodyFont: SANS,
      displayWeight: 400,
      bodyWeight: 400,
      displayTracking: "-0.025em",
      headingScale: 1.02,
      bodyScale: 1,
      lineHeight: 1.6,
    },
    grid: { margin: 84, gutter: 32, columns: 12 },
    shape: { radius: 2, rule: 1 },
    image: { treatment: "warm", overlay: 0.2 },
    details: { pageNumber: "fraction", footer: true, kicker: true },
  },
  "minimal-corporate": {
    preset: "minimal-corporate",
    name: "Minimal Corporate",
    mode: "light",
    palette: {
      bg: "#FAFAF8",
      surface: "#F1F2F0",
      ink: "#12161D",
      muted: "#69707B",
      accent: "#1E4FD8",
      accentSoft: "#E3E9FA",
      line: "#DFE1E4",
    },
    typography: {
      displayFont: SANS,
      bodyFont: SANS,
      displayWeight: 600,
      bodyWeight: 400,
      displayTracking: "-0.03em",
      headingScale: 0.96,
      bodyScale: 1,
      lineHeight: 1.58,
    },
    grid: { margin: 80, gutter: 28, columns: 12 },
    shape: { radius: 4, rule: 1 },
    image: { treatment: "none", overlay: 0.12 },
    details: { pageNumber: "index", footer: true, kicker: true },
  },
  "tech-product": {
    preset: "tech-product",
    name: "Tech Product",
    mode: "light",
    palette: {
      bg: "#F4F6F8",
      surface: "#E8ECF1",
      ink: "#0A1220",
      muted: "#5F6875",
      accent: "#4F46E5",
      accentSoft: "#E2E0FB",
      line: "#D5DBE3",
    },
    typography: {
      displayFont: GROTESK,
      bodyFont: SANS,
      displayWeight: 600,
      bodyWeight: 400,
      displayTracking: "-0.05em",
      headingScale: 1,
      bodyScale: 0.98,
      lineHeight: 1.55,
    },
    grid: { margin: 76, gutter: 24, columns: 12 },
    shape: { radius: 6, rule: 1 },
    image: { treatment: "mono", overlay: 0.24 },
    details: { pageNumber: "fraction", footer: true, kicker: true },
  },
  "premium-portfolio": {
    preset: "premium-portfolio",
    name: "Premium Portfolio",
    mode: "dark",
    palette: {
      bg: "#111110",
      surface: "#1C1C1A",
      ink: "#F2EDE2",
      muted: "#A6A094",
      accent: "#C8A96A",
      accentSoft: "#2B2820",
      line: "#34332E",
    },
    typography: {
      displayFont: KR_SERIF,
      bodyFont: SANS,
      displayWeight: 400,
      bodyWeight: 300,
      displayTracking: "-0.02em",
      headingScale: 1.04,
      bodyScale: 0.98,
      lineHeight: 1.65,
    },
    grid: { margin: 88, gutter: 32, columns: 12 },
    shape: { radius: 0, rule: 1 },
    image: { treatment: "warm", overlay: 0.4 },
    details: { pageNumber: "none", footer: true, kicker: true },
  },
  "data-story": {
    preset: "data-story",
    name: "Data Story",
    mode: "light",
    palette: {
      bg: "#FAFAF7",
      surface: "#F0F1EC",
      ink: "#101820",
      muted: "#65706C",
      accent: "#0F766E",
      accentSoft: "#DCEDE9",
      line: "#DDE0DA",
    },
    typography: {
      displayFont: SANS,
      bodyFont: SANS,
      displayWeight: 600,
      bodyWeight: 400,
      displayTracking: "-0.035em",
      headingScale: 0.94,
      bodyScale: 0.97,
      lineHeight: 1.55,
    },
    grid: { margin: 76, gutter: 24, columns: 12 },
    shape: { radius: 2, rule: 1 },
    image: { treatment: "none", overlay: 0.1 },
    details: { pageNumber: "fraction", footer: true, kicker: true },
  },
  magazine: {
    preset: "magazine",
    name: "Magazine",
    mode: "light",
    palette: {
      bg: "#FCFBF8",
      surface: "#F1EEE7",
      ink: "#0C0C0C",
      muted: "#6D6A63",
      accent: "#BB3A2F",
      accentSoft: "#F1DEDA",
      line: "#D8D4CB",
    },
    typography: {
      displayFont: SERIF,
      bodyFont: SANS,
      displayWeight: 400,
      bodyWeight: 400,
      displayTracking: "-0.02em",
      headingScale: 1.06,
      bodyScale: 1,
      lineHeight: 1.6,
    },
    grid: { margin: 72, gutter: 30, columns: 12 },
    shape: { radius: 0, rule: 1 },
    image: { treatment: "warm", overlay: 0.16 },
    details: { pageNumber: "index", footer: true, kicker: true },
  },
};

export const PRESET_LIST = Object.values(DESIGN_PRESETS);

export function resolveDesignSystem(
  input?: Partial<DesignSystem> | null,
  preset?: DesignPresetId,
): DesignSystem {
  const base = DESIGN_PRESETS[preset ?? input?.preset ?? "modern-editorial"];
  if (!input) return structuredClone(base);
  return {
    ...structuredClone(base),
    ...input,
    palette: { ...base.palette, ...(input.palette ?? {}) },
    typography: { ...base.typography, ...(input.typography ?? {}) },
    grid: { ...base.grid, ...(input.grid ?? {}) },
    shape: { ...base.shape, ...(input.shape ?? {}) },
    image: { ...base.image, ...(input.image ?? {}) },
    details: { ...base.details, ...(input.details ?? {}) },
  };
}

export function designCssVars(d: DesignSystem): Record<string, string> {
  return {
    "--sf-bg": d.palette.bg,
    "--sf-surface": d.palette.surface,
    "--sf-ink": d.palette.ink,
    "--sf-muted": d.palette.muted,
    "--sf-accent": d.palette.accent,
    "--sf-accent-soft": d.palette.accentSoft,
    "--sf-line": d.palette.line,
    "--sf-display": d.typography.displayFont,
    "--sf-body": d.typography.bodyFont,
    "--sf-display-weight": String(d.typography.displayWeight),
    "--sf-body-weight": String(d.typography.bodyWeight),
    "--sf-tracking": d.typography.displayTracking,
    "--sf-heading-scale": String(d.typography.headingScale),
    "--sf-body-scale": String(d.typography.bodyScale),
    "--sf-leading": String(d.typography.lineHeight),
    "--sf-margin": `${d.grid.margin}px`,
    "--sf-gutter": `${d.grid.gutter}px`,
    "--sf-radius": `${d.shape.radius}px`,
    "--sf-rule": `${d.shape.rule}px`,
    "--sf-overlay": String(d.image.overlay),
  };
}

export function detectPreset(text: string): DesignPresetId {
  const t = text.toLowerCase();
  if (/swiss|스위스|국제주의|grid|그리드/.test(t)) return "swiss-editorial";
  if (/magazine|매거진|잡지|editorial|에디토리얼/.test(t)) return "magazine";
  if (/premium|프리미엄|luxury|럭셔리|portfolio|포트폴리오/.test(t))
    return "premium-portfolio";
  if (/tech|테크|product|프로덕트|saas|스타트업|개발/.test(t)) return "tech-product";
  if (/data|데이터|analytics|분석|report|리포트/.test(t)) return "data-story";
  if (/corporate|기업|b2b|비즈니스|minimal|미니멀/.test(t))
    return "minimal-corporate";
  return "modern-editorial";
}
