# SlideForge 아키텍처

## 1. 전체 흐름

```text
[디자인 선택/변경: 생성 composer · 목차/계획 · 에디터 · 완료 후 Settings]
   ↓ preset + 자연어 디자인 방향 (기본 Modern Editorial)

[새로 만들기 / 전체 재생성 / 디자인 변경 / 에디터 새 버전]
   ↓ 변경 전 versions(kind='project') 불변 스냅샷 저장
   ↓ 기존 결과 보존 → 버전 목록에서 전환/복원 가능

[프롬프트/샘플 공고]
   ↓ rawInput (isSample 표시)
[AI Adapter: local deterministic 기본 → remote 선택]
   ↓ Zod 검증
[structured slide.content] ── 단일 텍스트 소스
   ↓ semantic layout + elementId
[layout overrides: 위치/크기/순서/숨김]
   ↓ design preset + 자연어 디자인 방향
[rendered HTML — 파생값, 캐시 가능]
   ↓ Playwright(설치된 Chrome)
[PDF — Phase 1]
   ↓ PDF 검증 이후
[PNG 슬라이드 → PptxGenJS 이미지 기반 PPTX — Phase 2]
```

핵심 원칙: **텍스트는 한 곳만 수정하고, 움직임은 별도 오버라이드로 저장한다. 렌더링 결과는 저장 대상이 아니라 파생 결과다. 디자인/재생성/새로 만들기/새 버전은 먼저 불변 프로젝트 스냅샷을 남긴 뒤에만 적용한다.**

## 2. 데이터 분리 (5계층)

| 계층 | 저장 내용 | 변경 주체 | 주의 |
| --- | --- | --- | --- |
| `rawInput` | 사용자 프롬프트, 개발용 샘플 공고 원문, `isSample`, 입력 시각, 향후 `jobPostingId` | 입력 화면 | 샘플은 절대 실공고로 표시하지 않음 |
| `structured content` | `slides[].content`: 제목/본문/불릿/수치/이미지 참조 등 의미 단위, 각 요소의 안정적 `elementId` | AI 생성 + 텍스트 편집 | **유일한 텍스트 진실 소스**; 누락 페이지는 빈 셀 유지 |
| `visual layout overrides` | `elementId` → `{x, y, width, height, zIndex, rotation?, hidden?}`, semantic layout variant, 페이지 순서 | 캔버스 드래그/리사이즈, 리오더 | 텍스트 복사 금지; `elementId`가 없으면 새로 부여하지 않고 오버라이드를 무시/재매핑 |
| `rendered HTML` | content + layout + design을 합친 출력용 HTML | 렌더러 | 파생/캐시; 직접 편집 금지; 인쇄 CSS 포함 |
| `versions` | `kind='project'` 불변 스냅샷: 위 4계층 + 자연어 디자인 방향 + 프롬프트 + provider/model 참조 + 디자인 프리셋 + 생성 모드 | 디자인 변경·전체 재생성·새로 만들기·새 버전 전 자동 저장 | 변경 전 선 저장, 절대 덮어쓰지 않음; 버전 목록에서 전환/복원; 원격 키 값은 절대 저장하지 않고 키 식별자만 참조 |

`src/lib/types.ts`, `src/lib/schemas.ts`(Zod), `src/lib/design.ts`가 이 계층의 계약을 담당한다. `src/lib/db/schema.ts` + `src/lib/db/index.ts`가 SQLite/Drizzle 영속화를 담당한다.

디자인 프리셋과 자연어 디자인 방향은 design 계층의 일부이며, 생성 전·중·후 모든 진입점에서 동일한 값을 읽고 쓴다.

## 3. 엔티티 관계

```text
Project (1)
 └─ Document (N) ─ designPreset (기본 Modern Editorial) + designDirection(자연어)
     ├─ RawInput (1)            isSample, prompt, sourceText
     ├─ Slide (N) ─ SlideContent (1) ─ Element (N, elementId)
     │              └─ LayoutOverride (N, elementId key)
     ├─ Version (N, kind='project')  불변 스냅샷: content+layout+design+direction
     └─ ExportArtifact (N)      pdf | pptx-image (나중)

ApiKeySetting (server-only, Document와 무관)
GenerationNotice (응답에 포함: fallback 사유/문구)

[미래, 미구현] ArchiveItem → ArchiveDocumentVersion/Evidence/SourceLink/JobPosting/Chunk/Embedding/Collection
```

- `elementId`는 생성 시 부여되어 텍스트 수정, 이동, 버전 복원, 내보내기 전반에서 동일하게 유지된다.
- 페이지 순서는 `Slide.order`와 `LayoutOverride`의 리오더 이벤트로 표현하고, Zustand 히스토리에 기록한다.
- 삭제는 soft delete(`deletedAt`)이며 `삭제` 입력 + 동의 체크박스가 있어야 실행된다. 복구 API가 반대 동작을 제공한다.
- 디자인 프리셋/자연어 디자인 방향은 생성 composer, 목차/계획 화면, 에디터, 완료 후 Settings에서 모두 조회·변경 가능하다.
- 디자인 변경, 전체 재생성, 메인 생성의 "새로 만들기", 에디터의 "새 버전"은 모두 `versions(kind='project')` 불변 스냅샷을 먼저 저장한 뒤 적용한다. 기존 결과는 덮어써지지 않고 버전 목록에서 전환/복원한다.
- "새로 만들기"는 다른 스타일로 **별도 새 프로젝트**를 만들고, 에디터 "새 버전"은 현재 프로젝트의 버전드 디자인 변형을 만든다.

## 4. API 표면 (제안)

| Method | Path | 목적 | 핵심 규칙 |
| --- | --- | --- | --- |
| `GET` | `/api/models` | provider/model 목록 + `available` 상태 | 키 유무만 반환, 키 값은 반환하지 않음 |
| `POST` | `/api/projects` | 새 프로젝트 생성(다른 디자인 스타일 가능) | 기본 Modern Editorial; 메인 생성 "새로 만들기"는 별도 프로젝트; 기존 덮어쓰기 금지 |
| `POST` | `/api/generate/outline` | 12개 목차 생성 | 로컬 결정적 생성 기본, 빈 셀 허용 |
| `POST` | `/api/generate/slides` | 목차 기반 슬라이드 content 생성 | Zod 검증, `elementId` 부여 |
| `GET` | `/api/documents/:id` | 문서 + 슬라이드 + 오버라이드 로드 | 마스킹된 설정만 함께 전달 |
| `PATCH` | `/api/documents/:id/design` | 디자인 프리셋/자연어 방향 변경 | composer·계획·에디터·완료 후 Settings 공용; 변경 전 `versions(kind='project')` 선 저장 |
| `PATCH` | `/api/documents/:id/slides/:slideId/content` | 텍스트 편집 | `slide.content`만 갱신, 텍스트 복제 금지 |
| `PATCH` | `/api/documents/:id/slides/:slideId/layout` | 위치/크기 오버라이드 저장 | `elementId` 키, content 변경 없음 |
| `POST` | `/api/documents/:id/reorder` | 페이지 순서 변경 | Zustand 히스토리와 연동 |
| `POST` | `/api/projects/:id/versions` | `kind='project'` 불변 스냅샷 저장/이름 지정 | 디자인 변경·전체 재생성·새로 만들기·새 버전 전 자동 선행; 기존 결과 덮어쓰기 금지 |
| `POST` | `/api/projects/:id/versions/:versionId/restore` | 버전 전환/복원 | content+layout+design+direction 함께 복원 |
| `POST` | `/api/projects/:id/new-version` | 현재 프로젝트의 버전드 디자인 변형 생성 | 스냅샷 선행, 새 버전 레코드; 별도 프로젝트 아님 |
| `GET/PUT` | `/api/settings/keys` | 키 마스킹 조회 / 교체 | GET은 `sk-****abcd` 형태만, PUT은 서버 SQLite 저장 |
| `POST` | `/api/export/pdf` | 인쇄용 HTML → PDF | Phase 1 필수 |
| `POST` | `/api/export/pptx` | PNG 슬라이드 → 이미지 PPTX | **PDF 동작 이후에만 활성화** |
| `POST` | `/api/documents/:id/delete` | soft delete | body: `{ confirmText: "삭제", consent: true }` |
| `POST` | `/api/documents/:id/restore-deleted` | 삭제 복구 | soft-deleted 문서만 대상 |

Undo/redo는 Zustand 히스토리로 처리하고, 커밋 시점에 위 PATCH/POST로 서버에 반영한다. 히스토리는 텍스트 편집과 페이지 리오더를 모두 포함한다. 디자인 변경·전체 재생성·새로 만들기·새 버전 요청은 `versions(kind='project')` 선 저장이 완료되지 않으면 거부한다.

## 5. AI provider 폴백 체인

1. UI 선택 확인: 프롬프트 입력창 근처 / 에디터 헤더의 provider·model dropdown 값을 읽는다.
2. 선택된 모델이 `local`이면 `src/lib/ai/local-outline.ts`, `src/lib/ai/local-slide.ts`로 결정적 생성한다.
3. 선택된 모델이 remote이고 서버에 해당 키가 있으면 원격 어댑터를 호출한다.
4. 선택된 모델인데 **키가 없으면** 로컬 생성으로 전환하고 응답에 명시적 notice를 포함한다.
   - 예: `선택한 모델의 API 키가 없어 로컬 생성으로 전환했습니다. Settings에서 키를 등록하면 해당 모델을 사용할 수 있습니다.`
5. 원격 호출 실패/타임아웃/스키마 검증 실패 시에도 로컬로 폴백하고 같은 방식으로 알린다.
6. 어떤 경로에서도 자료가 없는 페이지의 내용을 생성하지 않는다. 빈 셀을 유지한다.
7. Settings에서 키는 언제든 교체/삭제 가능하며, 교체 후 다음 생성부터 적용된다.

환경 변수에 AI 키가 없는 현재 상태에서는 1→2 경로가 정상 경로다.

## 6. 내보내기 파이프라인

### PDF (Phase 1 우선)

```text
slide.content + design preset + designDirection(자연어) + layout overrides
 → print-safe HTML (페이지 고정, 폰트/여백/페이지 브레이크 명시)
 → Playwright가 설치된 Chrome 실행
 → page.pdf({ printBackground: true, preferCSSPageSize: true })
 → 12페이지 PDF 다운로드
```

- 출력물은 12페이지 고정 목차를 따라야 하며, 빈 셀은 빈 영역으로 남는다.
- 생성/편집/리오더/버전 복원 후에도 동일한 HTML 파이프라인을 거쳐 결과가 일관되어야 한다.

### PPTX (Phase 2, PDF 검증 후)

```text
검증된 PDF/HTML → 슬라이드별 PNG → PptxGenJS addImage(full-slide) → .pptx
```

- 이미지 기반이므로 텍스트 편집은 불가능하지만 레이아웃은 PDF와 동일하다.
- **편집 가능한 PPTX**는 이후 별도 단계다.

### 참고 라이브러리 현황

- `pdfjs-dist`, `Mammoth`, JSZip, `officeParser` 후보는 설치/조사된 향후 문서 파싱 자산이며 Phase 1 생성 파이프라인에는 사용하지 않는다.

## 7. 보안 및 안전 규칙

- API 키는 **서버 측 SQLite에만** 저장하고 클라이언트 응답·로그·에러 메시지·버전 스냅샷에 노출하지 않는다.
- Settings GET은 마스킹된 값만 반환하고, 변경은 PUT으로 즉시 반영한다.
- 프롬프트/업로드/생성 결과는 Zod로 검증하고, HTML 렌더링 시 위험 콘텐츠를 이스케이프한다.
- 개발용 공고는 `isSample: true` + UI 배지로 항상 표시한다. 실제 공고는 사용자가 이후 입력하며, 샘플 문구를 실지원 이력처럼 서술하지 않는다.
- 누락 정보는 "빈 셀"로 유지한다. 그럴듯한 문장을 자동 완성하지 않는다.
- 삭제는 `삭제` 정확 입력 + 동의 체크박스 + soft delete + restore 흐름만 허용한다.
- 원격 모델을 사용하더라도 키가 없는 사용자에게는 로컬 경로와 폴백 안내를 보장한다.
- 디자인 변경·전체 재생성·"새로 만들기"·"새 버전"은 `versions(kind='project')` 불변 스냅샷 없이 실행하지 않는다. 기존 결과를 덮어쓰지 않으며 버전 목록에서 이전 상태로 전환/복원할 수 있어야 한다.
