import type {
  LayoutKind,
  LayoutSpec,
  Project,
  Slide,
  SlideChart,
  SlideImage,
  SlideMetric,
  SlideSection,
  SlideTable,
  StructuredContent,
} from "../types";
import { stripMarkdown, truncate } from "../utils";
import type { OutlineItem } from "../types";

export interface LocalSlideInput {
  project: Project;
  slide: Pick<Slide, "title" | "role" | "rawInput" | "attachments" | "content">;
  outlineItem?: OutlineItem | null;
  previousKinds?: LayoutKind[];
  instruction?: string;
  mode?: "generate" | "regenerate" | "design-only";
}

export interface LocalSlideResult {
  content: StructuredContent;
  layout: LayoutSpec;
}

interface Parsed {
  title: string;
  subtitle: string;
  kicker: string;
  paragraphs: string[];
  bullets: string[];
  numbered: string[];
  sections: SlideSection[];
  metrics: SlideMetric[];
  table?: SlideTable;
  chart?: SlideChart;
  timeline: { label: string; title: string; body?: string }[];
  steps: { title: string; body?: string }[];
  before?: { title: string; items: string[] };
  after?: { title: string; items: string[] };
  quote?: { text: string; attribution?: string };
  images: SlideImage[];
  footnote: string;
}

const BULLET_RE = /^[-*•·]\s+(.+)$/;
const NUMBERED_RE = /^\d{1,2}[.)]\s+(.+)$/;
const YEAR_RE = /^((?:19|20)\d{2})(?:[.\-/년]\s*)?(.{0,80})$/;
const METRIC_LABEL_RE =
  /^([가-힣A-Za-z][^:：\n]{0,24})[:：]\s*([+\-]?[₩$€]?\d[\d,.]*\s*(?:%|퍼센트|배|개|건|명|억|만|원|달러|USD|KRW|년|개월|주|일|pt|점|x|X)?)\s*(.*)$/;
const METRIC_INLINE_RE =
  /([+\-]?[₩$€]?\d[\d,.]*\s*(?:%|퍼센트|배|건|개|명|억|만|원|달러|USD|KRW|pt|점|x|X))(?:\s*(?:의|라는|라는|를|을))?\s*([가-힣A-Za-z][^,.\n]{1,28})?/g;

function parseTable(lines: string[]): SlideTable | undefined {
  const rows: string[][] = [];
  for (const line of lines) {
    if (!/^\s*\|.*\|\s*$/.test(line)) continue;
    const cells = line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => stripMarkdown(cell).trim());
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
    if (cells.length >= 2) rows.push(cells);
  }
  if (rows.length < 2) return undefined;
  const width = Math.min(5, Math.max(...rows.map((r) => r.length)));
  const normalized = rows.map((row) =>
    Array.from({ length: width }, (_, i) => row[i] ?? ""),
  );
  return {
    columns: normalized[0].slice(0, width),
    rows: normalized.slice(1, 8),
  };
}

function buildChart(table?: SlideTable): SlideChart | undefined {
  if (!table || table.rows.length < 2) return undefined;
  const numericIndex = table.columns.findIndex((_, index) =>
    table.rows.every((row) =>
      /^[₩$€]?\s*-?\d[\d,.]*\s*(?:%|배|건|개|명|억|만|원|pt|점|x)?$/.test(
        (row[index] ?? "").trim(),
      ),
    ),
  );
  if (numericIndex < 1) return undefined;
  const series = table.rows.slice(0, 6).map((row) => ({
    label: row[0] || "항목",
    value: Number((row[numericIndex] ?? "0").replace(/[^\d.-]/g, "")) || 0,
  }));
  if (series.length < 2) return undefined;
  return {
    type: "bar",
    title: table.columns[numericIndex],
    series,
  };
}

function extractMetrics(text: string): SlideMetric[] {
  const metrics: SlideMetric[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const match = line.trim().match(METRIC_LABEL_RE);
    if (match) {
      const value = match[2].trim();
      const label = stripMarkdown(match[3] || match[1]).slice(0, 34);
      if (label && !seen.has(value)) {
        seen.add(value);
        metrics.push({ value, label });
      }
    }
  }
  if (metrics.length >= 2) return metrics.slice(0, 4);

  const inline = text.matchAll(METRIC_INLINE_RE);
  for (const match of inline) {
    const value = match[1];
    const label = match[2] ? stripMarkdown(match[2]).slice(0, 30) : "";
    if (!label || seen.has(value)) continue;
    seen.add(value);
    metrics.push({ value, label });
    if (metrics.length >= 4) break;
  }
  return metrics;
}

function parseInput(input: LocalSlideInput): Parsed {
  const raw = input.slide.rawInput.trim();
  const lines = raw.split(/\r?\n/);
  const images: SlideImage[] = [];
  for (const attachment of input.slide.attachments ?? []) {
    if (attachment.kind === "image") {
      images.push({
        url: attachment.url,
        alt: attachment.name,
        caption: attachment.caption,
      });
    }
  }
  const mdImageRe = /!\[([^\]]*)\]\(([^)]+)\)/g;
  for (const match of raw.matchAll(mdImageRe)) {
    images.push({ url: match[2], alt: match[1] || "첨부 이미지" });
  }

  let kicker = "";
  let subtitle = "";
  let footnote = "";
  let title = input.slide.title?.trim() || "";
  const consume = new Set<number>();

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    const kickerMatch = trimmed.match(/^(?:kicker|키커)\s*[:：]\s*(.+)$/i);
    if (kickerMatch) {
      kicker = kickerMatch[1].trim();
      consume.add(index);
    }
    const subMatch = trimmed.match(/^(?:부제|subtitle|tagline)\s*[:：]\s*(.+)$/i);
    if (subMatch) {
      subtitle = subMatch[1].trim();
      consume.add(index);
    }
    const sourceMatch = trimmed.match(/^(?:출처|source)\s*[:：]\s*(.+)$/i);
    if (sourceMatch) {
      footnote = sourceMatch[1].trim();
      consume.add(index);
    }
    const titleMatch = trimmed.match(/^(?:#|제목|title)\s*[:：]?\s*(.+)$/i);
    if (!title && titleMatch && trimmed.length <= 90) {
      title = stripMarkdown(titleMatch[1]);
      consume.add(index);
    }
  });

  if (!title) {
    const first = lines.find((line) => line.trim() && !mdImageRe.test(line));
    if (first && first.trim().length <= 56 && !/[.!?。]$/.test(first.trim())) {
      title = stripMarkdown(first);
      consume.add(lines.indexOf(first));
    }
  }
  if (!title) title = input.outlineItem?.title || input.slide.role || "제목 없는 슬라이드";
  if (!kicker) kicker = input.outlineItem?.role || input.slide.role || "";

  const table = parseTable(lines);
  const chart = buildChart(table);
  const metrics = extractMetrics(raw);

  const bullets: string[] = [];
  const numbered: string[] = [];
  lines.forEach((line, index) => {
    if (consume.has(index)) return;
    const trimmed = line.trim();
    const bullet = trimmed.match(BULLET_RE);
    if (bullet) {
      bullets.push(stripMarkdown(bullet[1]));
      consume.add(index);
      return;
    }
    const num = trimmed.match(NUMBERED_RE);
    if (num) {
      numbered.push(stripMarkdown(num[1]));
      consume.add(index);
    }
  });

  const paragraphs: string[] = [];
  const sections: SlideSection[] = [];
  let currentHeading = "";
  let currentBody: string[] = [];
  let quoteLines: string[] = [];

  const flush = () => {
    if (!currentHeading && !currentBody.length) return;
    const body = currentBody.join(" ").trim();
    if (currentHeading) {
      sections.push({ heading: stripMarkdown(currentHeading).slice(0, 80), body });
    } else if (body) {
      paragraphs.push(body);
    }
    currentHeading = "";
    currentBody = [];
  };

  lines.forEach((line, index) => {
    if (consume.has(index)) return;
    const trimmed = line.trim();
    if (!trimmed || /^\|.*\|$/.test(trimmed)) return;
    if (/^>/.test(trimmed)) {
      quoteLines.push(stripMarkdown(trimmed.replace(/^>\s?/, "")));
      return;
    }
    if (/^#{1,4}\s+/.test(trimmed)) {
      flush();
      currentHeading = trimmed.replace(/^#{1,4}\s+/, "");
      return;
    }
    const headingMatch = trimmed.match(/^(.{2,40})\s*[:：]$/);
    if (headingMatch) {
      flush();
      currentHeading = headingMatch[1];
      return;
    }
    if (/^[-*•·]\s+/.test(trimmed) || NUMBERED_RE.test(trimmed)) return;
    if (METRIC_LABEL_RE.test(trimmed)) {
      flush();
      return;
    }
    currentBody.push(trimmed);
  });
  flush();

  const sentenceSections = paragraphs
    .slice(0, 6)
    .filter((p) => p.length > 40)
    .slice(0, 3)
    .map((body) => ({ body: truncate(body, 240) }));

  const timeline: Parsed["timeline"] = [];
  for (const line of lines) {
    const match = line.trim().match(YEAR_RE);
    if (match) {
      timeline.push({
        label: match[1],
        title: truncate(stripMarkdown(match[2]) || match[1], 60),
      });
    }
  }
  const steps = numbered.slice(0, 6).map((item) => {
    const parts = item.split(/\s*[—–:-]\s*/);
    return {
      title: truncate(parts[0], 48),
      body: parts.length > 1 ? truncate(parts.slice(1).join(" "), 120) : undefined,
    };
  });

  let before: Parsed["before"];
  let after: Parsed["after"];
  const beforeIndex = lines.findIndex((l) =>
    /^(before|as-is|asis|기존|이전|개선 전)\s*[:：]?$/i.test(l.trim()),
  );
  const afterIndex = lines.findIndex((l) =>
    /^(after|to-be|tobe|개선|이후|개선 후)\s*[:：]?$/i.test(l.trim()),
  );
  if (beforeIndex >= 0 && afterIndex > beforeIndex) {
    const beforeLines = lines
      .slice(beforeIndex + 1, afterIndex)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => stripMarkdown(l.replace(BULLET_RE, "$1")));
    const afterLines = lines
      .slice(afterIndex + 1)
      .map((l) => l.trim())
      .filter((l) => Boolean(l) && !METRIC_LABEL_RE.test(l))
      .map((l) => stripMarkdown(l.replace(BULLET_RE, "$1")));
    if (beforeLines.length) before = { title: "Before", items: beforeLines.slice(0, 4) };
    if (afterLines.length) after = { title: "After", items: afterLines.slice(0, 4) };
  }

  const ledePool = paragraphs.length
    ? paragraphs
    : sections.length
      ? sections.map((s) => s.body ?? "").filter(Boolean)
      : [];
  const lede = truncate(
    ledePool[0] || input.outlineItem?.keyMessage || "",
    220,
  );

  const quote = quoteLines.length
    ? { text: truncate(quoteLines.join(" "), 220) }
    : undefined;

  return {
    title: truncate(title, 120),
    subtitle: truncate(subtitle, 140),
    kicker: truncate(kicker, 48),
    paragraphs,
    bullets,
    numbered,
    sections: sections.length ? sections.slice(0, 4) : sentenceSections,
    metrics,
    table,
    chart,
    timeline: timeline.slice(0, 6),
    steps,
    before,
    after,
    quote,
    images: images.slice(0, 4),
    footnote,
  };
}

const ALTERNATIVES: Partial<Record<LayoutKind, LayoutKind[]>> = {
  metrics: ["data-story", "editorial-3col"],
  "editorial-3col": ["split", "case-study"],
  split: ["fullbleed", "editorial-3col"],
  timeline: ["process"],
  process: ["timeline"],
  gallery: ["fullbleed"],
  "data-story": ["metrics"],
  "case-study": ["editorial-3col"],
};

function chooseLayout(
  parsed: Parsed,
  input: LocalSlideInput,
): LayoutKind {
  const instruction = (input.instruction ?? "").toLowerCase();
  const role = `${input.slide.role} ${input.outlineItem?.role ?? ""}`.toLowerCase();
  const preview = input.outlineItem?.visual;

  let kind: LayoutKind | undefined;
  if (/표지|커버|cover/.test(instruction)) kind = "cover";
  else if (/클로징|마무리|closing/.test(instruction)) kind = "closing";
  else if (/갤러리|gallery/.test(instruction)) kind = "gallery";
  else if (/풀블리드|full.?bleed|이미지 중심/.test(instruction)) kind = parsed.images.length ? "fullbleed" : "split";
  else if (/타임라인|연혁|로드맵/.test(instruction)) kind = "timeline";
  else if (/프로세스|워크플로|단계/.test(instruction)) kind = "process";
  else if (/전후|비교|before/.test(instruction)) kind = "before-after";
  else if (/수치|숫자|kpi|지표/.test(instruction)) kind = "metrics";
  else if (/표|테이블|table/.test(instruction)) kind = "table";
  else if (/차트|그래프|데이터/.test(instruction)) kind = "data-story";
  else if (/간결|한 문장|statement/.test(instruction)) kind = "statement";
  else if (/이미지.*분할|분할|split/.test(instruction)) kind = "split";

  if (!kind) {
    if (input.slide.role === "표지 · 자기소개" || /표지|커버/.test(role)) kind = "cover";
    else if (/클로징/.test(role)) kind = "closing";
    else if (parsed.table && parsed.table.rows.length >= 2) kind = "table";
    else if (parsed.chart && parsed.chart.series.length >= 3) kind = "data-story";
    else if (parsed.before && parsed.after) kind = "before-after";
    else if (parsed.images.length >= 2) kind = "gallery";
    else if (parsed.metrics.length >= 2) kind = "metrics";
    else if (parsed.timeline.length >= 3) kind = "timeline";
    else if (parsed.steps.length >= 3 && /프로세스|워크플로|flow|process/.test(role)) kind = "process";
    else if (parsed.quote && parsed.quote.text.length > 30) kind = "statement";
    else if (parsed.sections.length >= 3) kind = "editorial-3col";
    else if (parsed.images.length === 1) kind = "split";
    else if (parsed.bullets.length >= 5) kind = "editorial-3col";
    else if (!parsed.paragraphs.join("").trim() && !parsed.bullets.length) kind = "statement";
    else kind = preview && preview !== "cover" ? preview : "case-study";
  }

  const recent = input.previousKinds ?? [];
  if (kind && kind !== "cover" && kind !== "closing" && recent.slice(-2).includes(kind)) {
    const alt = ALTERNATIVES[kind]?.find((k) => !recent.includes(k));
    if (alt) kind = alt;
  }
  return kind ?? "editorial-3col";
}

function sectionsFor(parsed: Parsed, count: number): SlideSection[] {
  const base = parsed.sections.slice(0, count);
  if (base.length >= count) return base;
  const chunks = parsed.bullets.slice(0, count * 2);
  const extra: SlideSection[] = [];
  for (let i = 0; i < chunks.length; i += 2) {
    extra.push({
      heading: undefined,
      body: chunks.slice(i, i + 2).join(" · "),
    });
  }
  return [...base, ...extra].slice(0, count);
}

export function buildLocalSlide(input: LocalSlideInput): LocalSlideResult {
  const parsed = parseInput(input);
  const kind = chooseLayout(parsed, input);
  const project = input.project;
  const fallbackLede =
    input.outlineItem?.keyMessage ||
    project.brief?.coreMessage ||
    project.purpose ||
    "";

  const content: StructuredContent = {
    kicker: parsed.kicker || input.slide.role,
    title: parsed.title,
    subtitle: parsed.subtitle || undefined,
    lede: parsed.lede || truncate(fallbackLede, 220) || undefined,
    sections: parsed.sections.length ? parsed.sections : undefined,
    bullets: parsed.bullets.length ? parsed.bullets.slice(0, 6) : undefined,
    metrics: parsed.metrics.length ? parsed.metrics : undefined,
    timeline: parsed.timeline.length ? parsed.timeline : undefined,
    steps: parsed.steps.length ? parsed.steps : undefined,
    quote: parsed.quote,
    table: parsed.table,
    chart: parsed.chart,
    before: parsed.before,
    after: parsed.after,
    images: parsed.images.length ? parsed.images : undefined,
    footnote: parsed.footnote || undefined,
    tags: [project.audience].filter(Boolean).slice(0, 3),
  };

  if (kind === "cover") {
    content.subtitle =
      parsed.subtitle || project.brief?.coreMessage || project.purpose || undefined;
    content.tags = [project.audience, project.tone]
      .filter(Boolean)
      .map((value) => truncate(String(value), 38))
      .slice(0, 3);
  }

  if (kind === "metrics" && !content.metrics) {
    const inlineMetrics = extractMetrics(parsed.paragraphs.join("\n"));
    if (inlineMetrics.length >= 2) content.metrics = inlineMetrics;
  }

  if (kind === "editorial-3col") {
    content.sections = sectionsFor(parsed, 3);
  }

  if (kind === "case-study") {
    content.sections = sectionsFor(parsed, 3);
    if (!content.quote && parsed.lede) {
      content.quote = { text: truncate(parsed.lede, 170) };
    }
  }

  if (kind === "split") {
    content.sections = sectionsFor(parsed, 2);
  }

  if (kind === "statement") {
    content.lede = undefined;
    if (!content.quote) {
      const statement =
        parsed.lede ||
        parsed.bullets[0] ||
        input.outlineItem?.keyMessage ||
        project.brief?.coreMessage ||
        parsed.title;
      content.quote = { text: truncate(statement, 190) };
    }
  }

  if (kind === "closing") {
    content.quote = undefined;
    content.lede =
      truncatedText(parsed.lede, 160) ||
      project.brief?.coreMessage ||
      "다음 대화를 시작할 준비가 되어 있습니다.";
    content.tags = ["연락처를 입력하세요", "다음 단계"];
  }

  if (kind === "gallery" && !content.images?.length) {
    content.images = parsed.images.length
      ? parsed.images
      : project.brief?.differentiators?.slice(0, 3).map((text, index) => ({
          url: "",
          alt: `visual-${index}`,
          caption: text,
        }));
  }

  const density: LayoutSpec["density"] =
    parsed.paragraphs.join(" ").length > 900
      ? "high"
      : parsed.paragraphs.join(" ").length > 300
        ? "medium"
        : "low";

  return {
    content,
    layout: {
      kind,
      imageSide: parsed.images.length ? (input.previousKinds?.length ?? 0) % 2 === 0 ? "right" : "left" : "right",
      density,
      showFooter: true,
      accent: "accent",
    },
  };
}

function truncatedText(value: string, max: number) {
  const text = (value ?? "").trim();
  return text ? truncate(text, max) : "";
}
