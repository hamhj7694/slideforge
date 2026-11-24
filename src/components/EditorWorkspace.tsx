"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  FileText,
  Grip,
  History,
  Image as ImageIcon,
  Layers,
  Lock,
  Redo2,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  Trash2,
  Undo2,
  Unlock,
  X,
} from "lucide-react";
import { DeleteDialog } from "@/components/DeleteDialog";
import { ModelPicker } from "@/components/ModelPicker";
import { elementLabel, SlideRenderer } from "@/components/slides/SlideRenderer";
import { presetOptions } from "@/lib/ai/design-bridge";
import { api, apiPatch, apiPost } from "@/lib/client";
import { DESIGN_PRESETS, isDesignPreset } from "@/lib/design";
import type {
  DesignPresetId,
  LayoutKind,
  ProjectWithSlides,
  Slide,
  SlideStatus,
  StructuredContent,
} from "@/lib/types";
import { LAYOUT_KINDS, LAYOUT_LABELS } from "@/lib/types";
import { newId, relativeDate } from "@/lib/utils";

const PRESETS = presetOptions();

type SlidePatch = Partial<
  Pick<
    Slide,
    "content" | "layout" | "rawInput" | "title" | "visualOverrides" | "status" | "locked"
  >
>;

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

type LeftTab = "pages" | "nodes" | "versions" | "sources";
type RightTab = "input" | "design" | "export";

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

function patchSlide(project: ProjectWithSlides, slideId: string, patch: SlidePatch): ProjectWithSlides {
  return {
    ...project,
    slides: project.slides.map((slide) => (slide.id === slideId ? { ...slide, ...patch } : slide)),
  };
}

export function EditorWorkspace(): JSX.Element {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const [project, setProject] = useState<ProjectWithSlides | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [nodeIds, setNodeIds] = useState<string[]>([]);
  const [leftTab, setLeftTab] = useState<LeftTab>("pages");
  const [rightTab, setRightTab] = useState<RightTab>("input");
  const [notice, setNotice] = useState("");
  const [noticeTone, setNoticeTone] = useState<"info" | "error">("info");
  const [busy, setBusy] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.62);
  const [actions, setActions] = useState<EditAction[]>([]);
  const [redoActions, setRedoActions] = useState<EditAction[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<"slide" | "project" | null>(null);
  const [instruction, setInstruction] = useState("");
  const [reviseInstruction, setReviseInstruction] = useState("");
  const [bulkMode, setBulkMode] = useState<"design" | "content" | "both">("content");
  const [respectLocked, setRespectLocked] = useState(true);
  const [styleInstruction, setStyleInstruction] = useState("");
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [exportUrl, setExportUrl] = useState("");
  const [showDragHint, setShowDragHint] = useState(true);

  const canvasRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
    base: Record<string, number | boolean>;
    before: SlidePatch;
  } | null>(null);

  const sortedSlides = useMemo(
    () => [...(project?.slides ?? [])].sort((a, b) => a.order - b.order),
    [project],
  );
  const slide = useMemo(
    () => sortedSlides.find((item) => item.id === selectedId) ?? sortedSlides[0] ?? null,
    [sortedSlides, selectedId],
  );
  const design = project?.designSystem;

  const flash = useCallback((message: string, tone: "info" | "error" = "info") => {
    setNotice(message);
    setNoticeTone(tone);
  }, []);

  const loadVersions = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await api<{ versions: VersionRow[] }>(`/api/projects/${projectId}/versions`);
      setVersions(data.versions);
    } catch {
      // version list is auxiliary; ignore load failures
    }
  }, [projectId]);

  const loadProject = useCallback(async () => {
    try {
      const data = await api<{ project: ProjectWithSlides | null }>(`/api/projects/${projectId}`);
      if (!data.project) {
        flash("프로젝트를 찾을 수 없습니다.", "error");
        return;
      }
      setProject(data.project);
      setSelectedId((current) =>
        current && data.project!.slides.some((item) => item.id === current)
          ? current
          : (data.project!.slides[0]?.id ?? ""),
      );
      setActions([]);
      setRedoActions([]);
      void loadVersions();
    } catch (error) {
      flash((error as Error).message, "error");
    }
  }, [flash, loadVersions, projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  useEffect(() => {
    const wrapper = canvasRef.current;
    if (!wrapper) return;
    const ids = Array.from(wrapper.querySelectorAll("[data-el]"))
      .map((element) => element.getAttribute("data-el") ?? "")
      .filter(Boolean);
    setNodeIds(Array.from(new Set(ids)));
  }, [slide?.id, slide?.layout.kind, slide?.content, project?.designSystem.preset]);

  const persist = useCallback(
    (slideId: string, patch: SlidePatch) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        try {
          await apiPatch(`/api/projects/${projectId}/slides/${slideId}`, patch);
          setSavedAt(new Date().toISOString());
        } catch (error) {
          flash(`자동 저장 실패: ${(error as Error).message}`, "error");
        }
      }, 450);
    },
    [flash, projectId],
  );

  const commitSlide = useCallback(
    (slideId: string, before: SlidePatch, after: SlidePatch, label: string, save = true) => {
      setProject((current) => (current ? patchSlide(current, slideId, after) : current));
      setActions((current) => [...current.slice(-59), { slideId, before, after, label }]);
      setRedoActions([]);
      if (save) persist(slideId, after);
    },
    [persist],
  );

  function applyAction(action: EditAction, direction: "undo" | "redo") {
    const patch = direction === "undo" ? action.before : action.after;
    setProject((current) => (current ? patchSlide(current, action.slideId, patch) : current));
    persist(action.slideId, patch);
  }

  function undo() {
    const action = actions[actions.length - 1];
    if (!action) return;
    setActions((current) => current.slice(0, -1));
    setRedoActions((current) => [...current, action]);
    applyAction(action, "undo");
    flash(`실행 취소: ${action.label}`);
  }

  function redo() {
    const action = redoActions[redoActions.length - 1];
    if (!action) return;
    setRedoActions((current) => current.slice(0, -1));
    setActions((current) => [...current, action]);
    applyAction(action, "redo");
    flash(`다시 실행: ${action.label}`);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable ||
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT";
      if (typing) return;
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function onTextChange(elementId: string, fieldPath: string, value: string) {
    if (!slide || slide.locked) return;
    const before: SlidePatch = { content: slide.content };
    const content = setByPath<StructuredContent>(slide.content, fieldPath, value);
    commitSlide(slide.id, before, { content }, `${elementLabel(elementId)} 수정`);
  }

  function onImageChange(elementId: string, url: string) {
    if (!slide || slide.locked) return;
    const match = elementId.match(/^image-(\d+)$/);
    if (!match) return;
    const index = Number(match[1]);
    const images = [...(slide.content.images ?? [])];
    while (images.length <= index) images.push({ url: "" });
    images[index] = { ...images[index], url };
    commitSlide(
      slide.id,
      { content: slide.content },
      { content: { ...slide.content, images } },
      `${elementLabel(elementId)} 변경`,
    );
  }

  function onOverrideChange(key: "x" | "y" | "width" | "height" | "z", value: number) {
    if (!slide || !selectedElement || slide.locked) return;
    const before = { visualOverrides: slide.visualOverrides };
    const current = slide.visualOverrides[selectedElement] ?? {};
    commitSlide(
      slide.id,
      before,
      {
        visualOverrides: {
          ...slide.visualOverrides,
          [selectedElement]: { ...current, [key]: value },
        },
      },
      `${elementLabel(selectedElement)} 위치 조정`,
    );
  }

  function toggleHidden() {
    if (!slide || !selectedElement || slide.locked) return;
    const before = { visualOverrides: slide.visualOverrides };
    const current = slide.visualOverrides[selectedElement] ?? {};
    commitSlide(
      slide.id,
      before,
      {
        visualOverrides: {
          ...slide.visualOverrides,
          [selectedElement]: { ...current, hidden: !current.hidden },
        },
      },
      `${elementLabel(selectedElement)} 표시 전환`,
    );
  }

  function onCanvasPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!slide || slide.locked || !event.altKey) return;
    const target = (event.target as HTMLElement).closest("[data-el]") as HTMLElement | null;
    const id = target?.dataset.el;
    if (!id) return;
    event.preventDefault();
    const base = (slide.visualOverrides[id] ?? {}) as Record<string, number | boolean>;
    dragRef.current = {
      id,
      startX: event.clientX,
      startY: event.clientY,
      base,
      before: { visualOverrides: slide.visualOverrides },
    };
    setSelectedElement(id);
    event.currentTarget.setPointerCapture(event.pointerId);
    setShowDragHint(false);
  }

  function onCanvasPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || !slide) return;
    const dx = Math.round((event.clientX - drag.startX) / zoom);
    const dy = Math.round((event.clientY - drag.startY) / zoom);
    const next = {
      ...slide.visualOverrides,
      [drag.id]: {
        ...drag.base,
        x: Number(drag.base.x ?? 0) + dx,
        y: Number(drag.base.y ?? 0) + dy,
      },
    };
    setProject((current) => (current ? patchSlide(current, slide.id, { visualOverrides: next }) : current));
  }

  function onCanvasPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || !slide) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    commitSlide(
      slide.id,
      drag.before,
      { visualOverrides: slide.visualOverrides },
      `${elementLabel(drag.id)} 이동`,
    );
  }

  async function generate(mode: "generate" | "design-only") {
    if (!slide) return;
    setBusy(true);
    try {
      const data = await apiPost<{
        slide: Slide;
        generation: { notice?: string; provider: string; model: string };
      }>(`/api/projects/${projectId}/slides/${slide.id}/generate`, {
        instruction: instruction || undefined,
        mode,
      });
      setProject((current) =>
        current ? patchSlide(current, slide.id, data.slide as SlidePatch) : current,
      );
      flash(
        data.generation.notice ??
          `${data.generation.provider} / ${data.generation.model}로 슬라이드를 생성했습니다.`,
      );
      setActions([]);
      setRedoActions([]);
    } catch (error) {
      flash((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function revise() {
    if (!slide || reviseInstruction.trim().length < 2) {
      flash("수정 요청을 2자 이상 입력해 주세요.", "error");
      return;
    }
    setBusy(true);
    try {
      const data = await apiPost<{ slide: Slide; generation: { notice?: string } }>(
        `/api/projects/${projectId}/slides/${slide.id}/revise`,
        { instruction: reviseInstruction, scope: "slide" },
      );
      setProject((current) =>
        current ? patchSlide(current, slide.id, data.slide as SlidePatch) : current,
      );
      flash(data.generation.notice ?? "요청한 방향으로 수정했습니다.");
      setReviseInstruction("");
      setActions([]);
      setRedoActions([]);
    } catch (error) {
      flash((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function bulkRegenerate() {
    setBusy(true);
    try {
      const data = await apiPost<{ project: ProjectWithSlides; changed: number; notice?: string }>(
        `/api/projects/${projectId}/regenerate`,
        { mode: bulkMode, instruction: instruction || undefined, respectLocked },
      );
      setProject(data.project);
      setSelectedId(data.project.slides[0]?.id ?? "");
      flash(data.notice ?? `${data.changed}개 페이지를 재생성했습니다.`);
      setActions([]);
      setRedoActions([]);
      void loadVersions();
    } catch (error) {
      flash((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function applyDesign() {
    if (!project) return;
    setBusy(true);
    try {
      const data = await apiPost<{ project: ProjectWithSlides; notice?: string }>(
        `/api/projects/${projectId}/design`,
        { preset: project.designSystem.preset, instruction: styleInstruction || undefined },
      );
      setProject(data.project);
      flash(data.notice ?? "디자인을 적용했습니다.");
      setStyleInstruction("");
      void loadVersions();
    } catch (error) {
      flash((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function addVersion() {
    try {
      await apiPost(`/api/projects/${projectId}/versions`, { label: "수동 스냅샷" });
      void loadVersions();
      flash("현재 상태를 새 버전으로 저장했습니다.");
    } catch (error) {
      flash((error as Error).message, "error");
    }
  }

  async function restoreVersion(versionId: string, versionSlideId?: string) {
    setBusy(true);
    try {
      const query = versionSlideId ? `?slideId=${versionSlideId}` : "";
      const data = await apiPost<{ project: ProjectWithSlides }>(
        `/api/projects/${projectId}/versions/${versionId}/restore${query}`,
        {},
      );
      setProject(data.project);
      setActions([]);
      setRedoActions([]);
      flash("선택한 버전으로 복원했습니다. 복원 이전 상태도 버전에 남습니다.");
      void loadVersions();
    } catch (error) {
      flash((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      if (deleteTarget === "slide" && slide) {
        const data = await api<{ project: ProjectWithSlides }>(
          `/api/projects/${projectId}/slides/${slide.id}`,
          { method: "DELETE" },
        );
        setProject(data.project);
        setSelectedId(data.project.slides[0]?.id ?? "");
        flash("페이지를 삭제했습니다. 이전 상태는 버전에서 복원할 수 있습니다.");
      } else if (deleteTarget === "project") {
        await api(`/api/projects/${projectId}`, { method: "DELETE" });
        window.location.href = "/projects";
        return;
      }
      setDeleteTarget(null);
      void loadVersions();
    } catch (error) {
      flash((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggleLock() {
    if (!slide) return;
    const patch = { locked: !slide.locked };
    setProject((current) => (current ? patchSlide(current, slide.id, patch) : current));
    try {
      await apiPatch(`/api/projects/${projectId}/slides/${slide.id}`, patch);
      flash(patch.locked ? "페이지를 잠갔습니다." : "페이지 잠금을 해제했습니다.");
    } catch (error) {
      flash((error as Error).message, "error");
    }
  }

  async function doExport(format: "pdf" | "pptx") {
    setExportBusy(true);
    try {
      const data = await api<{ export: { url: string; filename: string; pages: number } }>(
        `/api/projects/${projectId}/export?format=${format}`,
      );
      setExportUrl(data.export.url);
      flash(
        `${format.toUpperCase()} ${data.export.pages}페이지를 생성했습니다: ${data.export.filename}`,
      );
    } catch (error) {
      flash(`내보내기 실패: ${(error as Error).message}`, "error");
    } finally {
      setExportBusy(false);
    }
  }

  if (!project || !design || !slide) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-24 text-center text-[13px] text-muted">
        {notice || "편집기를 불러오는 중…"}
      </div>
    );
  }

  const selectedOverride = selectedElement ? slide.visualOverrides[selectedElement] ?? {} : {};
  const preset = isDesignPreset(design.preset) ? design.preset : "modern-editorial";

  return (
    <div className="flex h-[calc(100vh-56px)] min-h-[640px] flex-col overflow-hidden">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-paper px-4">
        <Link href={`/projects/${projectId}/outline`} className="sf-btn sf-btn-ghost sf-btn-sm px-2">
          <ArrowLeft size={14} />
        </Link>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-ink">{project.title}</p>
          <p className="truncate text-[10px] text-muted">
            {sortedSlides.length}페이지 · {savedAt ? `자동 저장 ${relativeDate(savedAt)}` : "저장 대기"}
          </p>
        </div>
        <div className="ml-3 hidden items-center gap-1 md:flex">
          <select
            aria-label="디자인 스타일"
            className="h-8 max-w-[190px] rounded-md border border-line bg-white px-2 text-[12px] outline-none"
            value={preset}
            onChange={(event) => {
              const next = event.target.value as DesignPresetId;
              setProject({ ...project, designSystem: { ...design, preset: next } });
              void apiPost<{ project: ProjectWithSlides }>(`/api/projects/${projectId}/design`, {
                preset: next,
              })
                .then((data) => {
                  setProject(data.project);
                  flash(`${DESIGN_PRESETS[next]?.name ?? next} 스타일을 적용했습니다.`);
                  void loadVersions();
                })
                .catch((error: Error) => flash(error.message, "error"));
            }}
          >
            {PRESETS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
          <span className="sf-chip">디자인 변경 시 이전 상태 저장</span>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <ModelPicker compact onNotice={flash} />
          <button className="sf-btn sf-btn-sm" onClick={undo} disabled={!actions.length} title="Ctrl+Z">
            <Undo2 size={13} /> 실행 취소
          </button>
          <button className="sf-btn sf-btn-sm" onClick={redo} disabled={!redoActions.length} title="Ctrl+Shift+Z">
            <Redo2 size={13} />
          </button>
          <button
            data-testid="export-pdf"
            className="sf-btn sf-btn-sm sf-btn-primary"
            onClick={() => doExport("pdf")}
            disabled={exportBusy}
          >
            <Download size={13} /> PDF
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`shrink-0 border-b px-4 py-1.5 text-[11px] ${
            noticeTone === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-line bg-white text-muted"
          }`}
        >
          {notice}
        </div>
      )}

      <div className="flex min-h-0 flex-1">
        {/* LEFT */}
        <aside className="flex w-[248px] shrink-0 flex-col border-r border-line bg-paper">
          <div className="flex border-b border-line">
            {(
              [
                ["pages", Layers, "페이지"],
                ["nodes", Grip, "노드"],
                ["versions", History, "버전"],
                ["sources", FileText, "자료"],
              ] as const
            ).map(([tab, Icon, label]) => (
              <button
                key={tab}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] ${
                  leftTab === tab ? "border-b-2 border-accent text-ink" : "text-muted hover:text-ink"
                }`}
                onClick={() => setLeftTab(tab)}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>
          <div className="sf-scroll min-h-0 flex-1 overflow-auto p-2">
            {leftTab === "pages" && (
              <ol className="space-y-1" data-testid="page-list">
                {sortedSlides.map((item, index) => (
                  <li key={item.id}>
                    <button
                      data-testid={`page-item-${index}`}
                      onClick={() => {
                        setSelectedId(item.id);
                        setSelectedElement(null);
                      }}
                      className={`flex w-full items-start gap-2 rounded-md border px-2 py-2 text-left transition-colors ${
                        item.id === slide.id
                          ? "border-ink bg-white shadow-sm"
                          : "border-transparent hover:border-line hover:bg-white/60"
                      }`}
                    >
                      <span className="mt-0.5 font-mono text-[10px] text-accent">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-medium text-ink">
                          {item.title || "제목 없음"}
                        </span>
                        <span className="block truncate text-[10px] text-muted">
                          {LAYOUT_LABELS[item.layout.kind]}
                        </span>
                      </span>
                      {item.locked && <Lock size={11} className="mt-1 text-muted" />}
                      <span
                        className={`mt-1 h-1.5 w-1.5 rounded-full ${
                          item.status === "ready"
                            ? "bg-emerald-500"
                            : item.status === "generated"
                              ? "bg-amber-400"
                              : "bg-muted/40"
                        }`}
                      />
                    </button>
                  </li>
                ))}
              </ol>
            )}

            {leftTab === "nodes" && (
              <div>
                <p className="sf-label px-1">현재 페이지 요소</p>
                <ul className="space-y-0.5" data-testid="node-list">
                  {nodeIds.map((id) => (
                    <li key={id}>
                      <button
                        className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[11px] ${
                          selectedElement === id ? "bg-ink text-paper" : "hover:bg-white"
                        }`}
                        onClick={() => setSelectedElement(id)}
                      >
                        <span className="font-mono text-[9px] opacity-60">{id}</span>
                        <span className="ml-auto truncate">{elementLabel(id)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {selectedElement && (
                  <div className="mt-3 rounded-md border border-line bg-white p-2">
                    <p className="mb-2 text-[11px] font-semibold">
                      {elementLabel(selectedElement)} 배치
                    </p>
                    <p className="sf-muted mb-2">
                      캔버스에서 <span className="sf-kbd">Alt</span> + 드래그로 옮기거나 아래 값을
                      입력하세요. 레이아웃 값만 visualOverrides에 저장됩니다.
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(["x", "y", "width", "height", "z"] as const).map((key) => (
                        <label key={key} className="text-[10px] text-muted">
                          {key}
                          <input
                            type="number"
                            className="sf-input mt-0.5 h-7 px-1.5 py-0 text-[11px]"
                            value={Number(selectedOverride[key] ?? 0)}
                            disabled={slide.locked}
                            onChange={(event) => onOverrideChange(key, Number(event.target.value))}
                          />
                        </label>
                      ))}
                    </div>
                    <button
                      className="sf-btn sf-btn-sm mt-2 w-full"
                      disabled={slide.locked}
                      onClick={toggleHidden}
                    >
                      {selectedOverride.hidden ? "요소 표시" : "요소 숨기기"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {leftTab === "versions" && (
              <div>
                <button data-testid="add-version" className="sf-btn sf-btn-sm mb-2 w-full" onClick={addVersion}>
                  <Save size={12} /> 현재 상태를 새 버전으로 저장
                </button>
                <ul className="space-y-1" data-testid="version-list">
                  {versions.map((version) => (
                    <li key={version.id} className="rounded-md border border-line bg-white p-2">
                      <p className="truncate text-[11px] font-semibold">{version.label}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-muted">
                        <span>{relativeDate(version.createdAt)}</span>
                        {version.slideId && <span className="sf-chip px-1 py-0">페이지</span>}
                      </p>
                      <button
                        className="sf-btn sf-btn-sm mt-1.5 w-full"
                        onClick={() => restoreVersion(version.id, version.slideId)}
                        disabled={busy}
                      >
                        <RotateCcw size={11} /> 이 버전으로 복원
                      </button>
                    </li>
                  ))}
                  {!versions.length && <li className="sf-muted p-2">아직 저장된 버전이 없습니다.</li>}
                </ul>
              </div>
            )}

            {leftTab === "sources" && (
              <div className="space-y-2" data-testid="source-list">
                {project.sources.map((source) => (
                  <div key={source.id} className="rounded-md border border-line bg-white p-2">
                    <div className="flex items-start gap-1.5">
                      <span className="mt-0.5 text-[10px] text-accent">
                        {source.type === "job-posting" ? "공고" : "자료"}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-[11px] font-semibold" title={source.title}>
                        {source.title}
                      </p>
                    </div>
                    <p className="sf-muted mt-1">
                      원문 {source.originalContent.length.toLocaleString()}자 · 요약{" "}
                      {source.extractedContent.length.toLocaleString()}자
                    </p>
                    <button
                      className="sf-btn sf-btn-sm mt-1.5 w-full"
                      onClick={() =>
                        setExpandedSource(expandedSource === source.id ? null : source.id)
                      }
                    >
                      {expandedSource === source.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      원문 보기
                    </button>
                    {expandedSource === source.id && (
                      <pre className="sf-scroll mt-1.5 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-black/[0.03] p-2 text-[10px] leading-relaxed text-muted">
                        {source.originalContent.slice(0, 6000)}
                      </pre>
                    )}
                  </div>
                ))}
                {!project.sources.length && (
                  <p className="sf-muted p-2">등록된 자료가 없습니다.</p>
                )}
              </div>
            )}
          </div>
          <div className="border-t border-line p-2">
            <button className="sf-btn sf-btn-sm w-full" onClick={() => setDeleteTarget("slide")}>
              <Trash2 size={12} /> 현재 페이지 삭제
            </button>
          </div>
        </aside>

        {/* CENTER */}
        <section className="sf-scroll flex min-w-0 flex-1 flex-col items-center overflow-auto bg-[#eae8e1] p-6">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[11px] font-semibold text-muted">
              {String(slide.order + 1).padStart(2, "0")} / {String(sortedSlides.length).padStart(2, "0")}
            </span>
            <select
              aria-label="레이아웃"
              className="h-7 rounded border border-line bg-white px-2 text-[11px]"
              value={slide.layout.kind}
              disabled={slide.locked}
              onChange={(event) => {
                const before = { layout: slide.layout };
                const layout = { ...slide.layout, kind: event.target.value as LayoutKind };
                commitSlide(slide.id, before, { layout }, "레이아웃 변경");
              }}
            >
              {LAYOUT_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {LAYOUT_LABELS[kind]}
                </option>
              ))}
            </select>
            <button
              className="sf-btn sf-btn-sm px-2"
              title={slide.locked ? "잠금 해제" : "잠그기"}
              onClick={toggleLock}
            >
              {slide.locked ? <Lock size={12} /> : <Unlock size={12} />}
            </button>
            <input
              type="range"
              min={0.3}
              max={1}
              step={0.02}
              value={zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
              className="w-28"
              aria-label="캔버스 확대"
            />
            <span className="w-9 font-mono text-[10px] text-muted">{Math.round(zoom * 100)}%</span>
          </div>

          {showDragHint && !slide.locked && (
            <div className="mb-3 flex items-center gap-2 rounded-md border border-line bg-white/80 px-3 py-1.5 text-[11px] text-muted">
              <Grip size={12} /> 텍스트를 클릭해 수정하고, <span className="sf-kbd">Alt</span> + 드래그로
              요소를 이동합니다. 단축키 <span className="sf-kbd">Ctrl+Z</span> /{" "}
              <span className="sf-kbd">Ctrl+Shift+Z</span>
              <button className="ml-2 text-muted hover:text-ink" onClick={() => setShowDragHint(false)}>
                <X size={12} />
              </button>
            </div>
          )}

          <div
            ref={canvasRef}
            className="relative shrink-0 origin-top shadow-slide"
            style={{ width: 1280 * zoom, height: 720 * zoom }}
            onPointerDown={onCanvasPointerDown}
            onPointerMove={onCanvasPointerMove}
            onPointerUp={onCanvasPointerUp}
            data-testid="slide-canvas-wrapper"
          >
            <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}>
              <SlideRenderer
                slide={slide}
                design={design}
                index={slide.order}
                total={sortedSlides.length}
                editable={!slide.locked}
                selectedId={selectedElement}
                onSelect={setSelectedElement}
                onTextChange={onTextChange}
                onImageChange={onImageChange}
              />
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2">
            <span className="sf-chip">{slide.content.title || "제목 없음"}</span>
            <span className="sf-chip">{slide.status}</span>
          </div>
        </section>

        {/* RIGHT */}
        <aside className="flex w-[330px] shrink-0 flex-col border-l border-line bg-paper">
          <div className="flex border-b border-line">
            {(
              [
                ["input", "입력 · 생성", FileText],
                ["design", "디자인", Settings2],
                ["export", "내보내기", Download],
              ] as const
            ).map(([tab, label, Icon]) => (
              <button
                key={tab}
                className={`flex flex-1 items-center justify-center gap-1 py-2 text-[11px] ${
                  rightTab === tab ? "border-b-2 border-accent text-ink" : "text-muted hover:text-ink"
                }`}
                onClick={() => setRightTab(tab)}
              >
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>
          <div className="sf-scroll min-h-0 flex-1 space-y-4 overflow-auto p-3">
            {rightTab === "input" && (
              <>
                <section>
                  <label className="sf-label">페이지 원문 · 메모</label>
                  <textarea
                    data-testid="raw-input"
                    className="sf-input min-h-[110px] text-[12px]"
                    value={slide.rawInput}
                    disabled={slide.locked}
                    onChange={(event) => {
                      const value = event.target.value;
                      const next = { rawInput: value };
                      setProject((current) =>
                        current ? patchSlide(current, slide.id, next) : current,
                      );
                      if (saveTimer.current) clearTimeout(saveTimer.current);
                      saveTimer.current = setTimeout(() => persist(slide.id, next), 500);
                    }}
                    placeholder="이 페이지에 넣을 경험, 문장, 참고 자료를 자유롭게 적으세요. 근거 없는 성과는 AI가 만들지 않습니다."
                  />
                  <p className="sf-muted mt-1">
                    자료가 없는 문장은 빈 셀로 남습니다. 원문은 AI 요약과 별도로 보존됩니다.
                  </p>
                </section>

                <section className="space-y-2 border-t border-line pt-3">
                  <label className="sf-label">전체 생성 요청</label>
                  <textarea
                    className="sf-input min-h-[62px] text-[12px]"
                    value={instruction}
                    onChange={(event) => setInstruction(event.target.value)}
                    placeholder="예: 실무 경험을 문제→행동→배움 순으로 정리해 주세요"
                  />
                  <button
                    data-testid="generate-slide"
                    className="sf-btn sf-btn-accent w-full"
                    onClick={() => generate("generate")}
                    disabled={busy || slide.locked}
                  >
                    <RefreshCw size={13} /> 이 페이지 생성
                  </button>
                  <button
                    className="sf-btn w-full"
                    onClick={() => generate("design-only")}
                    disabled={busy || slide.locked}
                  >
                    콘텐츠 유지하고 레이아웃만 변경
                  </button>
                </section>

                <section className="space-y-2 border-t border-line pt-3">
                  <label className="sf-label">자연어 부분 수정</label>
                  <textarea
                    data-testid="revise-input"
                    className="sf-input min-h-[62px] text-[12px]"
                    value={reviseInstruction}
                    onChange={(event) => setReviseInstruction(event.target.value)}
                    placeholder="예: 제목을 더 짧게, 리드문은 두 줄로"
                  />
                  <button className="sf-btn w-full" onClick={revise} disabled={busy || slide.locked}>
                    <RefreshCw size={12} /> 요청한 부분만 수정
                  </button>
                </section>

                <section className="space-y-2 border-t border-line pt-3">
                  <label className="sf-label">전체 재생성</label>
                  <select
                    className="sf-input"
                    value={bulkMode}
                    onChange={(event) =>
                      setBulkMode(event.target.value as "design" | "content" | "both")
                    }
                  >
                    <option value="content">콘텐츠만 재생성</option>
                    <option value="design">디자인만 재생성</option>
                    <option value="both">콘텐츠 + 디자인</option>
                  </select>
                  <label className="flex items-center gap-2 text-[11px] text-muted">
                    <input
                      type="checkbox"
                      checked={respectLocked}
                      onChange={(event) => setRespectLocked(event.target.checked)}
                    />
                    잠긴 페이지 제외
                  </label>
                  <button
                    data-testid="bulk-regenerate"
                    className="sf-btn w-full"
                    onClick={bulkRegenerate}
                    disabled={busy}
                  >
                    전체 재생성 (이전 상태 스냅샷)
                  </button>
                </section>
              </>
            )}

            {rightTab === "design" && (
              <>
                <section>
                  <label className="sf-label">스타일 프리셋 · 27종</label>
                  <select
                    className="sf-input"
                    value={preset}
                    onChange={(event) => {
                      const next = event.target.value as DesignPresetId;
                      setProject({ ...project, designSystem: { ...design, preset: next } });
                      void apiPost<{ project: ProjectWithSlides }>(
                        `/api/projects/${projectId}/design`,
                        { preset: next },
                      )
                        .then((data) => {
                          setProject(data.project);
                          void loadVersions();
                          flash("디자인을 변경했습니다.");
                        })
                        .catch((error: Error) => flash(error.message, "error"));
                    }}
                  >
                    {PRESETS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.name}
                      </option>
                    ))}
                  </select>
                  <p className="sf-muted mt-1">{DESIGN_PRESETS[preset]?.name}</p>
                </section>
                <section className="space-y-2 border-t border-line pt-3">
                  <label className="sf-label">자연어 디자인 요청</label>
                  <textarea
                    className="sf-input min-h-[80px] text-[12px]"
                    value={styleInstruction}
                    onChange={(event) => setStyleInstruction(event.target.value)}
                    placeholder="예: 여백을 넓히고 제목은 세리프로, 강조색은 차분한 버건디로"
                  />
                  <button className="sf-btn w-full" onClick={applyDesign} disabled={busy}>
                    디자인 적용 (이전 버전 보존)
                  </button>
                </section>
                <section className="border-t border-line pt-3">
                  <p className="sf-label">현재 토큰</p>
                  <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                    <span className="sf-chip">배경 {design.palette.bg}</span>
                    <span className="sf-chip">본문 {design.palette.ink}</span>
                    <span className="sf-chip">강조 {design.palette.accent}</span>
                    <span className="sf-chip">모드 {design.mode}</span>
                  </div>
                </section>
              </>
            )}

            {rightTab === "export" && (
              <>
                <section className="space-y-2">
                  <p className="sf-label">PDF — 우선 지원</p>
                  <p className="sf-muted">
                    1280×720 · 16:9 · 여백 없음. 텍스트 선택이 가능하고 편집 UI는 제외됩니다. 한
                    슬라이드가 한 페이지입니다.
                  </p>
                  <button
                    data-testid="export-pdf-large"
                    className="sf-btn sf-btn-accent w-full"
                    onClick={() => doExport("pdf")}
                    disabled={exportBusy}
                  >
                    <Download size={13} /> {exportBusy ? "생성 중…" : "PDF 생성"}
                  </button>
                </section>
                <section className="space-y-2 border-t border-line pt-3">
                  <p className="sf-label">PPTX — 이미지 기반</p>
                  <p className="sf-muted">
                    각 슬라이드를 2배 해상도로 캡처해 13.333×7.5인치에 배치합니다. 원본 프로젝트는
                    계속 셀 단위로 편집할 수 있습니다.
                  </p>
                  <button
                    data-testid="export-pptx"
                    className="sf-btn w-full"
                    onClick={() => doExport("pptx")}
                    disabled={exportBusy}
                  >
                    <Download size={13} /> PPTX 생성
                  </button>
                </section>
                {exportUrl && (
                  <section className="border-t border-line pt-3">
                    <a className="sf-btn sf-btn-primary w-full" href={exportUrl} target="_blank">
                      <Eye size={13} /> 생성된 파일 열기
                    </a>
                  </section>
                )}
                <section className="space-y-2 border-t border-line pt-3">
                  <p className="sf-label">인쇄 미리보기</p>
                  <a
                    className="sf-btn w-full"
                    href={`/print/${projectId}?clean=1`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Eye size={13} /> 전체 슬라이드 미리보기
                  </a>
                </section>
                <section className="space-y-2 border-t border-line pt-3">
                  <p className="sf-label">프로젝트 삭제</p>
                  <p className="sf-muted">
                    삭제 대상 표시, 정확한 확인 문구 입력, 동의 체크 후 소프트 삭제됩니다.
                  </p>
                  <button className="sf-btn w-full" onClick={() => setDeleteTarget("project")}>
                    <Trash2 size={12} /> 프로젝트 삭제
                  </button>
                </section>
              </>
            )}
          </div>
        </aside>
      </div>

      <DeleteDialog
        open={deleteTarget !== null}
        title={
          deleteTarget === "slide"
            ? `${slide.order + 1}페이지 '${slide.title || "제목 없음"}'를 삭제할까요?`
            : `'${project.title}' 프로젝트를 삭제할까요?`
        }
        description={
          deleteTarget === "slide"
            ? "이 페이지의 콘텐츠와 레이아웃이 휴지통으로 이동합니다. 삭제 이전 상태는 프로젝트 버전에서 복원할 수 있습니다."
            : "모든 페이지와 자료가 휴지통으로 이동합니다. 삭제 이전 전체 상태는 버전 스냅샷으로 보존되며 목록에서 복원할 수 있습니다."
        }
        busy={busy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
