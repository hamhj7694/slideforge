import type {
  LayoutKind,
  OutlineItem,
  ProjectBrief,
} from "../types";
import { firstSentence, stripMarkdown, truncate } from "../utils";

export interface OutlineSource {
  label: string;
  content: string;
}

export interface OutlineInput {
  title?: string;
  masterPrompt: string;
  purpose?: string;
  audience?: string;
  tone?: string;
  pageCount?: number;
  sources?: OutlineSource[];
  preset?: string;
}

const ARC: { role: string; title: (s: string) => string; visual: LayoutKind; message: (s: string) => string }[] = [
  { role: "표지 · 자기소개", title: (s) => s, visual: "cover", message: () => "프로젝트의 정체성과 한 문장 약속을 제시한다." },
  { role: "배경 · 문제 정의", title: (s) => `왜 지금, ${s}인가`, visual: "statement", message: (s) => `${s}가 필요한 배경과 현재의 간극을 정의한다.` },
  { role: "핵심 주장", title: () => "이 프레젠테이션의 핵심 메시지", visual: "metrics", message: () => "청중이 기억해야 할 단 하나의 주장을 수치와 함께 제시한다." },
  { role: "역량 · 솔루션", title: () => "핵심 역량과 접근 방식", visual: "editorial-3col", message: () => "문제를 해결하는 역량을 세 가지 축으로 구조화한다." },
  { role: "프로세스", title: () => "실행 프로세스", visual: "process", message: () => "아이디어가 결과물이 되는 과정을 단계별로 보여준다." },
  { role: "근거 · 결과", title: () => "검증된 근거와 결과", visual: "data-story", message: () => "주장을 뒷받침하는 데이터와 결과를 제시한다." },
  { role: "사례 분석", title: () => "대표 사례", visual: "case-study", message: () => "하나의 사례를 상황·행동·결과 구조로 깊게 보여준다." },
  { role: "시각적 증거", title: () => "작업의 시각적 증거", visual: "gallery", message: () => "과정과 결과물을 이미지로 증명한다." },
  { role: "배운 점", title: () => "시행착오에서 얻은 것", visual: "before-after", message: () => "실패와 개선을 전후 비교로 정리한다." },
  { role: "실행 계획", title: () => "다음 단계 실행 계획", visual: "timeline", message: () => "향후 로드맵과 우선순위를 시간축으로 제시한다." },
  { role: "기여 · 비전", title: () => "함께 만들 다음 장", visual: "split", message: () => "상대에게 제공할 가치와 협업의 방향을 제안한다." },
  { role: "클로징", title: () => "감사합니다", visual: "closing", message: () => "핵심 메시지를 한 번 더 각인시키고 연락처를 남긴다." },
];

function extractExplicitTitles(prompt: string): string[] {
  const lines = prompt.split(/\r?\n/).map((line) => line.trim());
  const numbered = lines
    .map((line) => line.match(/^(\d{1,2})[.)]\s+(.{2,90})$/))
    .filter((m): m is RegExpMatchArray => Boolean(m))
    .map((m) => stripMarkdown(m[2]).replace(/\s*[-–—:]\s*$/, ""));
  if (numbered.length >= 3) return numbered.slice(0, 30);

  const headings = lines
    .filter((line) => /^#{2,3}\s+/.test(line))
    .map((line) => stripMarkdown(line))
    .filter((line) => line.length >= 2 && line.length <= 90);
  if (headings.length >= 3) return headings.slice(0, 30);

  const bulletTitles = lines
    .filter((line) => /^[-*•]\s+(.{2,70})$/.test(line))
    .map((line) => stripMarkdown(line))
    .filter((line) => line.length <= 70);
  if (bulletTitles.length >= 4 && bulletTitles.length <= 20) return bulletTitles;
  return [];
}

function roleForTitle(title: string, index: number): { role: string; visual: LayoutKind } {
  const t = title.toLowerCase();
  if (index === 0 || /표지|커버|소개|intro|cover|title/.test(t)) return { role: "표지 · 자기소개", visual: "cover" };
  if (/목차|agenda|contents/.test(t)) return { role: "목차", visual: "section" };
  if (/역량|강점|스킬|capabilit|competenc|skill/.test(t)) return { role: "핵심 역량", visual: "editorial-3col" };
  if (/문제|이슈|pain|problem|간극/.test(t)) return { role: "문제 정의", visual: "statement" };
  if (/경험|실무|experience|career/.test(t)) return { role: "실무 경험", visual: "case-study" };
  if (/ai|인공지능|활용|자동화/.test(t)) return { role: "AI 활용", visual: "process" };
  if (/실패|도전|시행|lesson|challenge/.test(t)) return { role: "도전과 배움", visual: "before-after" };
  if (/학습|개발|여정|과정|journey|learning/.test(t)) return { role: "학습 여정", visual: "timeline" };
  if (/서비스|구현|제작|결과물|work|project|build/.test(t)) return { role: "구현 사례", visual: "gallery" };
  if (/워크플로|프로세스|flow|workflow/.test(t)) return { role: "워크플로", visual: "process" };
  if (/결과|성과|지표|result|impact|metric|data/.test(t)) return { role: "성과와 근거", visual: "data-story" };
  if (/계획|확장|로드맵|향후|next|plan|roadmap/.test(t)) return { role: "실행 계획", visual: "timeline" };
  if (/기여|비전|제안|contribution|vision|offer/.test(t)) return { role: "기여 방향", visual: "closing" };
  if (/감사|마무리|thank|closing/.test(t)) return { role: "클로징", visual: "closing" };
  const arc = ARC[Math.min(index, ARC.length - 1)];
  return { role: arc.role, visual: arc.visual };
}

function sentences(text: string): string[] {
  return stripMarkdown(text)
    .replace(/([.!?。])\s+/g, "$1\n")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 12);
}

function bestSupportingSentence(title: string, pool: string): string {
  const words = title
    .replace(/[^가-힣a-zA-Z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  const candidates = sentences(pool);
  if (!candidates.length) return "";
  let best = "";
  let bestScore = 0;
  for (const sentence of candidates) {
    let score = 0;
    for (const word of words) {
      if (sentence.toLowerCase().includes(word.toLowerCase())) score += 2;
    }
    if (score > bestScore) {
      bestScore = score;
      best = sentence;
    }
  }
  if (bestScore >= 2) return truncate(best, 140);
  return "";
}

function inferSubject(input: OutlineInput): string {
  if (input.title?.trim()) return input.title.trim();
  const first = input.masterPrompt
    .split(/\r?\n/)
    .map((line) => stripMarkdown(line))
    .find((line) => line.length >= 2 && line.length <= 60 && !/^\d/.test(line));
  if (first) return truncate(first.replace(/^(프로젝트|주제)\s*[:：]\s*/, ""), 60);
  return "새 프레젠테이션";
}

export function buildLocalOutline(input: OutlineInput): ProjectBrief {
  const pool = [input.masterPrompt, ...(input.sources ?? []).map((s) => s.content)].join("\n\n");
  const subject = inferSubject(input);
  const explicit = extractExplicitTitles(input.masterPrompt);
  const requested = input.pageCount ?? (explicit.length || 8);
  const count = Math.max(3, Math.min(30, explicit.length || requested));
  const outline: OutlineItem[] = [];

  for (let i = 0; i < count; i += 1) {
    const explicitTitle = explicit[i];
    const arc = ARC[Math.min(i, ARC.length - 1)];
    const title = explicitTitle || arc.title(subject);
    const mapped = roleForTitle(title, i);
    const support = explicitTitle ? bestSupportingSentence(title, pool) : "";
    const keyMessage =
      support ||
      (explicitTitle
        ? `${title}에 대한 핵심 근거와 결과를 한 페이지로 압축한다.`
        : arc.message(subject));
    outline.push({
      id: "",
      title,
      role: mapped.role,
      keyMessage,
      visual: mapped.visual,
    });
  }

  // A deck should end with a closing slide when the user did not specify a list.
  if (!explicit.length && count >= 4) {
    outline[count - 1] = {
      id: "",
      title: /감사|마무리|클로징/.test(outline[count - 1].title) ? outline[count - 1].title : "감사합니다",
      role: "클로징",
      keyMessage: "핵심 메시지를 다시 각인시키고 다음 대화를 여는 한 페이지.",
      visual: "closing",
    };
  }

  const coreMessage =
    firstSentence(input.purpose || "") ||
    bestSupportingSentence(subject, pool) ||
    `${subject}의 가치를 명확한 근거와 시각적 구조로 설득한다.`;

  return {
    purpose:
      input.purpose?.trim() ||
      `‘${subject}’의 가치와 실행 근거를 한 번의 발표로 설득한다.`,
    audience:
      input.audience?.trim() ||
      "해당 주제에 대해 판단해야 하는 의사결정자와 실무자",
    coreMessage,
    storyline:
      "문제 제기 → 관점 제시 → 근거와 사례 → 실행 계획 → 기여 제안의 흐름으로 구성했습니다. 각 페이지는 하나의 메시지만 맡고, 앞뒤 페이지가 논리적으로 연결되도록 설계했습니다.",
    tone:
      input.tone?.trim() ||
      "절제된 자신감. 과장 없이 근거로 말하고, 숫자와 이미지로 증명한다.",
    visualDirection:
      input.preset === "swiss-editorial"
        ? "Swiss editorial: 강한 그리드, 큰 타이포그래피, 단일 고채도 액센트, 장식 최소화."
        : input.preset === "premium-portfolio"
          ? "Premium portfolio: 깊은 잉크 배경, 세리프 디스플레이, 넉넉한 여백, 금빛 디테일."
          : input.preset === "tech-product"
            ? "Tech product: 명료한 정보 구조, 모노 라벨, 단일 인디고 액센트."
            : "Modern editorial: 따뜻한 종이 톤, 세리프 헤드라인, 비대칭 그리드, 이미지 중심 구성.",
    differentiators: [
      "입력 자료에 있는 사실만 사용하고, 출처 없는 수치는 만들지 않습니다.",
      "모든 페이지가 하나의 디자인 시스템과 스토리라인을 공유합니다.",
      "페이지별 역할을 분리해 같은 말이 반복되지 않게 합니다.",
    ],
    outline,
  };
}

export function describeArc(outline: OutlineItem[]): string {
  return outline
    .map((item, index) => `${index + 1}. ${item.title} — ${item.role}`)
    .join("\n");
}
