import type { ReferenceRole, SourceType } from "./types";

export interface ParsedIntake {
  title?: string;
  pageCount?: number;
  purpose?: string;
  audience?: string;
  tone?: string;
  /** The request itself with field labels removed. */
  request: string;
}

const PAGE_COUNT = /(\d{1,2})\s*(?:페이지|장|pages?|p)|(?:페이지|장|pages?)\s*(\d{1,2})/i;
const TITLE_LINE = /(?:^|\s)(?:제목|타이틀|title|프로젝트명)\s*[:：]\s*([^.\n]{1,100})/i;
const PURPOSE_LINE = /(?:^|\s)(?:목적|용도|purpose)\s*[:：]\s*([^.\n]{1,100})/i;
const AUDIENCE_LINE = /(?:^|\s)(?:독자|대상|타깃|audience)\s*[:：]\s*([^.\n]{1,100})/i;
const TONE_LINE = /(?:^|\s)(?:톤|어조|분위기|tone)\s*[:：]\s*([^.\n]{1,100})/i;

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, 500) : undefined;
}

/**
 * Reads the labels people naturally write in a long prompt. Everything else
 * stays in `request` and goes to the planner as-is; nothing is invented here.
 */
export function parseIntake(text: string): ParsedIntake {
  const source = text ?? "";
  const match = source.match(PAGE_COUNT);
  const rawCount = match?.[1] ?? match?.[2];
  const count = rawCount ? Number(rawCount) : undefined;

  const request = source
    .split(/\r?\n/)
    .filter((line) => !/^(?:제목|타이틀|title|프로젝트명|목적|용도|purpose|독자|대상|타깃|audience|톤|어조|분위기|tone)\s*[:：]/i.test(line))
    .join("\n")
    .trim();

  return {
    title: clean(source.match(TITLE_LINE)?.[1]),
    pageCount: count && count >= 3 && count <= 30 ? count : undefined,
    purpose: clean(source.match(PURPOSE_LINE)?.[1]),
    audience: clean(source.match(AUDIENCE_LINE)?.[1]),
    tone: clean(source.match(TONE_LINE)?.[1]),
    request: request || source.trim(),
  };
}

const SOURCE_PATTERNS: [RegExp, SourceType][] = [
  [/채용|공고|job|recruit|hiring|모집/i, "job-posting"],
  [/이력서|Resume|CV[/_-]|경력기술서/i, "resume"],
  [/경력|커리어|career/i, "career-history"],
  [/자기소개서|cover.?letter/i, "cover-letter"],
  [/포트폴리오|portfolio|작업물/i, "portfolio"],
  [/제안서|기획서|보고서|프로젝트|문서|doc|pdf|ppt/i, "project-doc"],
];

export function classifySource(name: string, mime = ""): SourceType {
  if (/^image\//.test(mime)) return "image";
  for (const [pattern, kind] of SOURCE_PATTERNS) {
    if (pattern.test(name)) return kind;
  }
  return mime ? "project-doc" : "text";
}

export function classifyReferenceRole(name: string, note = ""): ReferenceRole {
  const text = `${name} ${note}`;
  if (/구성|목차|구조|agenda|structure|outline/i.test(text)) return "structure";
  if (/스타일|디자인|컬러|세리프| 레퍼런스|reference|style/i.test(text)) return "style";
  return "both";
}

/** Gives the local slide builder the user's own words for one page. */
export function materialForSlide(
  prompt: string,
  title: string,
  role: string,
  keyMessage: string,
): string {
  const sentences = prompt
    .split(/\r?\n|(?<=[.!?。])\s+/)
    .map((line) => line.trim())
    .filter(
      (line) =>
        line.length >= 10 &&
        !/^(제목|목적|독자|톤)\s*[:：]/i.test(line) &&
        !/(만들어\s*주세요|작성해\s*주세요|생성해\s*주세요|순서대로)/.test(line),
    );
  const keywords = [title, role]
    .flatMap((value) => value.split(/[\s,·/]+/))
    .filter((value) => value.length >= 2);
  const matched = sentences
    .map((sentence) => ({
      sentence,
      score: keywords.filter((word) => sentence.includes(word)).length,
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map((entry) => entry.sentence);

  return [
    role ? `키커: ${role}` : "",
    keyMessage,
    ...matched,
  ]
    .filter(Boolean)
    .join("\n");
}

export function inferReferencePalette(name: string): string[] {
  const text = name.toLowerCase();
  const colors: Record<string, string> = {
    흑백: "#1d1d1b",
    black: "#1d1d1b",
    블루: "#2a4d8f",
    blue: "#2a4d8f",
    그린: "#2f6b4f",
    green: "#2f6b4f",
    레드: "#c1442d",
    red: "#c1442d",
    브라운: "#6d5038",
    brown: "#6d5038",
  };
  return Object.entries(colors)
    .filter(([key]) => text.includes(key))
    .slice(0, 4)
    .map(([, hex]) => hex);
}
