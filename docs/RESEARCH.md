# SlideForge 기술 조사 및 선택 근거

- 조사 기준일: 2026-11-24 (GitHub API 스냅샷)
- 조사 범위: AI 덱 생성기, 캔버스/DRAG 라이브러리, 내보내기, 문서 파싱, 향후 RAG, 디자인 레퍼런스, 프로젝트 스킬
- 확정 전제: Next.js 15.5.29 + React 19 + TypeScript + Tailwind 3, SQLite(better-sqlite3) + Drizzle ORM, Zod, Zustand, Playwright(Chrome 설치됨), PptxGenJS, pdfjs-dist, Mammoth, JSZip
- 현재 제약: 환경 변수에 AI API 키 없음 → **로컬 결정적 생성이 기본 경로**

## 1. 핵심 비교: Presenton 확장 vs 독립 구현

| 기준 | Presenton 확장 | 독립 구현 + 집중형 라이브러리 (채택) |
| --- | --- | --- |
| 초기 비용 / 배포 | 풀스택 AI 덱 서버를 함께 운영; 셀프호스팅 무게 큼 | 기존 Next.js/SQLite 프로젝트 안에서 점진 구현 |
| AI 키 의존 | 생성 흐름이 외부 모델/서버에 강하게 결합 | 키 없이도 로컬 생성 가능, 키는 선택 사항 |
| 데이터 주권 | 덱 모델/파이프라인을 상대 프로젝트 구조에 맞춤 | `rawInput / content / layout / version`을 우리 스키마로 완전 소유 |
| 편집 모델 | 기존 편집기 정책을 따라가야 함 | 텍스트 단일 소스 + elementId 기반 레이아웃 오버라이드로 설계 가능 |
| PDF 우선 | 덱 생성 전체가 먼저 부담 | Playwright Chrome 기반 PDF를 Phase 1로 좁혀 구현 |
| PPTX 전략 | 프로젝트 기본 출력에 의존 | PDF 검증 후 이미지 기반 PPTX(PptxGenJS), 이후 편집형 PPTX |
| 보안/키 관리 | 서버 구조에 의존 | API 키 server-only SQLite, UI 마스킹, 교체 가능 |
| 샘플/실공고 분리 | 별도 개념 없음 | `isSample` 플래그로 개발 샘플을 실공고로 오인하지 않게 표시 |
| 결론 | **아키텍처 참고만** | **독립 구현 채택** |

> 결정: Presenton은 "어떤 단계가 있는가"에 대한 참고 사례로만 사용하고, 코드/스키마/UI를 재사용하지 않는다. SlideForge는 Portfolio Builder Workspace를 먼저 만들고, Archive는 문서/인터페이스 설계만 유지한다.

## 2. 리포지토리 조사 결과

| 프로젝트 | 라이선스 | Stars | 마지막 push | 강점 | SlideForge 판단 |
| --- | --- | --- | --- | --- | --- |
| `presenton/presenton` | Apache-2.0 | 12,022 | 2026-11-23 | 완성형 AI 덱 생성기, 전체 흐름 참고용 | 셀프호스팅 부담 → **참고만, 확장 안 함** |
| `slidevjs/slidev` | MIT | 49,603 | 2026-11-05 | Markdown 기반 개발자 친화적 프레젠테이션 | 협업 HTML 캔버스 에디터와 목적 다름 → 채택 안 함 |
| `gitbrent/PptxGenJS` | MIT | 6,399 | 2025-11-28 | Node에서 PPTX 생성 안정적 | **Phase 2 이미지 기반 PPTX**에 채택 |
| `daybrush/moveable` | MIT | — | 2024-06-03 | 정교한 변형 핸들 | 갱신 정체 → 채택 안 함 |
| `bokuweb/react-rnd` | MIT | — | 2026-05-12 | React 이동/리사이즈, 유지보수됨 | 캔버스 오버라이드 후보 **1순위** |
| `puckeditor/puck` | MIT | — | 2026-11-23 | 매우 활발한 비주얼 에디터 | 기능 과다/무게 큼 → 참고만 |
| `clauderic/dnd-kit` | MIT | — | 2026-10-31 | 페이지 순서 변경, 접근성 좋은 DnD | **페이지 리오더** 후보 |
| `pmndrs/zustand` | MIT | — | 2026-11-23 | 가벼운 상태 관리 | **이미 설치됨**, 편집 상태 저장소 |
| `charkour/zundo` | MIT | — | 2026-01-30 | Zustand undo/redo 미들웨어 | 히스토리 구현 참고/후보 |
| `harshankur/officeParser` | MIT | — | 2026-11-18 | PPTX 텍스트 추출 후보 | 향후 Archive 파싱 후보 |
| `mwilliamson/mammoth.js` | BSD-2-Clause | — | 2026-10-16 | DOCX → HTML 변환 | **이미 설치됨**, 향후 DOCX 파싱 |
| `docling-project/docling` | MIT | — | 2026-11-23 | 강력한 문서 변환 파이프라인 | Python 대형 의존성 → 미래 검토 전용 |
| `asg017/sqlite-vec` | Apache-2.0 | — | 2026-05-18 | SQLite 벡터 검색 | **미래 RAG 전용**, Phase 1 미도입 |
| `anthropics/skills` (frontend-design) | Apache-2.0 | — | — | 디자인 원칙 레퍼런스 | 원칙만 참고, 코드 복사 없음 |
| `nextlevelbuilder/ui-ux-pro-max-skill` | MIT | — | — | UI/UX 품질 가이드 | 참고 자료 |
| `op7418/guizang-ppt-skill` | AGPL-3.0 | — | — | 에디토리얼/스위스 디자인 원칙 | **소스 재사용 금지**, 높은 수준의 원칙만 참고 |
| OpenCode skills 문서 | 문서 | — | — | 프로젝트 로컬 스킬 위치 안내 | `.opencode/skills/<id>/SKILL.md` 사용 |

`—`는 조사 요청에서 제공되지 않은 수치입니다. 날짜는 2026-11-24 기준 GitHub API 응답값입니다.

## 3. 설치/복사된 프로젝트 스킬

| 스킬 | 확인 상태 | 라이선스/메모 | 사용 방침 |
| --- | --- | --- | --- |
| `slides` | 읽기 확인 | 명시적 라이선스 헤더 없음 | 내부 참고, 외부 재배포/코드 복사 없음 |
| `design-system` | 읽기 확인 | MIT | 디자인 토큰/구조 참고 |
| `ui-ux-pro-max` | 읽기 확인 | MIT | UI 품질 체크 참고 |
| `ui-styling` | 읽기 확인 | Apache-2.0 | 스타일 원칙 참고 |

스킬 경로: `.opencode/skills/<id>/SKILL.md` (참고: https://opencode.ai/docs/skills/)

## 4. 채택 설계 원칙

1. **로컬 우선**: API 키가 없어도 결정적 로컬 생성으로 12페이지 초안을 만들 수 있어야 한다.
2. **선택적 원격**: 프롬프트 입력창 근처와 에디터 헤더에서 provider/model을 선택하고, Settings에서 키를 server-side SQLite에 저장한다. 키가 없으면 로컬로 폴백하고 **눈에 보이는 안내**를 표시한다.
3. **단일 텍스트 소스**: 텍스트 수정은 `slide.content`만 변경한다. 이동/크기 조절은 `elementId`keyed 레이아웃 오버라이드로 별도 저장하며 텍스트를 복제하지 않는다.
4. **빈 셀 보존**: 자료가 없는 페이지는 빈 셀로 남긴다. 내용을 지어내지 않는다.
5. **샘플 명시**: 개발용 공고는 항상 "샘플 공고"로 표시하며 실제 지원 공고로 소개하지 않는다. 실제 공고는 사용자가 이후 입력한다.
6. **기본 디자인**: 첫 샘플 포트폴리오는 **Modern Editorial** 프리셋을 기본값으로 한다.
7. **출력 순서**: PDF → (PDF 검증 후) 이미지 기반 PPTX → 편집형 PPTX.
8. **범위**: Phase 1은 Portfolio Builder Workspace. Archive Workspace는 문서/인터페이스 설계만 하고 RAG·vector DB·전체 Archive UI·Notion 연동·채용 플랫폼 API는 구현하지 않는다.
