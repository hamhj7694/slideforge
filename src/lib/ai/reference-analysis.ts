import { detectPresetHint } from "../design";
import type {
  LayoutKind,
  ReferenceAnalysis,
  ReferenceRole,
  SourceType,
} from "../types";
import { stripMarkdown, truncate } from "../utils";

export interface AnalyzeReferenceInput {
  role: ReferenceRole;
  label: string;
  sourceType: SourceType;
  text: string;
  note?: string;
  paletteHints?: string[];
}

const LAYOUT_HINTS: [RegExp, LayoutKind][] = [
  [/표지|커버|intro|cover|title/i, "cover"],
  [/목차|agenda|contents/i, "section"],
  [/역량|강점|스킬|capabilit|competenc|skill/i, "editorial-3col"],
  [/문제|이슈|pain|problem|간극/i, "statement"],
  [/지표|수치|통계|metric|data|성과/i, "metrics"],
  [/일정|로드맵|연혁|타임라인|timeline/i, "timeline"],
  [/단계|프로세스|플로우|workflow|process/i, "process"],
  [/전후|비교|before|after/i, "before-after"],
  [/사례|케이스|case/i, "case-study"],
  [/전체 화면|풀블리드|fullbleed/i, "fullbleed"],
  [/이미지|갤러리|스크린샷|gallery/i, "gallery"],
  [/표|테이블|table/i, "table"],
  [/데이터 스토리|data.story/i, "data-story"],
  [/마무리|감사|closing|thank/i, "closing"],
];

const TONE_HINTS: [RegExp, string][] = [
  [/절제|담백|미니멀|minimal/i, "절제된"],
  [/따뜻|온화|warm/i, "따뜻한"],
  [/기술|개발|테크|tech/i, "기술적인"],
  [/편집|에디토리얼|editorial/i, "편집적인"],
  [/강렬|대담|brutal|브루탈/i, "대담한"],
  [/차분|정돈|corporate/i, "정돈된"],
];

const STYLE_CUES: [RegExp, string][] = [
  [/세리프|serif/i, "세리프 제목"],
  [/산세리프|sans/i, "산세리프 본문"],
  [/모노|mono/i, "모노 라벨"],
  [/그리드|grid/i, "그리드 정렬"],
  [/여백|whitespace/i, "넉넉한 여백"],
  [/이미지|사진|image|photo/i, "이미지 중심"],
  [/단색|흑백|모노톤|monochrome/i, "단색 팔레트"],
  [/액센트|강조색|accent/i, "단일 액센트"],
  [/둥근|라운드|rounded/i, "부드러운 코너"],
  [/각진|사각|straight/i, "각진 코너"],
];

function unique(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function titleFromLine(line: string): string | undefined {
  const stripped = stripMarkdown(line).replace(/\s*[-–—:]\s*$/, "").trim();
  if (stripped.length < 2 || stripped.length > 80) return undefined;
  return stripped;
}

export function analyzeReference(input: AnalyzeReferenceInput): ReferenceAnalysis {
  const text = (input.text ?? "").slice(0, 20000);
  const note = (input.note ?? "").trim();
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const numbered = lines
    .map((line) => line.match(/^(?:\d{1,2}[.)]|PART\s*\d+\s*[:.)-]?)\s*(.{2,80})$/i))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => titleFromLine(match[1]));
  const headings = lines
    .filter((line) => /^#{2,4}\s+/.test(line))
    .map((line) => titleFromLine(line.replace(/^#{2,4}\s+/, "")));
  const colonTitles = lines
    .filter((line) => /^[^:\n]{2,40}:$/.test(line))
    .map((line) => titleFromLine(line));
  const sectionTitles = unique([...numbered, ...headings, ...colonTitles]).slice(0, 12);

  const pageMarkers = text.match(/\b(?:page|페이지)\s*\d{1,3}\b/gi)?.length ?? 0;
  const pageCountHint =
    pageMarkers >= 3
      ? Math.min(30, pageMarkers)
      : sectionTitles.length >= 3
        ? sectionTitles.length
        : undefined;

  const bullets = lines.filter((line) => /^[-*•·]\s+/.test(line)).length;
  const density: ReferenceAnalysis["density"] =
    bullets >= 12 || lines.length > 120 ? "high" : bullets >= 5 ? "medium" : "low";

  const layoutHints = unique(
    sectionTitles.map((title) => {
      const lower = title.toLowerCase();
      return LAYOUT_HINTS.find(([pattern]) => pattern.test(lower))?.[1];
    }),
  ).slice(0, 8) as LayoutKind[];

  const styleText = `${note}\n${text.slice(0, 1200)}`;
  const toneKeywords = unique(
    TONE_HINTS.filter(([pattern]) => pattern.test(styleText)).map(([, value]) => value),
  ).slice(0, 5);
  const styleCues = unique(
    STYLE_CUES.filter(([pattern]) => pattern.test(styleText)).map(([, value]) => value),
  ).slice(0, 6);
  const presetHint =
    input.role === "structure"
      ? detectPresetHint(note)
      : detectPresetHint(styleText);

  const paletteHints = unique(input.paletteHints ?? []).slice(0, 4);
  const summaryParts = [
    input.role === "style" ? "스타일 참고" : input.role === "structure" ? "구성 참고" : "스타일·구성 참고",
    sectionTitles.length ? `섹션 후보 ${sectionTitles.length}개` : "섹션 제목 없음",
    pageCountHint ? `페이지 단서 ${pageCountHint}개` : "페이지 단서 없음",
    `밀도 ${density === "high" ? "높음" : density === "medium" ? "보통" : "낮음"}`,
    presetHint ? `스타일 프리셋 ${presetHint}` : "프리셋 단서 없음",
    paletteHints.length ? `색상 ${paletteHints.join(", ")}` : "",
  ].filter(Boolean);

  return {
    role: input.role,
    label: input.label || "제목 없는 참고 자료",
    sourceType: input.sourceType,
    summary: truncate(summaryParts.join(" · "), 240),
    sectionTitles,
    pageCountHint,
    layoutHints,
    density,
    toneKeywords,
    styleCues,
    presetHint,
    paletteHints,
    confidence: "heuristic",
  };
}
