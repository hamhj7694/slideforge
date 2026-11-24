"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Download,
  History,
  Layers3,
  Redo2,
  RefreshCw,
  Type,
  Undo2,
} from "lucide-react";
import { ModelPicker } from "@/components/ModelPicker";
import { SlideThumbnail } from "@/components/slides/SlideThumbnail";
import { presetOptions } from "@/lib/ai/design-bridge";
import { api, apiPatch, apiPost } from "@/lib/client";
import { LAYOUT_KINDS, LAYOUT_LABELS } from "@/lib/types";
import type {
  DesignPresetId,
  LayoutKind,
  ProjectWithSlides,
  Slide,
  StructuredContent,
} from "@/lib/types";

type SlidePatch = Partial<Pick<Slide, "content" | "layout" | "title" | "locked" | "rawInput">>;

interface EditAction {
  slideId: string;
  before: SlidePatch;
  after: SlidePatch;
  label: string;
}

interface VersionRow {
  id: string;
  label: string;
  kind: string;
  slideId?: string;
  createdAt: string;
}

interface TextField {
  path: string;
  label: string;
  value: string;
}

const PRESETS = presetOptions();

function setByPath<T>(base: T, path: string, value: string): T {
  const clone: unknown = structuredClone(base);
  const parts = path.split(".");
  let cursor = clone as Record<string | number, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = /^\d+$/.test(parts[i]) ? Number(parts[i]) : parts[i];
    if (cursor[key] === undefined || cursor[key] === null) {
      cursor[key] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    }
    cursor = cursor[key] as Record<string | number, unknown>;
  }
  cursor[parts[parts.length - 1]] = value;
  return clone as T;
}

function contentFields(content: StructuredContent): TextField[] {
  const fields: TextField[] = [];
  const add = (path: string, label: string, value: unknown) => {
    if (typeof value === "string") fields.push({ path, label, value });
  };
  add("title", "제목", content.title);
  add("subtitle", "소제목", content.subtitle);
  add("kicker", "키커", content.kicker);
  add("lede", "리드", content.lede);
  add("quote.text", "인용문", content.quote?.text);
  add("quote.attribution", "인용 출처", content.quote?.attribution);
  content.sections?.forEach((section, i) => {
    add(`sections.${i}.label`, `${i + 1}단락 라벨`, section.label);
    add(`sections.${i}.heading`, `${i + 1}단락 제목`, section.heading);
    add(`sections.${i}.body`, `${i + 1}단락 본문`, section.body);
  });
  content.bullets?.forEach((bullet, i) => add(`bullets.${i}`, `${i + 1}번 항목`, bullet));
  content.metrics?.forEach((metric, i) => {
    add(`metrics.${i}.value`, `${i + 1}번 수치`, metric.value);
    add(`metrics.${i}.label`, `${i + 1}번 수치 설명`, metric.label);
    add(`metrics.${i}.note`, `${i + 1}번 수치 메모`, metric.note);
  });
  content.timeline?.forEach((item, i) => {
    add(`timeline.${i}.label`, `${i + 1}시점`, item.label);
    add(`timeline.${i}.title`, `${i + 1}시점 제목`, item.title);
    add(`timeline.${i}.body`, `${i + 1}시점 설명`, item.body);
  });
  content.steps?.forEach((step, i) => {
    add(`steps.${i}.title`, `${i + 1}단계 제목`, step.title);
    add(`steps.${i}.body`, `${i + 1}단계 설명`, step.body);
  });
  add("before.title", "이전 제목", content.before?.title);
  content.before?.items?.forEach((item, i) => add(`before.items.${i}`, `이전 ${i + 1}`, item));
  add("after.title", "이후 제목", content.after?.title);
  content.after?.items?.forEach((item, i) => add(`after.items.${i}`, `이후 ${i + 1}`, item));
  content.images?.forEach((image, i) => {
    add(`images.${i}.caption`, `${i + 1}번 이미지 설명`, image.caption);
  });
  content.tags?.forEach((tag, i) => add(`tags.${i}`, `${i + 1}번 태그`, tag));
  add("table.note", "표 참고", content.table?.note);
  content.table?.columns?.forEach((column, i) => add(`table.columns.${i}`, `표 열 ${i + 1}`, column));
  content.table?.rows?.forEach((row, r) =>
    row.forEach((cell, c) => add(`table.rows.${r}.${c}`, `${r + 1}행 ${c + 1}열`, cell)),
  );
  add("chart.title", "차트 제목", content.chart?.title);
  add("chart.note", "차트 참고", content.chart?.note);
  content.chart?.series?.forEach((point, i) =>
    add(`chart.series.${i}.label`, `차트 항목 ${i + 1}`, point.label),
  );
  add("footnote", "각주", content.footnote);
  return fields;
}

function contentToProse(content: StructuredContent): string {
  return contentFields(content)
    .map((field) => field.value.trim())
    .filter(Boolean)
    .join("\n");
}

export function StudioWorkspace() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [project, setProject] = useState<ProjectWithSlides | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState<StructuredContent | null>(null);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [pageText, setPageText] = useState("");
  const [actions, setActions] = useState<EditAction[]>([]);
  const [redoActions, setRedoActions] = useState<EditAction[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [showStyles, setShowStyles] = useState(false);
  const [showOutline, setShowOutline] = useState(false);
  const [exportBusy, setExportBusy] = useState<"pdf" | "pptx" | null>(null);

  const sorted = useMemo(
    () => [...(project?.slides ?? [])].sort((a, b) => a.order - b.order),
    [project],
  );
  const selected = useMemo(
    () => sorted.find((slide) => slide.id === selectedId) ?? sorted[0] ?? null,
    [sorted, selectedId],
  );

  const loadVersions = useCallback(async () => {
    try {
      const data = await api<{ versions: VersionRow[] }>(`/api/projects/${projectId}/versions`);
      setVersions(data.versions);
    } catch {
      // versions are auxiliary
    }
  }, [projectId]);

  const load = useCallback(async () => {
    try {
      const data = await api<{ project: ProjectWithSlides | null }>(`/api/projects/${projectId}`);
      if (!data.project) {
        setNotice("프로젝트를 찾을 수 없습니다.");
        return;
      }
      setProject(data.project);
      setSelectedId((current) =>
        current && data.project!.slides.some((slide) => slide.id === current)
          ? current
          : (data.project!.slides[0]?.id ?? ""),
      );
      void loadVersions();
    } catch (error) {
      setNotice((error as Error).message);
    }
  }, [projectId, loadVersions]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setDraft(selected ? structuredClone(selected.content) : null);
    setPageText(selected ? selected.rawInput?.trim() || contentToProse(selected.content) : "");
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyLocal = useCallback((slideId: string, patch: SlidePatch) => {
    setProject((current) =>
      current
        ? {
            ...current,
            slides: current.slides.map((slide) =>
              slide.id === slideId ? { ...slide, ...patch } : slide,
            ),
          }
        : current,
    );
  }, []);

  const commit = useCallback(
    async (slideId: string, patch: SlidePatch, label: string, before: SlidePatch) => {
      setActions((current) => [...current, { slideId, before, after: patch, label }]);
      setRedoActions([]);
      applyLocal(slideId, patch);
      try {
        await apiPatch(`/api/projects/${projectId}/slides/${slideId}`, patch);
      } catch (error) {
        setNotice(`저장 실패: ${(error as Error).message}`);
      }
    },
    [projectId, applyLocal],
  );

  const undo = useCallback(async () => {
    const action = actions[actions.length - 1];
    if (!action) return;
    setActions((current) => current.slice(0, -1));
    setRedoActions((current) => [...current, action]);
    applyLocal(action.slideId, action.before);
    if (action.slideId === selectedId) {
      setDraft(structuredClone((action.before.content ?? selected?.content) as StructuredContent));
      if (action.before.rawInput !== undefined) setPageText(action.before.rawInput);
    }
    try {
      await apiPatch(`/api/projects/${projectId}/slides/${action.slideId}`, action.before);
    } catch {
      setNotice("이전 상태로 되돌리지 못했습니다.");
    }
  }, [actions, selectedId, selected, projectId, applyLocal]);

  const redo = useCallback(async () => {
    const action = redoActions[redoActions.length - 1];
    if (!action) return;
    setRedoActions((current) => current.slice(0, -1));
    setActions((current) => [...current, action]);
    applyLocal(action.slideId, action.after);
    if (action.slideId === selectedId) {
      setDraft(structuredClone((action.after.content ?? selected?.content) as StructuredContent));
      if (action.after.rawInput !== undefined) setPageText(action.after.rawInput);
    }
    try {
      await apiPatch(`/api/projects/${projectId}/slides/${action.slideId}`, action.after);
    } catch {
      setNotice("다시 적용하지 못했습니다.");
    }
  }, [redoActions, selectedId, selected, projectId, applyLocal]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "");
      if (typing || !(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        void undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        void redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  function editField(path: string, value: string) {
    if (!draft || !selected) return;
    const next = setByPath(draft, path, value) as StructuredContent;
    setDraft(next);
  }

  function saveField(path: string, value: string) {
    if (!draft || !selected) return;
    const next = setByPath(draft, path, value) as StructuredContent;
    setDraft(next);
    if (JSON.stringify(next) === JSON.stringify(selected.content)) return;
    const before = { content: selected.content };
    void commit(selected.id, { content: next }, path, before);
  }

  async function applyPageText() {
    if (!selected || pageText.trim().length < 2) {
      setNotice("이 페이지에 넣을 내용을 줄글로 조금 더 적어 주세요.");
      return;
    }
    const text = pageText.trim();
    const before: SlidePatch = {
      rawInput: selected.rawInput,
      content: selected.content,
      layout: selected.layout,
    };
    setBusy(true);
    setNotice(`${selected.title} 페이지를 적은 내용으로 다시 만들고 있습니다.`);
    try {
      await apiPatch(`/api/projects/${projectId}/slides/${selected.id}`, { rawInput: text });
      const data = await apiPost<{ slide: Slide; generation?: { notice?: string } }>(
        `/api/projects/${projectId}/slides/${selected.id}/generate`,
        { mode: "generate" },
      );
      const updated: Slide = { ...data.slide, rawInput: text };
      const after: SlidePatch = {
        rawInput: text,
        content: updated.content,
        layout: updated.layout,
      };
      setActions((current) => [
        ...current,
        { slideId: selected.id, before, after, label: "줄글 내용 반영" },
      ]);
      setRedoActions([]);
      setProject((current) =>
        current
          ? {
              ...current,
              slides: current.slides.map((slide) =>
                slide.id === updated.id ? updated : slide,
              ),
            }
          : current,
      );
      setDraft(structuredClone(updated.content));
      setNotice(data.generation?.notice ?? "적은 내용으로 이 페이지를 만들었습니다.");
      void loadVersions();
    } catch (error) {
      setNotice(`수정 실패: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function changePreset(preset: DesignPresetId) {
    setBusy(true);
    try {
      const data = await apiPost<{ project: ProjectWithSlides; notice?: string }>(
        `/api/projects/${projectId}/design`,
        { preset },
      );
      setProject(data.project);
      setNotice(data.notice ?? "디자인을 바꿨습니다. 이전 상태는 버전에 남습니다.");
      setShowStyles(false);
      void loadVersions();
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function regenerateAll() {
    setBusy(true);
    setNotice("모든 페이지를 다시 만들고 있습니다.");
    try {
      const data = await apiPost<{ project: ProjectWithSlides; notice?: string }>(
        `/api/projects/${projectId}/regenerate`,
        { mode: "content", respectLocked: true },
      );
      setProject(data.project);
      setNotice(data.notice ?? "모든 페이지를 다시 만들었습니다.");
      void loadVersions();
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function restore(versionId: string, slideId?: string) {
    setBusy(true);
    try {
      const suffix = slideId ? `?slideId=${slideId}` : "";
      const data = await apiPost<{ project: ProjectWithSlides }>(
        `/api/projects/${projectId}/versions/${versionId}/restore${suffix}`,
        {},
      );
      setProject(data.project);
      setNotice("선택한 버전을 복원했습니다.");
      void loadVersions();
    } catch (error) {
      setNotice(`복원 실패: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function download(format: "pdf" | "pptx") {
    setExportBusy(format);
    try {
      const response = await fetch(
        `/api/projects/${projectId}/export?format=${format}&download=1`,
      );
      if (!response.ok) throw new Error("내보내기 실패");
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") ?? "";
      const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? `slideforge.${format}`;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice(`${filename} 파일을 내려받습니다.`);
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setExportBusy(null);
    }
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-24 text-center text-[13px] text-muted">
        {notice || "결과를 불러오는 중…"}
      </div>
    );
  }

  const design = project.designSystem;
  const visibleVersions = versions.filter(
    (version) => !version.slideId || version.slideId === selected?.id,
  );
  const fields = draft ? contentFields(draft) : [];

  return (
    <div className="mx-auto max-w-[1400px] px-5 pb-24 pt-6">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/projects" className="mb-2 inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink">
            <ArrowLeft size={13} /> 프로젝트 목록
          </Link>
          <h1 className="sf-section-title">{project.title}</h1>
          <p className="sf-muted mt-1">
            {sorted.length}페이지 · {design.name} · 필요한 페이지를 눌러 고치세요.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ModelPicker compact onNotice={setNotice} />
          <div className="relative">
            <button className="sf-btn sf-btn-sm" onClick={() => setShowStyles(!showStyles)}>
              <Layers3 size={13} /> 디자인 <ChevronDown size={12} />
            </button>
            {showStyles && (
              <div className="sf-card absolute right-0 top-10 z-30 w-[320px] p-3">
                <div className="sf-scroll max-h-[360px] space-y-1 overflow-y-auto">
                  {PRESETS.map((option) => (
                    <button
                      key={option.id}
                      className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[12px] hover:bg-black/[0.04] ${
                        design.preset === option.id ? "font-semibold text-ink" : "text-muted"
                      }`}
                      onClick={() => void changePreset(option.id)}
                      disabled={busy}
                    >
                      <span>{option.name}</span>
                      {design.preset === option.id && <Check size={13} />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <button className="sf-btn sf-btn-sm" onClick={() => setShowOutline(!showOutline)}>
            구성 보기
          </button>
          <button className="sf-btn sf-btn-sm" onClick={() => void download("pdf")} disabled={exportBusy !== null}>
            <Download size={13} /> {exportBusy === "pdf" ? "만드는 중…" : "PDF"}
          </button>
          <button className="sf-btn sf-btn-sm" onClick={() => void download("pptx")} disabled={exportBusy !== null}>
            <Download size={13} /> {exportBusy === "pptx" ? "만드는 중…" : "PPTX"}
          </button>
          <Link className="sf-btn sf-btn-sm" href={`/projects/${projectId}/editor`}>
            캔버스 편집
          </Link>
        </div>
      </header>

      {notice && (
        <p className="mb-4 rounded-md border border-line bg-white px-3 py-2 text-[12px] text-muted">
          {notice}
        </p>
      )}

      {showOutline && (
        <section className="sf-card mb-5 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold">전체 구성</h2>
            <Link href={`/projects/${projectId}/outline`} className="text-[12px] text-accent">
              구성 전체 편집 →
            </Link>
          </div>
          <ol className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {project.brief.outline.map((item, index) => (
              <li key={item.id} className="flex gap-2 rounded border border-line bg-white px-2.5 py-2 text-[12px]">
                <span className="font-mono text-muted">{String(index + 1).padStart(2, "0")}</span>
                <span className="truncate text-ink">{item.title}</span>
              </li>
            ))}
          </ol>
          <p className="sf-muted mt-3">{project.brief.storyline}</p>
        </section>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sorted.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            data-testid={`page-item-${index + 1}`}
            onClick={() => setSelectedId(slide.id)}
            className={`overflow-hidden rounded-lg border bg-paper text-left transition-colors ${
              slide.id === selected?.id
                ? "border-accent ring-2 ring-accent/20"
                : "border-line hover:border-ink/30"
            }`}
          >
            <SlideThumbnail slide={slide} design={design} index={index} total={sorted.length} />
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="font-mono text-[11px] text-muted">{String(index + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">
                {slide.title}
              </span>
              <span className="text-[10px] text-muted">{LAYOUT_LABELS[slide.layout.kind as LayoutKind] ?? slide.layout.kind}</span>
            </div>
          </button>
        ))}
      </div>

      {selected && draft && (
        <section className="sf-card mt-6 overflow-hidden" data-testid="node-list">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-muted">
                {String(selected.order + 1).padStart(2, "0")} / {sorted.length} 페이지 수정
              </p>
              <h2 className="font-display text-lg tracking-tight">{selected.title}</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className="sf-btn sf-btn-sm" onClick={() => void undo()} disabled={actions.length === 0}>
                <Undo2 size={13} /> 되돌리기
              </button>
              <button className="sf-btn sf-btn-sm" onClick={() => void redo()} disabled={redoActions.length === 0}>
                <Redo2 size={13} /> 다시 적용
              </button>
              <Link className="sf-btn sf-btn-sm" href={`/projects/${projectId}/editor`}>
                캔버스에서 배치
              </Link>
            </div>
          </div>

          <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)]">
            <div>
              <SlideThumbnail slide={{ ...selected, content: draft }} design={design} index={selected.order} total={sorted.length} />
              <p className="sf-muted mt-2">
                적은 내용을 바탕으로 이 페이지만 다시 만듭니다. Ctrl+Z / Ctrl+Shift+Z로 되돌릴 수 있습니다.
              </p>
            </div>

            <div className="space-y-5">
              <div className="rounded-lg border border-line bg-white p-3">
                <label className="sf-label" htmlFor="page-prose">이 페이지 내용 · 요청</label>
                <textarea
                  id="page-prose"
                  data-testid="page-prose"
                  className="sf-input min-h-[180px] resize-y text-[13px] leading-relaxed"
                  placeholder="이 페이지에 들어갈 내용을 줄글로 적으세요. 문단, 문장, 요청을 섞어 써도 됩니다. 예: 마케팅 실무 경험을 문제 인식→실행→배움 순서로 쓰고, 근거 없는 수치는 넣지 마세요."
                  value={pageText}
                  onChange={(event) => setPageText(event.target.value)}
                />
                <p className="sf-muted mt-2">
                  줄글을 적고 만들기를 누르면 제목·문단·레이아웃을 다시 정리합니다. 아래 필드 수정은 값이 딱 맞아떨어질 때만 쓰세요.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="sf-btn sf-btn-accent sf-btn-sm" onClick={() => void applyPageText()} disabled={busy}>
                    <RefreshCw size={13} /> 이 내용으로 만들기
                  </button>
                  <button className="sf-btn sf-btn-sm" onClick={() => void regenerateAll()} disabled={busy}>
                    전체 다시 만들기
                  </button>
                </div>
              </div>

              <details className="rounded-lg border border-line bg-white p-3">
                <summary className="cursor-pointer text-[12px] font-semibold">
                  <Type size={13} className="mr-1 inline" /> 필드별로 직접 수정
                </summary>
                <div className="sf-scroll mt-3 max-h-[320px] space-y-2 overflow-y-auto pr-1">
                  {fields.map((field) => (
                    <div key={field.path}>
                      <label className="mb-1 block text-[11px] text-muted">{field.label}</label>
                      <textarea
                        className="sf-input min-h-[38px] resize-y py-2 text-[12px]"
                        value={field.value}
                        onChange={(event) => editField(field.path, event.target.value)}
                        onBlur={(event) => saveField(field.path, event.target.value)}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-3 border-t border-line pt-3">
                  <label className="sf-label" htmlFor="layout-kind">레이아웃</label>
                  <select
                    id="layout-kind"
                    className="sf-input"
                    value={selected.layout.kind}
                    onChange={(event) => {
                      const before = { layout: selected.layout };
                      void commit(
                        selected.id,
                        { layout: { ...selected.layout, kind: event.target.value as LayoutKind } },
                        "레이아웃 변경",
                        before,
                      );
                    }}
                  >
                    {LAYOUT_KINDS.map((kind) => (
                      <option key={kind} value={kind}>{LAYOUT_LABELS[kind]}</option>
                    ))}
                  </select>
                </div>
              </details>

              <div>
                <h3 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold">
                  <History size={13} /> 이전 상태
                </h3>
                {visibleVersions.length === 0 ? (
                  <p className="sf-muted">아직 저장된 이전 상태가 없습니다.</p>
                ) : (
                  <ul className="sf-scroll max-h-[180px] space-y-1.5 overflow-y-auto">
                    {visibleVersions.map((version) => (
                      <li key={version.id} className="flex items-center gap-2 rounded border border-line bg-white px-2.5 py-2 text-[11px]">
                        <span className="min-w-0 flex-1 truncate text-muted">{version.label}</span>
                        <button
                          className="sf-btn sf-btn-sm px-2"
                          onClick={() => void restore(version.id, version.slideId)}
                          disabled={busy}
                        >
                          복원
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
