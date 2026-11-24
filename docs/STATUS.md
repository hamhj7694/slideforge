# SlideForge 구현 상태 — 코드 기준

> 작성 기준일: 2026-11-24  
> 판단 근거: `src/**`, `scripts/seed.ts`, `package.json`, `.env.example`, 기존 `docs/*.md`  
> `npm run typecheck`는 Auto Studio 변경 후에도 통과했습니다. `npm run build`와 `npm run test:e2e`는 아직 실행하지 않았으므로, 아래 상태는 코드/경로 존재 여부와 제한적 API 호출 결과를 함께 반영합니다.

## 상태 정의

| 상태 | 의미 |
| --- | --- |
| **IMPLEMENTED** | UI 또는 API/라이브러리 경로가 코드에 존재하고 연결되어 있음 |
| **PARTIAL** | 핵심 코드는 있으나 범위·검증·정합성에서 빠진 부분이 있음 |
| **NOT IMPLEMENTED** | 문서에만 있거나 코드/라우트/테이블/테스트가 없음 |

> 현재 환경에는 AI API 키가 없습니다. 원격 provider 어댑터와 키 저장 코드는 있지만 **실제 원격 호출 성공 경로는 검증되지 않았습니다.** 기본 동작은 항상 로컬 결정론 엔진 + 폴백 안내입니다.

---

## 기능별 상태 매트릭스

| 기능 영역 | 상태 | 구체적 근거 (파일 / 라우트) | 한계 · 비고 |
| --- | --- | --- | --- |
| Auto Studio 한 번 입력 → 전체 생성 | **IMPLEMENTED** | `src/app/page.tsx`, `POST /api/studio/create`, `src/app/projects/page.tsx`, `src/lib/intake.ts`, `src/lib/schemas.ts`(`studioCreateSchema`) | 자료·요청·레퍼런스를 한 화면에서 받고, 구성 계획→모든 슬라이드→초기 스냅샷을 한 요청으로 처리. 프로젝트 목록의 기본 열기/복제도 `/studio/[id]`로 이동. 로컬 엔진으로 API 201 응답 확인, `/`·`/studio/[id]`·`/projects` HTTP 200 확인 |
| 긴 문장 단서 파싱 | **IMPLEMENTED** | `src/lib/intake.ts`(`parseIntake()`, `materialForSlide()`), `src/lib/ai/local-outline.ts`(`extractExplicitTitles()`, `sentences()`) | `제목/목적/독자/톤/페이지 수`와 쉼표로 이어진 목차 단서를 읽음. 예시 문장으로 `AI 마케터 포트폴리오 / 6페이지 / 6개 제목`이 정확히 생성되는지 API 호출로 확인 |
| 레퍼런스 파일 분석 반영 | **PARTIAL** | `src/lib/ai/reference-analysis.ts`, `POST /api/references/analyze`, `src/app/api/studio/create/route.ts`, `src/lib/ai/local-outline.ts`, `src/lib/ai/index.ts`, `src/lib/ai/prompts.ts` | 섹션 제목·레이아웃·팔레트 단서를 구성/시각 방향에 반영. 규칙 기반이라 복잡한 디자인 해석은 한계 있음 |
| 결과 검토·부분 수정 화면 | **IMPLEMENTED** | `src/app/studio/[id]/page.tsx`, `src/components/StudioWorkspace.tsx`, `src/components/slides/SlideThumbnail.tsx` | 전체 미리보기, 선택 페이지를 줄글로 다시 쓰기(기본), 필드별 직접 수정은 접힌 메뉴, 실행 취소/다시 적용, 버전 복원, PDF/PPTX 내보내기. 줄글 → `rawInput` 저장 → `/generate` 경로를 API로 확인 |
| 프로젝트 생성·목록·복제·복원·소프트 삭제 | **IMPLEMENTED** | `src/app/page.tsx`, `src/app/projects/page.tsx`, `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts`, `src/app/api/projects/[id]/duplicate/route.ts`, `src/app/api/projects/[id]/restore/route.ts`, `src/lib/repo.ts`, `src/lib/db/schema.ts` | 검색, `deletedAt` 포함 보기, 복제 후 목차로 이동 구현됨 |
| 로컬 목차/슬라이드 초안 생성 | **IMPLEMENTED** | `src/lib/ai/local-outline.ts`, `src/lib/ai/local-slide.ts`, `src/lib/ai/index.ts`, `POST /api/projects`, `POST /api/projects/[id]/replan`, `POST /api/projects/[id]/slides/[slideId]/generate` | 키 없이 전체 흐름 가능. 자료 부족 시 빈 셀 유지 |
| 원격 AI provider (OpenAI/Anthropic/OpenRouter) | **PARTIAL** | `src/lib/ai/index.ts`(`resolveConfig()`, 실패 시 로컬 폴백), `src/lib/repo.ts`(`getSettings()`, `getApiKey()`), `GET/PATCH /api/settings`, `src/components/ModelPicker.tsx`, `src/app/settings/page.tsx` | 어댑터/UI/키 저장은 있으나 키 미설정으로 End-to-End 미검증. 호출 실패 시 안내 후 로컬 반환 |
| 자료 입력: 텍스트·파일·URL | **IMPLEMENTED** | `src/components/SourceComposer.tsx`, `POST /api/uploads`, `GET /api/uploads/[storedName]`, `POST /api/import-url`, `src/lib/files.ts`, `src/lib/repo.ts`(`addSource`) | 9종 자료 유형, 20MB 제한, MIME/확장자 검사, 무작위 저장명, 추출 12,000자, URL 300KB/12초/리다이렉트 3회/SSRF 검사 |
| 채용공고 원문 vs AI 요약 분리 | **IMPLEMENTED** | `src/lib/db/schema.ts`(`original_content`, `extracted_content`), `src/app/projects/[id]/outline/page.tsx`(키워드 매핑), `src/components/EditorWorkspace.tsx`(자료 탭) | 편집기 원문 미리보기는 6,000자로 잘림. 원문/요약 글자 수는 표시됨 |
| 개발용 샘플 표기 | **PARTIAL** | `scripts/seed.ts`(`SOURCE_TEXT`, 각주, `MASTER_PROMPT`) | 시드 문구로 “실제 공고 아님”을 명시하지만 코드 전역에 `isSample` 필드/배지가 없음 (`grep isSample` 결과 없음) |
| 12페이지 샘플 시드 | **IMPLEMENTED** | `scripts/seed.ts`(`TITLES`, `SEED_SLIDES`, `main()`), `npm run seed` | 지정된 12개 제목/순서 사용. 6·10페이지는 `내용 입력 필요` 빈 셀. 기존 동일 샘플은 재사용 |
| 목차/계획 화면 (고급 경로) | **IMPLEMENTED** | `src/app/projects/[id]/outline/page.tsx`, `POST /api/projects/[id]/outline`, `POST /api/projects/[id]/replan` | 자동 생성 결과를 깊게 다듬는 경로. 스토리·파트·페이지 편집, 최소 3페이지, 공고 키워드 매핑, 구성 다시 제안 |
| 디자인 프리셋 27종 선택 | **IMPLEMENTED** | `src/lib/design.ts`(`ORIGINAL`, `EXTENDED`, `DESIGN_PRESETS`), `src/components/StylePicker.tsx`, `POST /api/projects/[id]/design`, 편집기 헤더/디자인 탭 | 큐레이션 7종 + 확장 20종. 기본값 `modern-editorial` |
| 확장 스타일 20종 품질 정교화 | **PARTIAL** | `src/components/StylePicker.tsx`(“세부 디자인 품질은 순차적으로 다듬어집니다”), `src/lib/design.ts`(`EXTENDED`) | 모두 선택·적용 가능하지만 세부 품질은 점진 개선 상태 |
| 디자인 변경 지점 (생성·결과 검토·목차·편집) | **IMPLEMENTED** | `src/app/page.tsx`, `src/components/StudioWorkspace.tsx`, `src/app/projects/[id]/outline/page.tsx`, `src/components/EditorWorkspace.tsx`, `POST /api/projects/[id]/design` | Auto Studio 결과 화면에서도 27종 프리셋 변경 가능. 자연어 디자인 요청은 고급 경로에서 전달 |
| 디자인 변경 지점 (완료 후 Settings) | **NOT IMPLEMENTED** | `src/app/settings/page.tsx`에는 provider/model/key/usage/보안 섹션만 존재 | `docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md`가 요구하는 “완료 후 Settings” 디자인 UI 없음 |
| 변경 전 스냅샷 | **IMPLEMENTED** | `src/lib/repo.ts`(`snapshotProjectVersion`, `snapshotSlideVersion`), `src/app/api/projects/[id]/route.ts`, `outline/route.ts`, `design/route.ts`, `regenerate/route.ts`, `slides/reorder/route.ts`, `slides/[slideId]/route.ts`, `slides/[slideId]/generate/route.ts`, `slides/[slideId]/revise/route.ts`, `versions/route.ts` | “삭제 이전 스냅샷”, “디자인 변경 이전”, “전체 재생성 이전” 등 라벨로 기록 |
| 버전 목록·복원 | **IMPLEMENTED** | `GET /api/projects/[id]/versions`, `POST /api/projects/[id]/versions/[versionId]/restore`, `src/components/StudioWorkspace.tsx`, `src/components/EditorWorkspace.tsx`(버전 탭), `src/lib/repo.ts`(`restoreProjectVersion`, `restoreSlideVersion`) | Auto Studio가 ‘처음 생성한 상태’ 스냅샷을 남기고 결과 화면에서 복원 가능 |
| “새로 만들기”와 “새 버전” 분리 | **PARTIAL** | `src/app/page.tsx`는 새 프로젝트 생성, `src/components/EditorWorkspace.tsx`의 `addVersion()`은 `POST /api/projects/[id]/versions` | 문서가 요구하는 별도 `/new-version` 라우트/디자인 변형 엔티티 없음. 현재 “새 버전”은 수동 스냅샷 |
| 셀 단위 텍스트/이미지 편집 | **IMPLEMENTED** | `src/components/EditorWorkspace.tsx`(`onTextChange`, `onImageChange`), `src/components/slides/SlideRenderer.tsx`, `src/app/api/projects/[id]/slides/[slideId]/route.ts` PATCH | `slide.content`만 갱신. 잠긴 슬라이드는 편집 차단 |
| 시각 오버라이드 (`visualOverrides`) | **IMPLEMENTED** | `EditorWorkspace.tsx`(`onOverrideChange`, `toggleHidden`, `Alt + 드래그`), `SlideRenderer.tsx`, `src/lib/types.ts` | `x/y/width/height/z/hidden` 지원. 드래그 리사이즈 핸들은 없고 숫자 입력으로 조정 |
| 의미 단위 레이아웃 선택 | **IMPLEMENTED** | `src/lib/types.ts`(`LAYOUT_KINDS`, `LAYOUT_LABELS`), `outline/page.tsx`, `EditorWorkspace.tsx`, `SlideRenderer.tsx` | 목차 화면과 편집기에서 변경 가능 |
| 페이지 순서 변경 | **PARTIAL** | `outline/page.tsx`(위/아래 버튼), `POST /api/projects/[id]/slides/reorder`, `src/lib/repo.ts`(`reorderSlides`) | 편집기 드래그 리오더 없음. 순서 변경은 실행 취소 히스토리에 포함되지 않음 |
| 실행 취소/다시 실행 | **PARTIAL** | `src/components/StudioWorkspace.tsx`, `src/components/EditorWorkspace.tsx`(`actions`, `redoActions`, `undo()`, `redo()`, keydown 처리) | 결과 검토 화면과 편집기에서 `Ctrl/Cmd+Z`, `Ctrl/Cmd+Shift+Z`, `Ctrl+Y` 지원. 입력 중에는 무시. 로컬 상태 기반이라 새로고침/생성 시 초기화, 페이지 리오더 미포함. Zustand/zundo 아님 |
| 자동 저장 | **IMPLEMENTED** | `src/components/EditorWorkspace.tsx`(`persist()`, 450ms 디바운스), `PATCH /api/projects/[id]/slides/[slideId]` | 실패 시 화면에 오류 알림 |
| 페이지 잠금 | **IMPLEMENTED** | `EditorWorkspace.tsx`(`toggleLock`, 편집 핸들러 가드), `SlideRenderer.tsx`(`editable`), `POST /api/projects/[id]/regenerate`(`respectLocked`) | 잠긴 페이지는 텍스트/배치 편집과 생성에서 제외 옵션 제공 |
| 슬라이드 생성/부분 수정/전체 재생성 | **IMPLEMENTED** | `POST /api/projects/[id]/slides/[slideId]/generate`, `/revise`, `POST /api/projects/[id]/regenerate`, `src/lib/ai/index.ts` | 생성/수정/재생성 전 슬라이드 또는 프로젝트 스냅샷 저장 |
| 인쇄 미리보기 | **IMPLEMENTED** | `src/app/print/[id]/page.tsx`, `/print/[id]?clean=1`, `src/components/slides/slides.css`(`@media print`) | `@page` 1280×720, 여백 0, 한 슬라이드당 한 페이지 |
| PDF 내보내기 | **IMPLEMENTED** | `src/lib/exporters.ts`(`exportPdf()`), `GET /api/projects/[id]/export?format=pdf`, `GET /api/exports/[filename]`, `src/lib/exporters.ts`(`findChrome()`) | `printBackground: true`, 텍스트 선택 가능. 이번 문서 작업에서 런타임 검증은 하지 않음 |
| PPTX 내보내기 (이미지 기반) | **IMPLEMENTED** | `src/lib/exporters.ts`(`exportPptx()`), `GET /api/projects/[id]/export?format=pptx`, `pptxgen` `LAYOUT_WIDE`, 페이지별 PNG 캡처 | `EXPORT_SCALE` 기본 2. 생성된 PPTX는 이미지라 텍스트/도형 편집 불가 |
| 편집 가능한 PPTX | **NOT IMPLEMENTED** | `docs/IMPLEMENTATION_PLAN.md` §4, `docs/ARCHIVE_FUTURE.md` §4에서 보류 | 이미지 PPTX 이후 단계로 명시됨 |
| 삭제 안전장치 | **IMPLEMENTED** | `src/components/DeleteDialog.tsx`, `src/app/projects/page.tsx`, `src/components/EditorWorkspace.tsx`, `DELETE /api/projects/[id]`, `DELETE /api/projects/[id]/slides/[slideId]`, `POST /api/projects/[id]/restore`, `src/lib/repo.ts`(`softDeleteProject`) | 대상 제목/영향 범위 표시, 정확히 `삭제` 입력 + 동의 체크, 소프트 삭제, 스냅샷, 복원 |
| 설정: provider/model/Base URL/키/사용량 | **IMPLEMENTED** | `src/app/settings/page.tsx`, `GET/PATCH /api/settings`, `GET /api/usage`, `src/lib/repo.ts`(`getSettings`, `saveSettings`, `getUsageSummary`) | DB 저장 키가 env보다 우선, 응답 마스킹 `첫 6자···마지막 4자` |
| 보안: 업로드/SSRF/콘텐츠 처리 | **IMPLEMENTED** | `src/lib/files.ts`, `src/app/api/import-url/route.ts`, `src/lib/schemas.ts`, `src/components/slides/SlideRenderer.tsx` | `dangerouslySetInnerHTML`/`eval`/`new Function` 사용 없음. 인증·속도 제한은 범위 밖 |
| E2E 테스트 | **PARTIAL** | `playwright.config.ts`, `tests/helpers/api.ts`, `tests/a-local-first.spec.ts` ~ `tests/j-security.spec.ts`, `package.json`(`test:e2e`) | 기존 단계형 흐름 위주 시나리오 존재. `/api/studio/create`와 `/studio/[id]` 검토 화면은 아직 E2E에 포함되지 않음. 단일 worker 기본, 이번 작업에서는 미실행 |
| Archive / RAG / vector DB / Notion / 채용 플랫폼 API | **NOT IMPLEMENTED** | `docs/ARCHIVE_FUTURE.md`, `docs/RESEARCH.md` §1·§4, `docs/IMPLEMENTATION_PLAN.md` §4 | 문서/인터페이스 설계만 존재. 관련 라우트·DB 테이블·UI 없음 |
| 기획·AI 지시문에 자동 생성 흐름 반영 | **IMPLEMENTED** | `docs/PRODUCT_SPEC.md` §1·§3·§4.10·§6.1~6.3, `src/lib/ai/prompts.ts`, `README.md`, `src/components/TopBar.tsx`, `src/components/EditorWorkspace.tsx`, `src/app/projects/[id]/outline/page.tsx` | “입력 한 번 → 자동 생성 → 필요한 부분만 수정”을 제품 정의, 핵심 경로, 목차/슬라이드/디자인 프롬프트에 반영. `v2` 배지 제거, “AI 전체 재추천”→“구성 다시 제안”, Sparkles 아이콘 정리 등 카피 정리 포함 |
| 참고 자료/스킬 문서 | **IMPLEMENTED** | `docs/RESEARCH.md`, `.opencode/skills/**` | Presenton은 참고만, AGPL 자료 소스 재사용 금지 등 방침 문서화됨 |

---

## 알려진 한계

1. **원격 AI 미검증**: 키가 없어 `local → remote` 성공 경로, 원격 실패 후 폴백, 사용량/비용 기록의 실제 원격 호출 값을 확인하지 못했습니다.
2. **PPTX는 이미지 기반**: 생성된 PPTX의 텍스트와 도형은 편집할 수 없습니다. 편집형 PPTX는 보류 상태입니다.
3. **확장 스타일 20종**: 선택과 적용은 되지만 세부 디자인 품질은 순차적으로 다듬어지는 중입니다.
4. **Settings에 디자인 UI 없음**: 요구사항의 “완료 후 Settings” 디자인 변경 경로가 빠져 있습니다.
5. **`isSample` 없음**: 개발용 샘플은 문구로만 구분되고 구조화된 플래그/배지가 없습니다.
6. **Undo/redo 범위 제한**: 로컬 React 상태 기반이며 페이지 리오더가 포함되지 않습니다. `zundo`는 설치되지 않았고 `zustand`도 히스토리에 사용되지 않습니다.
7. **캔버스 조작 제한**: 이동은 `Alt + 드래그`, 크기/순서는 숫자 입력입니다. 페이지 드래그 리오더와 리사이즈 핸들이 없습니다.
8. **E2E 미실행**: `playwright.config.ts`와 `tests/**` 시나리오는 존재하지만 이번 문서 작업에서 `npm run test:e2e`를 실행하지는 않았습니다. 공유 SQLite/설정 row 때문에 기본 worker는 1입니다.
9. **단일 사용자 가정**: 로그인, 권한, 속도 제한, 공유/협업 기능이 없습니다.
10. **빌드/E2E 미실행**: Auto Studio 변경 후 `npm run typecheck`는 통과했지만 `npm run build`, `npm run test:e2e`는 실행하지 않았습니다.
11. **Auto Studio E2E 공백**: 새 입력 화면, `/api/studio/create`, `/studio/[id]` 검토 화면을 그리는 브라우저 테스트가 없습니다. API 호출로 201 응답과 페이지 생성은 확인했지만 화면 단위 회귀 검증은 남아 있습니다.
12. **자료 없는 페이지의 일반 문구**: 근거 자료가 없으면 “해당 주제의 핵심 근거를 정리한다” 수준의 일반 문장이 채워집니다. 근거 없는 성과·수치는 만들지 않지만, 완전히 빈 셀을 원하면 고급 편집기에서 직접 지워야 합니다.

---

## 다음 우선순위

1. **Auto Studio E2E 추가**: 긴 문장 파싱과 전체 생성 API는 호출로 확인했습니다. 남은 작업은 `/` 입력 → `/studio/[id]` 검토 → 부분 수정 → 내보내기까지 브라우저 시나리오로 고정하는 것입니다.
2. **문서-코드 정합성 먼저**: Settings 디자인 UI 추가 또는 사양 수정, `isSample` 플래그/배지 추가 또는 정책 문구 정리, `new-version` 동작 정의.
3. **원격 AI 검증**: 테스트 키로 OpenAI/Anthropic/OpenRouter 호출, 실패 폴백 안내, 사용량/비용 기록을 확인.
4. **편집 히스토리 보강**: 페이지 리오더를 undo 대상에 포함하고, 새로고침 후에도 유지되는 히스토리 저장소 검토.
5. **캔버스 사용성**: 드래그 리사이즈 핸들, 페이지 드래그 리오더.
6. **테스트 유지**: 기존 `playwright.config.ts`와 핵심 흐름(Auto Studio 생성 → 결과 검토 → 편집 → PDF/PPTX → 삭제/복원) E2E를 실제로 실행하고 결과를 문서에 반영.
7. **디자인 품질**: 확장 20종의 타이포그래피·여백·컨트라스트 점검 및 순차 개선.
8. **장기 과제**: 편집 가능한 PPTX, Archive/RAG 연동은 별도 단계로 유지.

---

## 문서와 코드의 주요 불일치 요약

| 문서/요구사항 | 실제 코드 |
| --- | --- |
| `docs/ARCHITECTURE.md`: Settings에서 디자인 조회·변경 | `/settings`에 디자인 섹션 없음 |
| `isSample: true` + UI 배지 요구 (`docs/ARCHITECTURE.md`, `docs/IMPLEMENTATION_PLAN.md`) | 코드에 `isSample` 없음. 시드 문구로만 표기 |
| `/api/projects/:id/new-version`, 버전드 디자인 변형 요구 | `/versions` 스냅샷 POST만 존재 |
| Zustand/zundo 기반 undo/redo 요구 | 편집기 로컬 상태 배열 기반, zundo 미설치 |
| 페이지 리오더가 undo 대상 요구 (`docs/IMPLEMENTATION_PLAN.md`) | reorder API와 목차 버튼은 있으나 undo 히스토리에는 미포함 |
| 이미지 기반 PPTX는 “PDF 검증 후 착수” 요구 (`docs/IMPLEMENTATION_PLAN.md`) | PDF와 PPTX가 동일한 내보내기 UI/API에서 함께 활성화되어 있음 |
| `GET/PUT /api/settings/keys`, `/api/export/pdf`, `/api/documents/...` 등 제안 경로 | 실제 경로는 `/api/settings`, `/api/projects/[id]/export`, `/api/projects/[id]/...` |
