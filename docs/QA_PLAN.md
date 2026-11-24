# SlideForge QA plan (Playwright E2E)

This plan covers the 10 requested scenarios (A–J). Tests create their own projects through the public API in `beforeEach`-style helpers, so they do not depend on `npm run seed` or on a real AI API key.

## Scenarios

| ID | Spec | What is asserted |
| --- | --- | --- |
| A | `tests/a-local-first.spec.ts` | Homepage advertises the keyless local engine; 12-page UI creation with a style selection lands on the outline with 12 rows; project has 12 slides and the chosen preset; `/api/settings` has `hasKey: false`. |
| B | `tests/b-job-posting.spec.ts` | A clearly sample-labelled source is stored with `type: "job-posting"`; original text is preserved byte-for-byte; outline "공고 요구사항 매핑" shows the title, original-length notice and extracted keyword chips; editor source panel labels it "공고". |
| C | `tests/c-outline-editing.spec.ts` | Rename + reorder an outline row, save, reload: order and title persist in `/api/projects/:id` and a `목차·디자인 변경 이전` version snapshot exists (the outline page always sends `designPreset`). |
| D | `tests/d-slide-edit.spec.ts` | Generate a slide locally, edit `[data-el="title"]`, blur, reload: text is persisted **only** in `slide.content.title`; all other content fields are unchanged and `visualOverrides` stays `{}`. |
| E | `tests/e-visual-overrides.spec.ts` | Node-panel numeric `x`/`y` inputs move a node: `visualOverrides.title` gains `{x, y}` while `slide.content` is identical. |
| F | `tests/f-design-change.spec.ts` | Design preset changes to `neo-brutalism` from the editor, a `디자인 변경 이전` snapshot is created, and version restore returns the project to `modern-editorial`. |
| G | `tests/g-safe-delete.spec.ts` | Delete dialog stays disabled until exact `삭제` **and** consent; cancel deletes nothing; page delete creates a snapshot and is reversible via version restore; project delete is a true soft delete (`deletedAt`) and `/api/projects/:id/restore` brings it back. |
| H | `tests/h-undo-redo.spec.ts` | Two contentEditable edits; `Ctrl+Z` then `Ctrl+Shift+Z` with focus on a button reverts then reapplies the text (verified in the API and on the canvas). |
| I | `tests/i-export.spec.ts` | 12-page project: `/api/projects/:id/export?format=pdf` returns `{export:{url,pages}}` with `pages === 12`, the URL streams `%PDF`; PPTX returns a `.pptx` URL that streams a ZIP (`PK`) payload. |
| J | `tests/j-security.spec.ts` | `/api/import-url` rejects localhost/loopback/link-local/`file:` URLs with 400; `/api/uploads` rejects disallowed, MIME-mismatched and >20 MB files; `/api/settings` returns `hasKey`/`maskedKey` but never the raw key. |

## Prerequisites

- Node.js 20+, dependencies installed (`npm install` in `slideforge`).
- Chrome/Chromium installed. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` (or `CHROME_PATH`) to the binary path when it is not on the default channel. The config maps that path to `CHROME_PATH` for the dev server too, because `src/lib/exporters.ts` uses `CHROME_PATH` for PDF/PPTX generation.
- Port `3070` free, or an existing dev server on that port (`reuseExistingServer: true`).
- **No AI key is required.** API fixtures use `forceProvider: "local"`; UI-generation scenarios PATCH `/api/settings` to provider `local` and restore the original provider afterwards.
- The seeded sample project is **not** used; scenario I creates its own 12-page fixture.

## How to run

From `slideforge`:

```bat
npx playwright test
npx playwright test tests/i-export.spec.ts
cmd /c "npm run typecheck"
```

The Playwright web server runs `cmd /c "npm run dev"` with a 120 s timeout. Override the target with `APP_URL` (the config also accepts `PLAYWRIGHT_WORKERS`, default 1 because several tests mutate the single global settings row and the shared SQLite database).

## Selector / contract notes (report only — no app code changed)

1. **Source-create payload inconsistency.** `POST /api/projects` accepts `sources[].kind` (`createProjectSchema`), but `POST /api/projects/:id/sources` requires `type` (`sourceCreateSchema`). The UI `SourceComposer` uses `kind`. Tests use the project-create path.
2. **Local-fallback notice is not shown after creation.** With provider `local`, `planProject()` returns no `notice`; the homepage static notice mentions local fallback but navigation to the outline discards it. Scenario A therefore asserts the notice *before* creating.
3. **Page delete is not a soft delete.** `DELETE /api/projects/:id/slides/:slideId` hard-deletes the row and only records a version snapshot; only project deletion sets `deletedAt`. Scenario G restores a deleted page via the project-version restore endpoint.
4. **Outline ids from the local planner are empty strings.** `buildLocalOutline()` emits `id: ""` for every outline item while `outlineSaveSchema` requires a string id. Saving from the UI works (slides are matched by index) but React sees duplicate keys. Tests do not rely on outline ids.
5. **Selectors without test ids** are located by role/label: node `x`/`y` inputs (`label` text), left tabs (`노드`, `버전`, `자료`), the design select (`aria-label="디자인 스타일"`), the "현재 페이지 삭제" button, and the "공고 요구사항 매핑" section (by heading text).
6. **Exporter Chrome lookup** uses `CHROME_PATH`, not `PLAYWRIGHT_CHROMIUM_EXECUTABLE`; the config bridges the two for the spawned dev server.

## Known flaky / untestable items

- **Remote AI providers are not exercised.** Without API keys, OpenAI/Anthropic/OpenRouter calls always fall back to local generation. Response parsing, usage/cost accounting and provider-specific quality are outside this suite.
- **Export fidelity** is not pixel-asserted; only file headers, content types and page counts are verified. Exports require a working Chrome binary reachable from the dev-server process and `APP_URL` pointing at that server.
- **Undo/redo (H)** depends on React state plus a 450 ms debounced autosave. The test polls the API after each action rather than sleeping; if the editor changes its debounce or action-stack semantics, this test is the first to revisit. It is intentionally not skipped.
- **Delete dialog gating** is verified functionally; no visual/interaction snapshot is taken of the modal.
- Tests assume a single-user, shared SQLite state and run with one worker by default; raising `PLAYWRIGHT_WORKERS` can cause settings/state races.
