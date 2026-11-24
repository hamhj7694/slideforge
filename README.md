# SlideForge

정보·요청·레퍼런스만 주면 **16:9 포트폴리오 전체를 자동으로 만들고**, 결과에서 필요한 부분만 고쳐 **PDF 우선**으로 출력하는 로컬 우선 도구입니다. 목차를 먼저 짜거나 필드를 나눠 입력할 필요가 없습니다.

현재 MVP는 **Portfolio Builder Workspace**, 기본 흐름은 **Auto Studio**입니다. Archive/RAG, Notion 연동, 채용 플랫폼 API, 편집 가능한 PPTX는 포함되지 않습니다. 자세한 범위는 [`docs/PRODUCT_SPEC.md`](docs/PRODUCT_SPEC.md), 구현 상태는 [`docs/STATUS.md`](docs/STATUS.md)를 참고하세요.

---

## 요구 사항

- **Node.js 24 이상**을 기준으로 합니다. (`package.json`에 별도 `engines` 필드는 없습니다.)
- npm
- PDF/PPTX 내보내기용 Chrome 또는 Chromium
  - 설치된 Chrome/Edge를 자동 탐색합니다.
  - 찾지 못하면 `.env`의 `CHROME_PATH`에 실행 파일 경로를 지정합니다.
- Windows PowerShell에서 npm 스크립트 실행이 막히는 경우 이 문서의 `cmd /c "npm ..."` 형태를 사용하세요.

---

## 빠른 시작

```powershell
# 1) 의존성 설치
npm install

# 2) 환경 파일 생성
Copy-Item .env.example .env

# 3) 개발 서버 (http://localhost:3070)
npm run dev
```

PowerShell 실행 정책/경로 문제가 있다면:

```powershell
cmd /c "npm install"
cmd /c "copy .env.example .env"
cmd /c "npm run dev"
```

개발용 12페이지 샘플을 넣으려면:

```powershell
npm run seed
# 또는
cmd /c "npm run seed"
```

동일한 제목의 12페이지 샘플이 이미 있으면 새로 만들지 않고 기존 ID를 출력하고 재사용합니다.

---

## 환경 변수

`.env.example`을 `.env`로 복사해 사용합니다. `.env`는 Git에 포함되지 않습니다.

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `AI_PROVIDER` | `local` | `local`, `openai`, `anthropic`, `openrouter` 중 하나. 키가 없으면 로컬로 폴백합니다. |
| `AI_MODEL` | 비어 있음 | 원격 제공자 모델. 비어 있으면 제공자별 기본 모델을 사용합니다. |
| `OPENAI_API_KEY` | 비어 있음 | OpenAI 키. UI에서 저장한 키가 있으면 그것이 우선합니다. |
| `ANTHROPIC_API_KEY` | 비어 있음 | Anthropic 키. |
| `OPENROUTER_API_KEY` | 비어 있음 | OpenRouter 키. |
| `AI_BASE_URL` | 비어 있음 | OpenAI 호환 게이트웨이 Base URL. |
| `APP_URL` | `http://localhost:3070` | 서버 측 내보내기 렌더러가 접근할 앱 주소. 포트를 바꾸면 함께 바꿉니다. |
| `DATA_DIR` | 비어 있음 (`./data`) | SQLite DB, 업로드, 내보내기 파일을 저장할 디렉터리. |
| `CHROME_PATH` | 비어 있음 | PDF/PPTX 렌더링에 사용할 Chrome/Chromium 실행 파일. 비어 있으면 자동 탐색. |
| `EXPORT_SCALE` | `2` | PPTX용 슬라이드 캡처 배율. 기본 2는 2560×1440입니다. |

E2E 실행 시 선택적으로 사용하는 변수: `PLAYWRIGHT_CHROMIUM_EXECUTABLE`(테스트 브라우저 경로), `PLAYWRIGHT_WORKERS`(기본 1). `playwright.config.ts`는 `CHROME_PATH`를 내보내기와 동일한 브라우저로 전달합니다.

> UI(`/settings`)에서 입력한 API 키는 서버 SQLite의 `secrets` 테이블에 저장됩니다. 응답에는 키 전체가 아니라 `첫 6자···마지막 4자`만 마스킹되어 표시됩니다. 환경 변수 키는 DB에 저장된 키가 없을 때 사용됩니다. 실제 키 값을 `.env.example`에 넣지 마세요.

---

## 명령어

| 명령 | 설명 |
| --- | --- |
| `npm run dev` | 개발 서버, 포트 `3070` |
| `npm start` | 프로덕션 서버, 포트 `3070` |
| `npm run build` | Next.js 프로덕션 빌드 |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run seed` | 개발용 12페이지 샘플 프로젝트 생성/재사용 |
| `npm run test:e2e` | Playwright E2E 테스트. `playwright.config.ts`와 `tests/**` 시나리오가 있으며 기본 포트 3070 서버를 자동 재사용/시작합니다. |
| `npm run lint` | Next.js lint 스크립트 |

Windows PowerShell에서 해당 명령이 실행되지 않으면 `cmd /c "npm run <script>"` 형태로 감싸세요. 예: `cmd /c "npm run typecheck"`.

---

## 데이터 위치

기본 저장 위치는 프로젝트 루트의 `data/`이며 `DATA_DIR`로 바꿀 수 있습니다.

```text
data/
├─ slideforge.db      # SQLite DB (better-sqlite3 + Drizzle)
├─ uploads/           # 업로드 원본 파일
└─ exports/           # 생성된 PDF / PPTX
```

- `data/`, `.env`, `.next`, `node_modules`는 `.gitignore`에 포함되어 있습니다.
- 생성된 파일은 `/api/exports/[filename]`으로 내려받습니다.
- 프로젝트 삭제는 실제 삭제가 아니라 `deletedAt`을 기록하는 소프트 삭제입니다. 프로젝트 목록에서 “삭제된 항목”을 켜고 복원할 수 있습니다.

---

## 사용 흐름

1. **한 번 입력 (`/`)**  
   자료와 요청을 큰 입력창에 긴 문장으로 붙여넣습니다. `제목:`, `목적:`, `독자:`, `톤:`, `12페이지` 같은 단서는 자동으로 읽습니다. 페이지 수와 스타일은 접힌 설정에 있고, 비워두면 참고 자료에서 스타일 단서를 찾습니다.
2. **자료와 레퍼런스 추가**  
   파일, URL, 별도 붙여넣기 자료를 넣습니다. 파일 이름으로 자료 종류를 분류하고, 참고용이라면 ‘참고로 분석’을 체크합니다. 원문과 추출 요약은 분리 저장됩니다.
3. **자동 생성 (`POST /api/studio/create`)**  
   자료 분류 → 레퍼런스 분석 → 구성 계획 → 모든 슬라이드 작성 → 초기 스냅샷을 한 번에 처리합니다. 완료되면 결과 화면으로 이동합니다.
4. **결과 검토 (`/studio/[id]`)**  
   전체 페이지 미리보기에서 필요한 페이지만 누른 뒤, 줄글로 내용이나 요청을 적고 **이 내용으로 만들기**를 누릅니다. 제목·문단·레이아웃을 다시 정리합니다. 필드별 수정은 접힌 메뉴에 있습니다. `Ctrl+Z` / `Ctrl+Shift+Z`(또는 `Ctrl+Y`)로 되돌릴 수 있습니다.
5. **고급 편집 (선택)**  
   목차 화면(`/projects/[id]/outline`)과 캔버스 편집기(`/projects/[id]/editor`)에서 구성·배치를 깊게 다듬습니다. 캔버스에서는 `Alt + 드래그`로 요소를 옮기고, 위치·크기·순서·숨김은 `visualOverrides`에 따로 저장됩니다.
6. **내보내기·관리**  
   PDF는 1280×720, 한 슬라이드당 한 페이지, 텍스트 선택 가능합니다. PPTX는 이미지 기반입니다. `/projects`에서 검색·복제·복원·삭제하고, `/settings`에서 provider/model/키/사용량을 확인합니다.

---

## 아키텍처

```text
[입력 한 번: 정보·요청·레퍼런스]
   ↓  parseIntake() + 파일/URL/붙여넣기 분류
[레퍼런스 분석] → 섹션 제목·레이아웃·팔레트 단서
   ↓  POST /api/studio/create
[구성 계획] → 목차·스토리·시각 방향
   ↓  AI Adapter: local 결정론 기본 → 원격 선택/폴백
[slide.content]  ← 텍스트의 단일 진실 소스
   ↓  semantic layout (slide.layout.kind)
[visualOverrides]  ← elementId별 위치/크기/순서/숨김
   ↓  designSystem / designOverrides
[SlideRenderer HTML]  ← 파생 결과
   ↓
[결과 검토 / 필요한 페이지만 부분 수정] ↔ slide.content · visualOverrides
   ↓  Playwright Chrome
[PDF → 이미지 기반 PPTX]
```

- **UI**: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS 3
- **영속화**: SQLite(`better-sqlite3`) + Drizzle ORM
- **검증**: Zod
- **생성**: 로컬 결정론 엔진 기본, OpenAI/Anthropic/OpenRouter 어댑터 선택
- **렌더링/내보내기**: Playwright `playwright-core`, `pptxgenjs`, `@fontsource/*`
- **상태/히스토리**: 결과 검토 화면과 편집기의 로컬 React 상태 기반 실행 취소. `zustand`는 설치되어 있지만 현재 히스토리에 사용되지 않고, `zundo`는 설치되어 있지 않습니다.

주요 경로:

| 경로 | 역할 |
| --- | --- |
| `/` | 정보·요청·레퍼런스 한 번 입력, 자동 생성 시작 |
| `/studio/[id]` | 생성 결과 검토, 필요한 페이지만 부분 수정 |
| `/projects` | 프로젝트 목록·검색·복제·복원·삭제 |
| `/projects/[id]/outline` | 목차/계획 (고급 경로) |
| `/projects/[id]/editor` | 슬라이드 편집기 (고급 경로) |
| `/print/[id]` | 인쇄 미리보기 (`?clean=1`은 UI 제거) |
| `/settings` | 모델·키·사용량·보안 안내 |
| `/api/studio/create` | 자료 분석·구성 계획·전체 슬라이드 생성·스냅샷을 한 번에 처리 |
| `/api/references/analyze` | 참고 자료의 섹션·레이아웃·스타일 단서 분석 |
| `/api/projects/**` | 프로젝트, 목차, 슬라이드, 버전, 디자인, 내보내기 |
| `/api/uploads`, `/api/import-url` | 파일/URL 자료 가져오기 |
| `/api/settings`, `/api/usage` | 설정·사용량 |
| `/api/exports/[filename]` | 생성 파일 다운로드 |

자세한 스키마와 결정은 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), [`docs/RESEARCH.md`](docs/RESEARCH.md), [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md), [`docs/ARCHIVE_FUTURE.md`](docs/ARCHIVE_FUTURE.md)에 있습니다.

---

## 보안 메모

- API 키는 서버 SQLite에 저장하고 UI에는 마스킹된 값만 반환합니다.
- 자료 원문과 AI 결과는 데이터로만 취급하며 임의 HTML/JavaScript를 실행하지 않습니다.
- 업로드: 최대 20MB, 허용 확장자/MIME 검사, 무작위 저장 파일명, 추출 텍스트 12,000자 제한.
- URL 가져오기: 300KB, 12초, 리다이렉트 3회 제한 및 사설/예약 주소·DNS 검사.
- 로그인/권한/다중 사용자 기능은 없습니다. 로컬 또는 신뢰할 수 있는 환경에서 실행하세요.

---

## 문제 해결

| 증상 | 확인 |
| --- | --- |
| `Chrome/Chromium 실행 파일을 찾을 수 없습니다` | Chrome 설치 또는 `.env`에 `CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe` 지정 |
| 포트 충돌 | `3070` 포트를 사용하는 프로세스 확인. 포트를 바꾸면 `APP_URL`도 함께 변경 |
| “로컬 생성으로 처리했습니다” | 선택한 원격 provider 키가 없다는 뜻입니다. `/settings`에서 키를 저장하거나 `local`을 사용하세요 |
| PowerShell에서 npm 실행 실패 | `cmd /c "npm run dev"` 등 `cmd /c`로 감싸 실행 |
| E2E 브라우저를 찾지 못함 | `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 또는 `CHROME_PATH`를 지정하세요. 기본 설정은 설치된 Chrome 채널을 사용합니다. 공유 SQLite 상태 때문에 worker 수는 기본 1입니다. |

---

## 라이선스 · 출처

- 이 프로젝트는 `private: true`이며 별도 LICENSE 파일은 없습니다. 외부 배포 시 각 의존성의 라이선스를 확인하세요.
- 설치된 패키지 기준 주요 라이선스 예: Next.js/React/Zustand/PptxGenJS/better-sqlite3(MIT), Drizzle ORM/Playwright core(Apache-2.0). 정확한 내용은 `node_modules/<패키지>/package.json`과 동봉된 라이선스 파일을 참고하세요.
- **Zundo(MIT)**는 `docs/RESEARCH.md`에서 참고한 undo/redo 미들웨어 후보입니다. 현재 `package.json`에는 없으므로 실제 사용 중인 의존성이 아닙니다.
- 폰트는 `@fontsource/*` 패키지를 통해 로컬 번들링하며, 각 폰트 라이선스는 해당 패키지에 포함된 파일을 따릅니다.
- `docs/RESEARCH.md`에 정리된 오픈소스/스킬은 설계 참고용이며, AGPL 자료의 소스 재사용은 하지 않습니다.
