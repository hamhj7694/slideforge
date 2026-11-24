# Archive Workspace — 미래 설계 (미구현)

> **상태: 문서/인터페이스 설계만 존재. Phase 1에서는 구현하지 않음.**
>
> 금지/보류: RAG, vector DB, 전체 Archive UI, Notion sync, 채용 플랫폼 API, DocumentChunk/Embedding 저장, SourceLink 자동 인용.
> 현재는 Portfolio Builder Workspace만 구현하며, 개발용 샘플 공고는 `isSample` 배지로 표시하고 실제 공고는 사용자가 이후 입력한다.

## 1. 미래 엔티티

| 엔티티 | 주요 필드(제안) | 역할 |
| --- | --- | --- |
| `ArchiveItem` | `id`, `title`, `sourceType`(pdf/docx/pptx/web/note), `sourceUri?`, `capturedAt`, `ownerId`, `tags[]`, `deletedAt?` | 아카이브에 수집된 자료의 최상위 단위 |
| `DocumentVersion` | `id`, `archiveItemId`, `versionNo`, `contentHash`, `storagePath`, `parserVersion`, `parsedAt` | 같은 자료의 버전/파싱 결과 추적 |
| `Evidence` | `id`, `archiveItemId`, `documentVersionId`, `excerpt`, `page?`, `paragraph?`, `span?`, `confidence` | 답변/슬라이드 근거가 되는 인용 조각 |
| `JobPosting` | `id`, `company`, `title`, `rawText`, `requirements`, `isSample`, `createdAt` | 공고 원문; 샘플은 실공고로 오인되지 않게 표시 |
| `DocumentChunk` | `id`, `documentVersionId`, `text`, `tokenCount`, `headingPath[]`, `order` | 검색/임베딩 단위 |
| `Embedding` | `id`, `chunkId`, `model`, `dimensions`, `vectorRef`, `createdAt` | 벡터 검색용 임베딩 메타; 미래 `sqlite-vec` 사용 |
| `SourceLink` | `id`, `targetType`, `targetId`, `archiveItemId`, `documentVersionId`, `locator`, `quote` | 생성 결과 → 근거 자료 연결 |
| `ArchiveCollection` | `id`, `name`, `description`, `ownerId`, `itemIds[]` | 자료 묶음(예: "공카 지원 2026") |

관계 개요:

```text
JobPosting (isSample 구분)
      └─(참고)─ ArchiveCollection ─< ArchiveItem
                                      ├─< DocumentVersion
                                      │    └─< DocumentChunk ─< Embedding
                                      └─< Evidence ─< SourceLink ─> 생성 슬라이드/답변
```

`DocumentVersion` 이름은 로컬 문서 버전(`docs/ARCHITECTURE.md`)과 개념이 겹치므로, 구현 시에는 `ArchiveDocumentVersion`으로 명시적으로 구분한다. Phase 1의 `versions(kind='project')` 불변 스냅샷은 디자인 변경·전체 재생성·새로 만들기·새 버전 전에 기존 포트폴리오 결과를 보존하는 **Product Workspace** 기능이고, 미래 `ArchiveDocumentVersion`은 수집 문서의 파싱 버전을 추적하는 **Archive** 기능이다. 둘은 저장 목적과 수명 주기가 다르므로 혼용하지 않는다.

## 2. 미래 처리 흐름 (전 단계 미구현)

```text
ingest → parse → metadata → dedupe → chunk → embed → hybrid search → source-link
```

| 단계 | 예상 동작 | 후보 기술 | 현재 상태 |
| --- | --- | --- | --- |
| `ingest` | PDF/DOCX/PPTX/노트/URL 수집, 원본 보존, `isSample` 판별 | JSZip(컨테이너), 내부 업로드 API | 미구현 |
| `parse` | 텍스트/페이지/표/머리말 추출 | `pdfjs-dist`(PDF), `Mammoth`(DOCX), `officeParser`(PPTX), 미래 `docling` | 미구현(라이브러리만 설치/조사됨) |
| `metadata` | 제목, 날짜, 출처, 태그, 섹션 경로, 언어 추출 | Zod 스키마 | 미구현 |
| `dedupe` | `contentHash` + 유사도로 중복 문서/청크 제거 | SHA-256, 이후 simhash | 미구현 |
| `chunk` | 섹션 경계를 존중하는 토큰 단위 분할 | `headingPath` 보존 | 미구현 |
| `embed` | 청크 벡터화 및 저장 | 미래 `asg017/sqlite-vec` (Apache-2.0) | 미구현, Phase 1 미도입 |
| `hybrid search` | 키워드(FTS) + 벡터 검색 결합, 재랭킹 | SQLite FTS + sqlite-vec | 미구현 |
| `source-link` | 인용 조각을 `Evidence`/`SourceLink`로 연결 | UI에서 근거 패널 표시 | 미구현 |

### source-link 원칙

- 근거 없는 문장은 아카이브 답변/슬라이드에 표시하지 않는다.
- `SourceLink`에는 `documentVersionId`와 페이지/문단 locator, 원문 quote가 반드시 포함된다.
- 샘플 공고에서 추출한 내용은 "샘플 기반 예시"로만 노출하고 실제 지원 근거로 사용하지 않는다.

## 3. 인터페이스만 먼저 정의하는 것

Phase 1 문서에서는 다음 인터페이스 형태만 합의한다. 구현/라우트/DB 테이블은 만들지 않는다.

```ts
// 개념적 타입 예시 — 실제 코드 아님
ArchiveItem { id, title, sourceType, sourceUri?, capturedAt, tags[], deletedAt? }
ArchiveDocumentVersion { id, archiveItemId, versionNo, contentHash, parserVersion }
Evidence { id, archiveItemId, excerpt, locator, confidence }
SourceLink { id, targetType, targetId, evidenceId }
```

필요해지면 `docs/ARCHITECTURE.md`의 엔티티 관계를 확장하되, Portfolio Builder의 `slide.content` 단일 소스 원칙은 변경하지 않는다.

## 4. 보류 사항 체크리스트

- [ ] Archive UI(목록/업로드/근거 패널) 구현 — 보류
- [ ] RAG 검색 및 vector DB(`sqlite-vec`) 도입 — 보류
- [ ] Notion sync — 보류
- [ ] 채용 플랫폼 API 연동 — 보류
- [ ] `docling` 같은 대형 Python 파이프라인 도입 — 보류
- [ ] 편집 가능한 PPTX 생성 — 보류(PDF → 이미지 PPTX 이후)
