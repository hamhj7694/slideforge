"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Copy,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";
import { ModelPicker } from "@/components/ModelPicker";
import { StylePicker } from "@/components/StylePicker";
import { api, apiPost } from "@/lib/client";
import { DETECTED_PRESET_FALLBACK } from "@/lib/ai/design-bridge";
import { LAYOUT_KINDS, LAYOUT_LABELS } from "@/lib/types";
import type {
  DesignPresetId,
  LayoutKind,
  OutlineItem,
  OutlinePart,
  ProjectBrief,
  ProjectWithSlides,
} from "@/lib/types";
import { newId } from "@/lib/utils";

export default function OutlinePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;
  const [project, setProject] = useState<ProjectWithSlides | null>(null);
  const [brief, setBrief] = useState<ProjectBrief | null>(null);
  const [preset, setPreset] = useState<DesignPresetId>("modern-editorial");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [designInstruction, setDesignInstruction] = useState("");
  const [showStyles, setShowStyles] = useState(false);

  useEffect(() => {
    api<{ project: ProjectWithSlides | null }>(`/api/projects/${projectId}`)
      .then(({ project: loaded }) => {
        if (!loaded) {
          setNotice("프로젝트를 찾을 수 없습니다.");
          return;
        }
        setProject(loaded);
        setBrief(structuredClone(loaded.brief));
        setPreset(loaded.designSystem.preset);
      })
      .catch((error) => setNotice((error as Error).message));
  }, [projectId]);

  function updateOutline(index: number, patch: Partial<OutlineItem>) {
    if (!brief) return;
    const outline = [...brief.outline];
    outline[index] = { ...outline[index], ...patch };
    setBrief({ ...brief, outline });
  }

  function move(index: number, direction: -1 | 1) {
    if (!brief) return;
    const target = index + direction;
    if (target < 0 || target >= brief.outline.length) return;
    const outline = [...brief.outline];
    [outline[index], outline[target]] = [outline[target], outline[index]];
    setBrief({ ...brief, outline });
  }

  function duplicateItem(index: number) {
    if (!brief) return;
    const outline = [...brief.outline];
    outline.splice(index + 1, 0, {
      ...structuredClone(outline[index]),
      id: newId("ol"),
      title: `${outline[index].title} (복사)`,
    });
    setBrief({ ...brief, outline });
  }

  function removeItem(index: number) {
    if (!brief || brief.outline.length <= 3) {
      setNotice("목차는 최소 3페이지 이상이어야 합니다.");
      return;
    }
    setBrief({ ...brief, outline: brief.outline.filter((_, i) => i !== index) });
  }

  function updatePart(index: number, patch: Partial<OutlinePart>) {
    if (!brief) return;
    const parts = brief.parts.map((part, i) => (i === index ? { ...part, ...patch } : part));
    setBrief({ ...brief, parts });
  }

  async function save() {
    if (!brief) return;
    setSaving(true);
    setNotice("목차와 디자인 설정을 저장하고 있습니다…");
    try {
      const data = await apiPost<{ project: ProjectWithSlides }>(
        `/api/projects/${projectId}/outline`,
        { brief, designPreset: preset },
      );
      setProject(data.project);
      setNotice("저장했습니다. 이전 구성은 버전에서 복원할 수 있습니다.");
    } catch (error) {
      setNotice(`저장 실패: ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  async function replan() {
    setBusy(true);
    setNotice("전체 스토리를 다시 제안하고 있습니다…");
    try {
      const data = await apiPost<{
        brief: ProjectBrief;
        preset: string;
        generation: { notice?: string };
      }>(`/api/projects/${projectId}/replan`, {});
      setBrief(data.brief);
      setPreset(DETECTED_PRESET_FALLBACK(data.preset));
      setNotice(
        data.generation.notice ??
          "새 구성 초안을 불러왔습니다. 확인 후 저장하면 이전 버전이 보존됩니다.",
      );
    } catch (error) {
      setNotice(`재추천 실패: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function applyDesign() {
    setBusy(true);
    try {
      const data = await apiPost<{ project: ProjectWithSlides; notice?: string }>(
        `/api/projects/${projectId}/design`,
        { preset, instruction: designInstruction || undefined },
      );
      setProject(data.project);
      setNotice(data.notice ?? "디자인을 적용했습니다.");
      setDesignInstruction("");
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const jobSource = useMemo(
    () => project?.sources.find((source) => source.type === "job-posting"),
    [project],
  );
  const keywords = useMemo(() => {
    if (!jobSource) return [] as string[];
    const text = jobSource.extractedContent;
    const found = [
      "AI 마케터", "데이터", "콘텐츠", "영상", "자동화", "개발", "프로젝트", "협업", "성과", "기획",
    ].filter((word) => text.includes(word));
    return found.slice(0, 8);
  }, [jobSource]);

  if (!brief) {
    return (
      <div className="mx-auto max-w-5xl px-5 py-20 text-center text-[13px] text-muted">
        {notice || "프로젝트를 불러오는 중…"}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/projects" className="mb-2 inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink">
            <ArrowLeft size={13} /> 프로젝트 목록
          </Link>
          <h1 className="sf-section-title">전체 구성 · 목차</h1>
          <p className="sf-muted mt-1">
            {project?.title} · {brief.outline.length}페이지 · 변경 전 상태는 저장 시마다 스냅샷으로 남습니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ModelPicker compact onNotice={setNotice} />
          <button className="sf-btn" onClick={replan} disabled={busy}>
            <RefreshCw size={13} /> 구성 다시 제안
          </button>
          <button data-testid="save-outline" className="sf-btn sf-btn-primary" onClick={save} disabled={saving}>
            <Save size={13} /> {saving ? "저장 중…" : "구성 확정"}
          </button>
        </div>
      </div>

      {notice && (
        <p data-testid="outline-notice" className="mb-5 rounded-md border border-line bg-white px-3 py-2 text-[12px] text-muted">
          {notice}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <section className="sf-card p-5">
            <h2 className="mb-4 font-display text-xl tracking-tight">스토리 기반</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["purpose", "목적"],
                  ["audience", "대상 독자"],
                  ["coreMessage", "핵심 메시지"],
                  ["tone", "톤"],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <label className="sf-label">{label}</label>
                  <input
                    className="sf-input"
                    value={brief[key]}
                    onChange={(event) => setBrief({ ...brief, [key]: event.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3">
              <label className="sf-label">전체 줄거리</label>
              <textarea
                className="sf-input min-h-[70px]"
                value={brief.storyline}
                onChange={(event) => setBrief({ ...brief, storyline: event.target.value })}
              />
            </div>
            <div className="mt-3">
              <label className="sf-label">시각 방향</label>
              <textarea
                className="sf-input min-h-[60px]"
                value={brief.visualDirection}
                onChange={(event) => setBrief({ ...brief, visualDirection: event.target.value })}
              />
            </div>
          </section>

          <section className="sf-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl tracking-tight">파트</h2>
              <button
                className="sf-btn sf-btn-sm"
                onClick={() =>
                  setBrief({
                    ...brief,
                    parts: [
                      ...brief.parts,
                      { id: newId("part"), title: `PART ${brief.parts.length + 1} — 새 파트`, description: "" },
                    ],
                  })
                }
              >
                <Plus size={12} /> 파트 추가
              </button>
            </div>
            <div className="space-y-2">
              {brief.parts.map((part, index) => (
                <div key={part.id} className="flex gap-2">
                  <input
                    className="sf-input"
                    value={part.title}
                    onChange={(event) => updatePart(index, { title: event.target.value })}
                  />
                  <button
                    className="sf-btn sf-btn-sm px-2"
                    aria-label="파트 삭제"
                    onClick={() =>
                      setBrief({
                        ...brief,
                        parts: brief.parts.filter((_, i) => i !== index),
                        outline: brief.outline.map((item) =>
                          item.partId === part.id ? { ...item, partId: undefined } : item,
                        ),
                      })
                    }
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section className="sf-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl tracking-tight">페이지 목차</h2>
              <button
                className="sf-btn sf-btn-sm"
                onClick={() =>
                  setBrief({
                    ...brief,
                    outline: [
                      ...brief.outline,
                      {
                        id: newId("ol"),
                        title: "새 페이지",
                        role: "",
                        keyMessage: "",
                        visual: "statement",
                      },
                    ],
                  })
                }
              >
                <Plus size={12} /> 페이지 추가
              </button>
            </div>
            <ol className="space-y-2" data-testid="outline-list">
              {brief.outline.map((item, index) => (
                <li key={item.id} className="rounded-lg border border-line bg-white p-3" data-testid="outline-row">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] font-semibold text-accent">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <select
                      className="h-8 rounded border border-line bg-white px-1.5 text-[11px]"
                      value={item.partId ?? ""}
                      onChange={(event) => updateOutline(index, { partId: event.target.value || undefined })}
                    >
                      <option value="">파트 없음</option>
                      {brief.parts.map((part) => (
                        <option key={part.id} value={part.id}>
                          {part.title}
                        </option>
                      ))}
                    </select>
                    <div className="ml-auto flex gap-1">
                      <button className="sf-btn sf-btn-ghost sf-btn-sm px-1.5" aria-label="위로" onClick={() => move(index, -1)}>
                        <ArrowUp size={12} />
                      </button>
                      <button className="sf-btn sf-btn-ghost sf-btn-sm px-1.5" aria-label="아래로" onClick={() => move(index, 1)}>
                        <ArrowDown size={12} />
                      </button>
                      <button className="sf-btn sf-btn-ghost sf-btn-sm px-1.5" aria-label="복제" onClick={() => duplicateItem(index)}>
                        <Copy size={12} />
                      </button>
                      <button className="sf-btn sf-btn-ghost sf-btn-sm px-1.5" aria-label="삭제" onClick={() => removeItem(index)}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_190px]">
                    <input
                      className="sf-input h-9"
                      value={item.title}
                      aria-label={`${index + 1}페이지 제목`}
                      onChange={(event) => updateOutline(index, { title: event.target.value })}
                    />
                    <select
                      className="sf-input h-9"
                      value={item.visual}
                      aria-label={`${index + 1}페이지 레이아웃`}
                      onChange={(event) => updateOutline(index, { visual: event.target.value as LayoutKind })}
                    >
                      {LAYOUT_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {LAYOUT_LABELS[kind]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <input
                      className="sf-input h-8 text-[12px]"
                      placeholder="페이지 역할"
                      value={item.role}
                      onChange={(event) => updateOutline(index, { role: event.target.value })}
                    />
                    <input
                      className="sf-input h-8 text-[12px]"
                      placeholder="한 페이지 핵심 메시지"
                      value={item.keyMessage}
                      onChange={(event) => updateOutline(index, { keyMessage: event.target.value })}
                    />
                  </div>
                </li>
              ))}
            </ol>
            <button
              data-testid="go-editor"
              className="sf-btn sf-btn-accent mt-4 w-full"
              onClick={async () => {
                await save();
                router.push(`/projects/${projectId}/editor`);
              }}
            >
              <Check size={14} /> 구성 확정하고 편집기로 이동
            </button>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="sf-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg tracking-tight">디자인 스타일</h2>
              <button className="sf-btn sf-btn-sm" onClick={() => setShowStyles(!showStyles)}>
                {showStyles ? "접기" : "변경"}
              </button>
            </div>
            <div className="mb-3 rounded-lg border border-line bg-white p-3">
              <p className="text-[12px] font-semibold">{preset}</p>
              <p className="sf-muted mt-1">생성 전·기획 중·편집 중·완료 후 모두 변경할 수 있습니다.</p>
            </div>
            {showStyles && <StylePicker value={preset} onChange={setPreset} />}
            <div className="mt-3">
              <label className="sf-label">자연어 디자인 요청</label>
              <textarea
                className="sf-input min-h-[70px]"
                placeholder="예: 네오 브루탈리즘 느낌으로, 제목은 크고 굵게. 또는 '리소그래프 스타일로 바꿔줘'"
                value={designInstruction}
                onChange={(event) => setDesignInstruction(event.target.value)}
              />
              <button className="sf-btn sf-btn-sm mt-2 w-full" onClick={applyDesign} disabled={busy}>
                디자인 적용 (이전 버전 보존)
              </button>
            </div>
          </section>

          <section className="sf-card p-5">
            <h2 className="mb-3 font-display text-lg tracking-tight">공고 요구사항 매핑</h2>
            {jobSource ? (
              <>
                <p className="sf-muted mb-2">
                  자료: <span className="font-semibold text-ink">{jobSource.title}</span>
                  <br />
                  원문 {jobSource.originalContent.length.toLocaleString()}자 보존 · AI 요약과 분리 저장
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {keywords.length ? (
                    keywords.map((word) => <span key={word} className="sf-chip">{word}</span>)
                  ) : (
                    <span className="sf-muted">키워드를 추출하지 못했습니다. 원문을 확인해 주세요.</span>
                  )}
                </div>
                <div className="mt-4 space-y-1.5">
                  {brief.outline.slice(0, 6).map((item, index) => {
                    const matched = keywords.filter((word) =>
                      `${item.title} ${item.role} ${item.keyMessage}`.includes(word),
                    );
                    return (
                      <div key={item.id} className="flex items-center gap-2 text-[11px]">
                        <span className="font-mono text-muted">{String(index + 1).padStart(2, "0")}</span>
                        <span className="truncate text-ink">{item.title}</span>
                        <span className="ml-auto truncate text-muted">
                          {matched.length ? `연결: ${matched.join(", ")}` : "검토 필요"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="sf-muted">채용공고 자료가 없습니다. 메인 화면에서 추가하면 요구사항 연결을 확인할 수 있습니다.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
