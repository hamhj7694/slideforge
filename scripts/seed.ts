import {
  addSource,
  createProject,
  getProjectWithSlides,
  listProjects,
  softDeleteProject,
  updateSlide,
} from "../src/lib/repo";
import { buildLocalOutline } from "../src/lib/ai/local-outline";
import { resolveDesignSystem } from "../src/lib/design";
import type { StructuredContent } from "../src/lib/types";

const SAMPLE_TITLE = "공카 AI 마케터 맞춤 포트폴리오";
const SOURCE_TITLE = "[개발용 예시] 공카 AI 마케터 공고 샘플";

const TITLES = [
  "표지·자기소개",
  "핵심 역량",
  "마케팅 실무 경험",
  "실무 생성형 AI 활용 경험",
  "마케팅 업무에서 발견한 문제",
  "AI 영상 제작 도전과 실패",
  "AI·개발 학습 과정",
  "AI 서비스 구현 경험",
  "마케팅 AX 워크플로우 기획",
  "실제 구현·개발 현황",
  "향후 자동화 확장 계획",
  "공카에서의 기여 방향",
] as const;

const SOURCE_TEXT = [
  "[개발용 예시 자료] 이 문서는 실제 공카의 채용 공고가 아닙니다.",
  "SlideForge 개발 환경에서 샘플 프로젝트, 소스 화면, 생성 흐름을 확인하기 위해 작성한 가상의 예시 텍스트입니다.",
  "회사의 공식 요구사항, 실제 지원자, 실제 근무 경험이나 성과를 대표하지 않으며 어떤 사실적 주장의 근거로도 사용할 수 없습니다.",
  "예시 역할: 생성형 AI를 마케팅 업무에 적용할 가능성을 탐색하고, 콘텐츠 초안과 워크플로우를 함께 설계하는 상상 속 직무를 다룹니다.",
].join("\n");

const MASTER_PROMPT = [
  "[개발용 샘플] 실제 공카 채용 공고가 아닙니다. SlideForge의 화면과 생성 흐름을 확인하기 위한 예시 프로젝트입니다.",
  "아래 12개 제목을 그대로 사용해 12페이지 포트폴리오 샘플을 구성합니다.",
  ...TITLES.map((title, index) => `${index + 1}. ${title}`),
  "주의: 이 프레젠테이션은 개발용 예시이며 실제 공고, 실제 인물, 실제 회사 성과를 근거로 하지 않습니다. 정량 성과나 확인되지 않은 수치는 만들지 말고, 비어 있는 페이지는 '내용 입력 필요' 상태로 유지합니다.",
].join("\n");

interface SeedSlide {
  rawInput: string;
  content: StructuredContent;
}

const SEED_SLIDES: SeedSlide[] = [
  {
    rawInput: "포트폴리오의 첫 장으로 정체성과 한 문장 약속을 정리한다.",
    content: {
      title: TITLES[0],
      kicker: "DEVELOPMENT SAMPLE",
      subtitle: "공카 AI 마케터 맞춤 포트폴리오 · 개발용 예시",
      lede:
        "마케팅 실무와 생성형 AI를 어떻게 연결해 볼 수 있는지 보여주기 위한 연습용 자료입니다.",
      tags: ["개발용 샘플", "포트폴리오 구조 확인용"],
      footnote: "실제 채용 공고나 개인 실적을 근거로 한 자료가 아닙니다.",
    },
  },
  {
    rawInput: "마케팅, AI 활용, 개발 학습 역량을 세 축으로 정리한다.",
    content: {
      title: TITLES[1],
      kicker: "역량 프레임",
      sections: [
        {
          label: "01",
          heading: "마케팅 기획",
          body: "캠페인 목표와 메시지를 정리하고 채널별 콘텐츠 흐름을 설계하는 연습을 했습니다.",
        },
        {
          label: "02",
          heading: "생성형 AI 활용",
          body: "아이디어와 초안 단계에서 도구를 보조로 쓰고, 최종 문구는 사람이 검토하는 방식을 익혔습니다.",
        },
        {
          label: "03",
          heading: "기본 개발 이해",
          body: "화면과 데이터가 어떻게 연결되는지 이해하기 위해 작은 기능을 직접 만들어 보며 학습했습니다.",
        },
      ],
      footnote: "개발용 예시 문구입니다.",
    },
  },
  {
    rawInput: "마케팅 실무에서 흔히 마주하는 업무 흐름을 예시로 정리한다.",
    content: {
      title: TITLES[2],
      lede:
        "특정 회사나 실제 프로젝트가 아닌, 마케팅 실무에서 흔히 마주하는 업무 흐름을 예시로 구성했습니다.",
      timeline: [
        {
          label: "기획",
          title: "목표와 메시지 정리",
          body: "캠페인의 목적과 전달할 메시지를 문서로 정리합니다.",
        },
        {
          label: "제작",
          title: "콘텐츠 초안 작성",
          body: "채널에 맞는 문구와 이미지 참고자료를 준비합니다.",
        },
        {
          label: "리뷰",
          title: "검토와 피드백 반영",
          body: "피드백을 반영해 최종 안을 다듬는 과정을 연습했습니다.",
        },
      ],
      footnote: "개발용 예시 자료이며 실제 근무 경험이나 수치가 아닙니다.",
    },
  },
  {
    rawInput: "생성형 AI를 업무에 보조적으로 써 본 방식을 정리한다.",
    content: {
      title: TITLES[3],
      lede:
        "도구가 만든 결과를 그대로 쓰지 않고 사람의 검토를 거치는 흐름을 전제로 정리했습니다.",
      steps: [
        {
          title: "아이디어 확장",
          body: "초기 아이디어를 여러 방향으로 넓히는 용도로 활용합니다.",
        },
        {
          title: "카피 초안",
          body: "문구 초안을 빠르게 만들어 비교한 뒤 직접 다듬습니다.",
        },
        {
          title: "자료 정리",
          body: "참고 자료의 핵심을 요약해 검토 시간을 줄이는 연습을 했습니다.",
        },
      ],
      footnote: "개발용 예시이며 특정 도구의 실제 사용 실적을 뜻하지 않습니다.",
    },
  },
  {
    rawInput: "반복 업무와 자료 정리에서 느낀 문제 의식을 정리한다.",
    content: {
      title: TITLES[4],
      lede:
        "자료가 여러 곳에 흩어져 있고 같은 설명을 반복하게 되는 지점이 가장 큰 비용처럼 느껴졌습니다.",
      bullets: [
        "참고 자료와 이전 결과물이 한곳에 모여 있지 않아 찾는 데 시간이 걸립니다.",
        "같은 맥락을 매번 새로 설명해야 해서 초안 작성이 반복됩니다.",
        "초안 검토 기준이 정리되지 않아 피드백이 산발적으로 들어옵니다.",
      ],
      footnote: "개발용 예시에서 가정한 문제 상황입니다.",
    },
  },
  {
    rawInput: "내용 입력 필요",
    content: { title: TITLES[5], footnote: "내용 입력 필요" },
  },
  {
    rawInput: "AI와 개발을 학습해 온 과정을 예시로 정리한다.",
    content: {
      title: TITLES[6],
      timeline: [
        {
          label: "기초",
          title: "개념 정리",
          body: "생성형 AI의 입력·출력 구조와 기본 웹 개념을 정리했습니다.",
        },
        {
          label: "실습",
          title: "작은 기능 만들기",
          body: "화면에서 입력받은 값을 처리해 결과를 보여주는 간단한 흐름을 연습했습니다.",
        },
        {
          label: "반복",
          title: "피드백 반영",
          body: "결과물을 확인하고 부족한 부분을 다시 정리하는 과정을 반복했습니다.",
        },
      ],
      footnote: "개발용 예시 학습 여정입니다.",
    },
  },
  {
    rawInput: "작은 AI 서비스 프로토타입을 만들었던 흐름을 정리한다.",
    content: {
      title: TITLES[7],
      kicker: "PROTOTYPE SAMPLE",
      sections: [
        {
          label: "상황",
          heading: "목표",
          body: "마케팅 초안 작성 흐름을 화면으로 확인할 수 있는 프로토타입이 필요했습니다.",
        },
        {
          label: "접근",
          heading: "구성",
          body: "입력 → 초안 생성 → 검토 화면의 단순한 흐름으로 구성했습니다.",
        },
        {
          label: "배움",
          heading: "확인한 점",
          body: "결과가 화면에 보이는 형태로 정리되자 논의의 기준이 분명해졌습니다.",
        },
      ],
      footnote: "실제 서비스 출시 기록이 아닌 개발용 예시입니다.",
    },
  },
  {
    rawInput: "마케팅 AX 워크플로우를 단계로 나눠 기획한다.",
    content: {
      title: TITLES[8],
      steps: [
        { title: "자료 입력", body: "캠페인 목표와 참고 자료를 한곳에 모읍니다." },
        { title: "AI 초안", body: "정해진 형식에 맞춰 초안을 생성합니다." },
        { title: "사람 검토", body: "사실 관계와 톤을 확인하고 수정합니다." },
        {
          title: "재사용",
          body: "확인된 문구와 구조를 다음 업무에 다시 활용합니다.",
        },
      ],
      footnote: "개발용 예시 워크플로우이며 실제 도입 결과가 아닙니다.",
    },
  },
  {
    rawInput: "내용 입력 필요",
    content: { title: TITLES[9], footnote: "내용 입력 필요" },
  },
  {
    rawInput: "자동화 확장 계획을 단계별로 정리한다.",
    content: {
      title: TITLES[10],
      timeline: [
        {
          label: "1단계",
          title: "자료 수집 정리",
          body: "참고 자료를 한곳에 모으는 규칙을 먼저 정합니다.",
        },
        {
          label: "2단계",
          title: "초안 템플릿",
          body: "자주 쓰는 형식을 템플릿으로 만들어 재사용합니다.",
        },
        {
          label: "3단계",
          title: "검토 흐름 연결",
          body: "생성된 초안을 사람이 확인하는 단계를 명확히 합니다.",
        },
      ],
      footnote: "계획 단계의 개발용 예시이며 구현 완료를 의미하지 않습니다.",
    },
  },
  {
    rawInput: "공카에 기여할 방향을 예시로 제안한다.",
    content: {
      title: TITLES[11],
      lede:
        "마케팅 맥락을 이해하고 AI 도구를 실무 흐름에 자연스럽게 연결하는 방식을 함께 찾고 싶습니다.",
      bullets: [
        "반복 업무를 정리하고 검토 기준을 문서화하는 데 기여합니다.",
        "생성 결과를 그대로 신뢰하지 않고 사람이 확인하는 흐름을 제안합니다.",
        "작은 실험을 빠르게 만들어 팀과 함께 판단할 수 있게 합니다.",
      ],
      footnote: "개발용 샘플이며 실제 지원 의사나 공고 내용을 대변하지 않습니다.",
    },
  },
];

function main() {
  const existing = listProjects({ search: SAMPLE_TITLE }).find(
    (project) =>
      project.title === SAMPLE_TITLE &&
      getProjectWithSlides(project.id)?.slides.length === TITLES.length,
  );
  if (existing) {
    if (process.env.SEED_FORCE === "1") {
      softDeleteProject(existing.id);
      console.log("[seed] 기존 샘플을 휴지통으로 보내고 새로 생성합니다.");
    } else {
      console.log("[seed] 기존 샘플 프로젝트를 재사용합니다.");
      console.log(existing.id);
      return;
    }
  }

  const brief = buildLocalOutline({
    title: SAMPLE_TITLE,
    masterPrompt: MASTER_PROMPT,
    purpose:
      "개발용 예시 포트폴리오가 어떤 구조와 문구로 생성되는지 확인하기 위한 샘플입니다.",
    audience: "SlideForge 개발자 및 화면 검토자",
    tone: "과장 없이 담백한 개발용 예시 톤",
    pageCount: TITLES.length,
    sources: [{ label: SOURCE_TITLE, content: SOURCE_TEXT }],
    preset: "modern-editorial",
  });

  const project = createProject({
    title: SAMPLE_TITLE,
    masterPrompt: MASTER_PROMPT,
    purpose: brief.purpose,
    audience: brief.audience,
    tone: brief.tone,
    brief,
    designSystem: resolveDesignSystem({}, "modern-editorial"),
    sources: [],
  });

  addSource(project.id, {
    type: "job-posting",
    title: SOURCE_TITLE,
    text: SOURCE_TEXT,
    metadata: {
      company: "공카 (개발용 예시)",
      role: "AI 마케터 (개발용 예시)",
      note: "실제 채용 공고가 아닙니다.",
    },
  });

  if (project.slides.length !== SEED_SLIDES.length) {
    throw new Error(
      `샘플 슬라이드 수가 일치하지 않습니다. (expected ${SEED_SLIDES.length}, got ${project.slides.length})`,
    );
  }
  project.slides.forEach((slide, index) => {
    const seed = SEED_SLIDES[index];
    const isEmptyCell = index === 5 || index === 9;
    updateSlide(project.id, slide.id, {
      rawInput: seed.rawInput,
      content: seed.content,
      status: isEmptyCell ? "draft" : "ready",
    });
  });

  console.log("[seed] 샘플 프로젝트를 생성했습니다.");
  console.log(project.id);
}

try {
  main();
} catch (error) {
  console.error("[seed] 샘플 생성에 실패했습니다.", error);
  process.exitCode = 1;
}
