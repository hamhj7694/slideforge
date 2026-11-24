import type { DesignPresetId, DesignSystem } from "./types";

const SANS = '"Inter", "Noto Sans KR", system-ui, sans-serif';
const SERIF = '"Instrument Serif", "Noto Serif KR", Georgia, serif';
const KR_SERIF = '"Noto Serif KR", "Instrument Serif", Georgia, serif';
const GROTESK = '"Space Grotesk", "Noto Sans KR", system-ui, sans-serif';
const MONO = '"IBM Plex Mono", monospace';

type PresetSeed = Omit<DesignSystem, "preset" | "grid" | "shape" | "details"> & {
  grid?: Partial<DesignSystem["grid"]>;
  shape?: Partial<DesignSystem["shape"]>;
  details?: Partial<DesignSystem["details"]>;
};

function seed(preset: DesignPresetId, value: PresetSeed): DesignSystem {
  return {
    ...value,
    preset,
    grid: { margin: 76, gutter: 28, columns: 12, ...(value.grid ?? {}) },
    shape: { radius: 0, rule: 1, ...(value.shape ?? {}) },
    details: { pageNumber: "index", footer: true, kicker: true, ...(value.details ?? {}) },
  };
}

const ORIGINAL: Record<string, DesignSystem> = {
  "swiss-editorial": {
    preset: "swiss-editorial",
    name: "Swiss Editorial",
    mode: "light",
    palette: {
      bg: "#F3F0E8", surface: "#E9E4D8", ink: "#151514", muted: "#706C61",
      accent: "#D8452D", accentSoft: "#EFD9D2", line: "#D3CDC0",
    },
    typography: {
      displayFont: GROTESK, bodyFont: SANS, displayWeight: 500, bodyWeight: 400,
      displayTracking: "-0.045em", headingScale: 1, bodyScale: 1, lineHeight: 1.55,
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
      bg: "#F7F5F1", surface: "#EDE9E1", ink: "#1A1A18", muted: "#727067",
      accent: "#2F5D50", accentSoft: "#DDE8E2", line: "#DAD5CB",
    },
    typography: {
      displayFont: SERIF, bodyFont: SANS, displayWeight: 400, bodyWeight: 400,
      displayTracking: "-0.025em", headingScale: 1.02, bodyScale: 1, lineHeight: 1.6,
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
      bg: "#FAFAF8", surface: "#F1F2F0", ink: "#12161D", muted: "#69707B",
      accent: "#1E4FD8", accentSoft: "#E3E9FA", line: "#DFE1E4",
    },
    typography: {
      displayFont: SANS, bodyFont: SANS, displayWeight: 600, bodyWeight: 400,
      displayTracking: "-0.03em", headingScale: 0.96, bodyScale: 1, lineHeight: 1.58,
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
      bg: "#F4F6F8", surface: "#E8ECF1", ink: "#0A1220", muted: "#5F6875",
      accent: "#4F46E5", accentSoft: "#E2E0FB", line: "#D5DBE3",
    },
    typography: {
      displayFont: GROTESK, bodyFont: SANS, displayWeight: 600, bodyWeight: 400,
      displayTracking: "-0.05em", headingScale: 1, bodyScale: 0.98, lineHeight: 1.55,
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
      bg: "#111110", surface: "#1C1C1A", ink: "#F2EDE2", muted: "#A6A094",
      accent: "#C8A96A", accentSoft: "#2B2820", line: "#34332E",
    },
    typography: {
      displayFont: KR_SERIF, bodyFont: SANS, displayWeight: 400, bodyWeight: 300,
      displayTracking: "-0.02em", headingScale: 1.04, bodyScale: 0.98, lineHeight: 1.65,
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
      bg: "#FAFAF7", surface: "#F0F1EC", ink: "#101820", muted: "#65706C",
      accent: "#0F766E", accentSoft: "#DCEDE9", line: "#DDE0DA",
    },
    typography: {
      displayFont: SANS, bodyFont: SANS, displayWeight: 600, bodyWeight: 400,
      displayTracking: "-0.035em", headingScale: 0.94, bodyScale: 0.97, lineHeight: 1.55,
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
      bg: "#FCFBF8", surface: "#F1EEE7", ink: "#0C0C0C", muted: "#6D6A63",
      accent: "#BB3A2F", accentSoft: "#F1DEDA", line: "#D8D4CB",
    },
    typography: {
      displayFont: SERIF, bodyFont: SANS, displayWeight: 400, bodyWeight: 400,
      displayTracking: "-0.02em", headingScale: 1.06, bodyScale: 1, lineHeight: 1.6,
    },
    grid: { margin: 72, gutter: 30, columns: 12 },
    shape: { radius: 0, rule: 1 },
    image: { treatment: "warm", overlay: 0.16 },
    details: { pageNumber: "index", footer: true, kicker: true },
  },
};

/** The 20 additional styles the user explicitly asked to keep selectable. */
const EXTENDED: Record<string, DesignSystem> = {
  minimalism: seed("minimalism", {
    name: "Minimalism · 미니멀리즘", mode: "light",
    palette: { bg: "#FFFFFF", surface: "#F5F5F4", ink: "#111111", muted: "#8A8A88", accent: "#2E6BE6", accentSoft: "#E8F0FE", line: "#E5E5E3" },
    typography: { displayFont: SANS, bodyFont: SANS, displayWeight: 500, bodyWeight: 400, displayTracking: "-0.05em", headingScale: 0.98, bodyScale: 0.98, lineHeight: 1.7 },
    grid: { margin: 104, gutter: 36 }, image: { treatment: "none", overlay: 0.06 },
    details: { pageNumber: "none", footer: false },
  }),
  editorial: seed("editorial", {
    name: "Editorial · 에디토리얼", mode: "light",
    palette: { bg: "#FBF8F3", surface: "#F0EAE0", ink: "#191713", muted: "#777165", accent: "#B3452E", accentSoft: "#F1DED6", line: "#DDD4C7" },
    typography: { displayFont: SERIF, bodyFont: SANS, displayWeight: 400, bodyWeight: 400, displayTracking: "-0.02em", headingScale: 1.08, bodyScale: 1, lineHeight: 1.66 },
    grid: { margin: 92, gutter: 34 }, image: { treatment: "warm", overlay: 0.18 },
    details: { pageNumber: "index", footer: true },
  }),
  "swiss-style": seed("swiss-style", {
    name: "Swiss Style · 스위스 스타일", mode: "light",
    palette: { bg: "#F2F2F0", surface: "#E5E5E1", ink: "#0D0D0D", muted: "#6B6B66", accent: "#E63329", accentSoft: "#F6DAD7", line: "#CFCFC9" },
    typography: { displayFont: GROTESK, bodyFont: GROTESK, displayWeight: 700, bodyWeight: 400, displayTracking: "-0.06em", headingScale: 1.04, bodyScale: 0.96, lineHeight: 1.45 },
    grid: { margin: 64, gutter: 20 }, shape: { rule: 2 }, image: { treatment: "mono", overlay: 0.12 },
    details: { pageNumber: "index", footer: true }, motif: "grid",
  }),
  "bento-grid": seed("bento-grid", {
    name: "Bento Grid · 벤토 그리드", mode: "light",
    palette: { bg: "#F4F5F7", surface: "#FFFFFF", ink: "#182033", muted: "#68738A", accent: "#6C5CE7", accentSoft: "#E9E6FF", line: "#DDE1E9" },
    typography: { displayFont: GROTESK, bodyFont: SANS, displayWeight: 700, bodyWeight: 500, displayTracking: "-0.04em", headingScale: 0.94, bodyScale: 0.96, lineHeight: 1.5 },
    grid: { margin: 60, gutter: 16 }, shape: { radius: 22, rule: 1 }, image: { treatment: "none", overlay: 0.1 },
    details: { pageNumber: "none", footer: false }, motif: "bento",
  }),
  glassmorphism: seed("glassmorphism", {
    name: "Glassmorphism · 글래스모피즘", mode: "dark",
    palette: { bg: "#101A33", surface: "#22315B", ink: "#F4F7FF", muted: "#A9B6D6", accent: "#67E8F9", accentSoft: "#22495B", line: "#41527E" },
    typography: { displayFont: SANS, bodyFont: SANS, displayWeight: 600, bodyWeight: 400, displayTracking: "-0.03em", headingScale: 1, bodyScale: 1, lineHeight: 1.6 },
    grid: { margin: 76, gutter: 24 }, shape: { radius: 24, rule: 1 }, image: { treatment: "duotone", overlay: 0.3 },
    details: { pageNumber: "none", footer: true }, motif: "glass",
  }),
  claymorphism: seed("claymorphism", {
    name: "Claymorphism · 클레이모피즘", mode: "light",
    palette: { bg: "#F6EFE8", surface: "#FFF9F3", ink: "#3B2E28", muted: "#927C6F", accent: "#C46B4A", accentSoft: "#F3DDD2", line: "#E6D6C9" },
    typography: { displayFont: GROTESK, bodyFont: SANS, displayWeight: 700, bodyWeight: 500, displayTracking: "-0.03em", headingScale: 0.94, bodyScale: 1, lineHeight: 1.6 },
    grid: { margin: 76, gutter: 24 }, shape: { radius: 30, rule: 1 }, image: { treatment: "warm", overlay: 0.14 },
    details: { pageNumber: "none", footer: false }, motif: "clay",
  }),
  "neo-brutalism": seed("neo-brutalism", {
    name: "Neo Brutalism · 네오 브루탈리즘", mode: "light",
    palette: { bg: "#FFFDF5", surface: "#FFE95C", ink: "#0B0B0B", muted: "#4D4D4D", accent: "#111111", accentSoft: "#F2C7C0", line: "#111111" },
    typography: { displayFont: GROTESK, bodyFont: MONO, displayWeight: 700, bodyWeight: 600, displayTracking: "-0.055em", headingScale: 1.12, bodyScale: 1, lineHeight: 1.35 },
    grid: { margin: 60, gutter: 20 }, shape: { radius: 0, rule: 3 }, image: { treatment: "mono", overlay: 0.08 },
    details: { pageNumber: "index", footer: true }, motif: "brutal",
  }),
  maximalism: seed("maximalism", {
    name: "Maximalism · 맥시멀리즘", mode: "dark",
    palette: { bg: "#1B1024", surface: "#30203B", ink: "#FFF2E6", muted: "#C7A9C9", accent: "#F45B8C", accentSoft: "#5A2546", line: "#5C3B5F" },
    typography: { displayFont: SERIF, bodyFont: SANS, displayWeight: 400, bodyWeight: 500, displayTracking: "-0.02em", headingScale: 1.18, bodyScale: 0.96, lineHeight: 1.45 },
    grid: { margin: 60, gutter: 18 }, shape: { radius: 0, rule: 2 }, image: { treatment: "duotone", overlay: 0.34 },
    details: { pageNumber: "fraction", footer: true }, motif: "maximal",
  }),
  "kinetic-typography": seed("kinetic-typography", {
    name: "Kinetic Typography · 키네틱 타이포그래피", mode: "dark",
    palette: { bg: "#0A0A0A", surface: "#1D1D1D", ink: "#FFFFFF", muted: "#9A9A9A", accent: "#D6FF3F", accentSoft: "#303A15", line: "#3A3A3A" },
    typography: { displayFont: GROTESK, bodyFont: MONO, displayWeight: 700, bodyWeight: 400, displayTracking: "-0.08em", headingScale: 1.35, bodyScale: 0.94, lineHeight: 1.2 },
    grid: { margin: 56, gutter: 18 }, shape: { radius: 0, rule: 2 }, image: { treatment: "mono", overlay: 0.42 },
    details: { pageNumber: "none", footer: false }, motif: "kinetic",
  }),
  "grainy-gradient": seed("grainy-gradient", {
    name: "Grainy Gradient · 그레이니 그라디언트", mode: "dark",
    palette: { bg: "#1E1836", surface: "#33245A", ink: "#F8F4FF", muted: "#B8ABD6", accent: "#F9A26C", accentSoft: "#543A65", line: "#4E3E73" },
    typography: { displayFont: GROTESK, bodyFont: SANS, displayWeight: 600, bodyWeight: 400, displayTracking: "-0.04em", headingScale: 1.06, bodyScale: 1, lineHeight: 1.55 },
    grid: { margin: 76, gutter: 28 }, shape: { radius: 16, rule: 1 }, image: { treatment: "warm", overlay: 0.26 },
    details: { pageNumber: "none", footer: true }, motif: "grain",
  }),
  "y2k-chrome": seed("y2k-chrome", {
    name: "Y2K Chrome · Y2K 크롬", mode: "dark",
    palette: { bg: "#0E1524", surface: "#24304A", ink: "#EAF2FF", muted: "#9FB3D1", accent: "#8FD8FF", accentSoft: "#2C4D6B", line: "#4E6488" },
    typography: { displayFont: GROTESK, bodyFont: MONO, displayWeight: 700, bodyWeight: 400, displayTracking: "-0.04em", headingScale: 1.1, bodyScale: 0.94, lineHeight: 1.4 },
    grid: { margin: 68, gutter: 22 }, shape: { radius: 8, rule: 2 }, image: { treatment: "duotone", overlay: 0.28 },
    details: { pageNumber: "fraction", footer: true }, motif: "chrome",
  }),
  "pixel-art": seed("pixel-art", {
    name: "Pixel Art · 픽셀 아트", mode: "dark",
    palette: { bg: "#12120F", surface: "#23231C", ink: "#F2F4D8", muted: "#9DA07E", accent: "#B6F34A", accentSoft: "#33421C", line: "#4E513B" },
    typography: { displayFont: MONO, bodyFont: MONO, displayWeight: 700, bodyWeight: 500, displayTracking: "-0.02em", headingScale: 0.96, bodyScale: 0.92, lineHeight: 1.5 },
    grid: { margin: 64, gutter: 20 }, shape: { radius: 0, rule: 3 }, image: { treatment: "mono", overlay: 0.16 },
    details: { pageNumber: "index", footer: true }, motif: "pixel",
  }),
  memphis: seed("memphis", {
    name: "Memphis · 멤피스", mode: "light",
    palette: { bg: "#FFF9EE", surface: "#FFE9D6", ink: "#20202A", muted: "#6F6B70", accent: "#F04E64", accentSoft: "#F9D9DE", line: "#E7D8C8" },
    typography: { displayFont: GROTESK, bodyFont: SANS, displayWeight: 700, bodyWeight: 600, displayTracking: "-0.035em", headingScale: 1.04, bodyScale: 0.98, lineHeight: 1.45 },
    grid: { margin: 68, gutter: 24 }, shape: { radius: 0, rule: 3 }, image: { treatment: "none", overlay: 0.1 },
    details: { pageNumber: "none", footer: false }, motif: "memphis",
  }),
  bauhaus: seed("bauhaus", {
    name: "Bauhaus · 바우하우스", mode: "light",
    palette: { bg: "#F4F0E6", surface: "#E8E0CE", ink: "#191919", muted: "#6E6A60", accent: "#D6402F", accentSoft: "#EFD8D2", line: "#CFC6B4" },
    typography: { displayFont: GROTESK, bodyFont: GROTESK, displayWeight: 700, bodyWeight: 500, displayTracking: "-0.05em", headingScale: 1.14, bodyScale: 0.98, lineHeight: 1.4 },
    grid: { margin: 64, gutter: 22 }, shape: { radius: 0, rule: 4 }, image: { treatment: "mono", overlay: 0.16 },
    details: { pageNumber: "none", footer: true }, motif: "bauhaus",
  }),
  "pop-art": seed("pop-art", {
    name: "Pop Art · 팝아트", mode: "light",
    palette: { bg: "#FFF426", surface: "#FFD1DC", ink: "#111111", muted: "#444444", accent: "#E62E5C", accentSoft: "#F8AFC3", line: "#111111" },
    typography: { displayFont: GROTESK, bodyFont: SANS, displayWeight: 700, bodyWeight: 700, displayTracking: "-0.06em", headingScale: 1.16, bodyScale: 1, lineHeight: 1.35 },
    grid: { margin: 60, gutter: 20 }, shape: { radius: 0, rule: 4 }, image: { treatment: "duotone", overlay: 0.12 },
    details: { pageNumber: "none", footer: false }, motif: "pop",
  }),
  collage: seed("collage", {
    name: "Collage · 콜라주", mode: "light",
    palette: { bg: "#F5F1E9", surface: "#EAE3D6", ink: "#22201C", muted: "#736D61", accent: "#2B5FA8", accentSoft: "#DDE5F0", line: "#CFC7B7" },
    typography: { displayFont: KR_SERIF, bodyFont: MONO, displayWeight: 400, bodyWeight: 400, displayTracking: "-0.015em", headingScale: 1.08, bodyScale: 0.94, lineHeight: 1.5 },
    grid: { margin: 72, gutter: 26 }, shape: { radius: 0, rule: 2 }, image: { treatment: "warm", overlay: 0.2 },
    details: { pageNumber: "index", footer: true }, motif: "collage",
  }),
  risograph: seed("risograph", {
    name: "Risograph · 리소그래프", mode: "light",
    palette: { bg: "#FAF5E9", surface: "#F0E6CC", ink: "#26343B", muted: "#7C8986", accent: "#EF6B5A", accentSoft: "#F6D3C8", line: "#D8CCAF" },
    typography: { displayFont: SERIF, bodyFont: SANS, displayWeight: 600, bodyWeight: 500, displayTracking: "-0.03em", headingScale: 1.02, bodyScale: 0.98, lineHeight: 1.55 },
    grid: { margin: 72, gutter: 26 }, shape: { radius: 0, rule: 1 }, image: { treatment: "duotone", overlay: 0.22 },
    details: { pageNumber: "index", footer: true }, motif: "riso",
  }),
  "art-deco": seed("art-deco", {
    name: "Art Deco · 아르데코", mode: "dark",
    palette: { bg: "#121A17", surface: "#1D2C26", ink: "#F3EAD4", muted: "#AEB4A1", accent: "#D4AF62", accentSoft: "#37301F", line: "#3F5245" },
    typography: { displayFont: SERIF, bodyFont: SANS, displayWeight: 400, bodyWeight: 400, displayTracking: "0.01em", headingScale: 1.08, bodyScale: 0.96, lineHeight: 1.6 },
    grid: { margin: 88, gutter: 30 }, shape: { radius: 0, rule: 2 }, image: { treatment: "warm", overlay: 0.3 },
    details: { pageNumber: "index", footer: true }, motif: "deco",
  }),
  cyberpunk: seed("cyberpunk", {
    name: "Cyberpunk · 사이버펑크", mode: "dark",
    palette: { bg: "#090B14", surface: "#151B2E", ink: "#DBF9FF", muted: "#8192B5", accent: "#00E5FF", accentSoft: "#123B4A", line: "#2E4266" },
    typography: { displayFont: MONO, bodyFont: MONO, displayWeight: 700, bodyWeight: 400, displayTracking: "-0.04em", headingScale: 1.08, bodyScale: 0.9, lineHeight: 1.5 },
    grid: { margin: 64, gutter: 20 }, shape: { radius: 0, rule: 2 }, image: { treatment: "duotone", overlay: 0.36 },
    details: { pageNumber: "fraction", footer: true }, motif: "cyber",
  }),
  isometric: seed("isometric", {
    name: "Isometric · 아이소메트릭", mode: "light",
    palette: { bg: "#F3F7FA", surface: "#E3ECF3", ink: "#142838", muted: "#62798B", accent: "#2A8FB8", accentSoft: "#D7ECF4", line: "#CBD9E3" },
    typography: { displayFont: GROTESK, bodyFont: SANS, displayWeight: 600, bodyWeight: 400, displayTracking: "-0.035em", headingScale: 1, bodyScale: 0.98, lineHeight: 1.55 },
    grid: { margin: 76, gutter: 28 }, shape: { radius: 4, rule: 1 }, image: { treatment: "none", overlay: 0.12 },
    details: { pageNumber: "index", footer: true }, motif: "iso",
  }),
};

export const DESIGN_PRESETS = { ...ORIGINAL, ...EXTENDED } as Record<DesignPresetId, DesignSystem>;

export const PRESET_LIST = Object.values(DESIGN_PRESETS);

export function isDesignPreset(value: unknown): value is DesignPresetId {
  return typeof value === "string" && value in DESIGN_PRESETS;
}

export function resolveDesignSystem(
  input?: Partial<DesignSystem> | null,
  preset?: DesignPresetId,
): DesignSystem {
  const requested = preset ?? input?.preset ?? "modern-editorial";
  const base = DESIGN_PRESETS[requested] ?? DESIGN_PRESETS["modern-editorial"];
  if (!input) return structuredClone(base);
  return {
    ...structuredClone(base),
    ...input,
    preset: requested in DESIGN_PRESETS ? requested : base.preset,
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

const DETECTORS: [RegExp, DesignPresetId][] = [
  [/pixel|픽셀|도트/, "pixel-art"],
  [/cyber|사이버|네온/, "cyberpunk"],
  [/art.?deco|아르데코/, "art-deco"],
  [/riso|리소/, "risograph"],
  [/collage|콜라주/, "collage"],
  [/pop.?art|팝아트/, "pop-art"],
  [/bauhaus|바우하우스/, "bauhaus"],
  [/memphis|멤피스/, "memphis"],
  [/isometric|아이소/, "isometric"],
  [/chrome|y2k|크롬/, "y2k-chrome"],
  [/grain|그레이니|grainy/, "grainy-gradient"],
  [/kinetic|키네틱|타이포그래피/, "kinetic-typography"],
  [/maximal|맥시멀/, "maximalism"],
  [/brutal|브루탈/, "neo-brutalism"],
  [/clay|클레이/, "claymorphism"],
  [/glass|글래스/, "glassmorphism"],
  [/bento|벤토/, "bento-grid"],
  [/swiss|스위스|국제주의/, "swiss-style"],
  [/minimal|미니멀/, "minimalism"],
  [/magazine|매거진|잡지/, "magazine"],
  [/premium|프리미엄|luxury|럭셔리/, "premium-portfolio"],
  [/tech|테크|product|프로덕트|saas|스타트업|개발/, "tech-product"],
  [/data|데이터|analytics|분석|report|리포트/, "data-story"],
  [/editorial|에디토리얼|portfolio|포트폴리오/, "editorial"],
  [/corporate|기업|b2b|비즈니스/, "minimal-corporate"],
];

export function detectPreset(text: string): DesignPresetId {
  return detectPresetHint(text) ?? "modern-editorial";
}

/** Returns a preset only when a registered keyword actually matched. */
export function detectPresetHint(text: string): DesignPresetId | undefined {
  const t = text.toLowerCase();
  for (const [pattern, id] of DETECTORS) {
    if (pattern.test(t)) return id;
  }
  return undefined;
}
