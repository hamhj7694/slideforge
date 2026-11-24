export const LAYOUT_KINDS = [
  "cover",
  "section",
  "statement",
  "split",
  "editorial-3col",
  "metrics",
  "timeline",
  "process",
  "before-after",
  "case-study",
  "fullbleed",
  "gallery",
  "table",
  "data-story",
  "closing",
] as const;

export type LayoutKind = (typeof LAYOUT_KINDS)[number];

export const LAYOUT_LABELS: Record<LayoutKind, string> = {
  cover: "커버 · 히어로",
  section: "섹션 디바이더",
  statement: "스테이트먼트",
  split: "이미지 · 텍스트 분할",
  "editorial-3col": "3열 에디토리얼",
  metrics: "KPI · 수치",
  timeline: "타임라인",
  process: "프로세스",
  "before-after": "Before / After",
  "case-study": "사례 분석",
  fullbleed: "풀블리드 이미지",
  gallery: "갤러리",
  table: "데이터 테이블",
  "data-story": "데이터 스토리",
  closing: "클로징",
};

export type DesignPresetId =
  | "swiss-editorial"
  | "modern-editorial"
  | "minimal-corporate"
  | "tech-product"
  | "premium-portfolio"
  | "data-story"
  | "magazine";

export interface DesignPalette {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  accentSoft: string;
  line: string;
}

export interface DesignSystem {
  preset: DesignPresetId;
  name: string;
  mode: "light" | "dark";
  palette: DesignPalette;
  typography: {
    displayFont: string;
    bodyFont: string;
    displayWeight: number;
    bodyWeight: number;
    displayTracking: string;
    headingScale: number;
    bodyScale: number;
    lineHeight: number;
  };
  grid: {
    margin: number;
    gutter: number;
    columns: number;
  };
  shape: {
    radius: number;
    rule: number;
  };
  image: {
    treatment: "none" | "warm" | "mono" | "duotone";
    overlay: number;
  };
  details: {
    pageNumber: "none" | "index" | "fraction";
    footer: boolean;
    kicker: boolean;
  };
}

export interface SlideSection {
  label?: string;
  heading?: string;
  body?: string;
}

export interface SlideMetric {
  value: string;
  label: string;
  note?: string;
}

export interface SlideImage {
  url: string;
  alt?: string;
  caption?: string;
  fit?: "cover" | "contain";
}

export interface SlideChartSeries {
  label: string;
  value: number;
}

export interface SlideChart {
  type: "bar" | "line" | "donut";
  title?: string;
  unit?: string;
  series: SlideChartSeries[];
  note?: string;
}

export interface SlideTable {
  columns: string[];
  rows: string[][];
  note?: string;
}

export interface StructuredContent {
  kicker?: string;
  title: string;
  subtitle?: string;
  lede?: string;
  sections?: SlideSection[];
  bullets?: string[];
  metrics?: SlideMetric[];
  timeline?: { label: string; title: string; body?: string }[];
  steps?: { title: string; body?: string }[];
  quote?: { text: string; attribution?: string };
  table?: SlideTable;
  chart?: SlideChart;
  before?: { title: string; items: string[] };
  after?: { title: string; items: string[] };
  images?: SlideImage[];
  tags?: string[];
  footnote?: string;
}

export interface LayoutSpec {
  kind: LayoutKind;
  imageSide?: "left" | "right";
  density?: "low" | "medium" | "high";
  showFooter?: boolean;
  accent?: "accent" | "ink" | "none";
  variant?: string;
}

export interface Attachment {
  id?: string;
  name: string;
  url: string;
  mime?: string;
  size?: number;
  kind: "image" | "document" | "url";
  caption?: string;
}

export interface SourceReference {
  id?: string;
  label: string;
  kind: "file" | "url" | "text";
  url?: string;
  excerpt?: string;
}

export type SlideStatus = "draft" | "generated" | "ready";

export interface Slide {
  id: string;
  projectId: string;
  order: number;
  title: string;
  role: string;
  rawInput: string;
  attachments: Attachment[];
  content: StructuredContent;
  layout: LayoutSpec;
  designOverrides: Partial<DesignSystem>;
  sources: SourceReference[];
  status: SlideStatus;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectBrief {
  purpose: string;
  audience: string;
  coreMessage: string;
  storyline: string;
  tone: string;
  visualDirection: string;
  differentiators: string[];
  outline: OutlineItem[];
}

export interface OutlineItem {
  id: string;
  title: string;
  role: string;
  keyMessage: string;
  visual: LayoutKind;
}

export interface Project {
  id: string;
  title: string;
  purpose: string;
  audience: string;
  tone: string;
  masterPrompt: string;
  status: "draft" | "ready" | "exported";
  brief: ProjectBrief;
  designSystem: DesignSystem;
  slideCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectWithSlides extends Project {
  slides: Slide[];
}

export interface SlideVersion {
  id: string;
  slideId: string;
  label: string;
  snapshot: {
    title: string;
    rawInput: string;
    content: StructuredContent;
    layout: LayoutSpec;
    designOverrides: Partial<DesignSystem>;
    status: SlideStatus;
  };
  createdAt: string;
}

export interface UsageEntry {
  id: string;
  projectId: string | null;
  operation: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  createdAt: string;
}
