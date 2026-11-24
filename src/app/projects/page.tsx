"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Copy, FolderOpen, RotateCcw, Search, Trash2 } from "lucide-react";
import { DeleteDialog } from "@/components/DeleteDialog";
import { api } from "@/lib/client";
import { DESIGN_PRESETS, isDesignPreset } from "@/lib/design";
import type { Project } from "@/lib/types";
import { relativeDate } from "@/lib/utils";

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [search, setSearch] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [notice, setNotice] = useState("");
  const [target, setTarget] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const query = new URLSearchParams();
      if (search) query.set("search", search);
      if (includeDeleted) query.set("includeDeleted", "1");
      const data = await api<{ projects: Project[] }>(`/api/projects?${query}`);
      setProjects(data.projects);
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, includeDeleted]);

  const visible = useMemo(() => projects, [projects]);

  async function duplicate(project: Project) {
    const data = await api<{ project: Project }>(`/api/projects/${project.id}/duplicate`, {
      method: "POST",
    });
    router.push(`/studio/${data.project.id}`);
  }

  async function restore(project: Project) {
    await api(`/api/projects/${project.id}/restore`, { method: "POST" });
    setNotice("프로젝트를 복원했습니다.");
    void load();
  }

  async function confirmDelete() {
    if (!target) return;
    setBusy(true);
    try {
      await api(`/api/projects/${target.id}`, { method: "DELETE" });
      setNotice("프로젝트를 휴지통으로 이동했습니다. 버전 목록에서 복원할 수 있습니다.");
      setTarget(null);
      void load();
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-5 pb-20 pt-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="sf-section-title">프로젝트</h1>
          <p className="sf-muted mt-1">각 프로젝트는 자료, 목차, 디자인, 버전이 완전히 독립적입니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="sf-input h-10 w-56 pl-9"
              placeholder="프로젝트 검색"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <label className="flex items-center gap-1.5 text-[12px] text-muted">
            <input
              type="checkbox"
              checked={includeDeleted}
              onChange={(event) => setIncludeDeleted(event.target.checked)}
            />
            삭제된 항목
          </label>
          <Link href="/" className="sf-btn sf-btn-primary">
            새 프로젝트
          </Link>
        </div>
      </div>

      {notice && <p className="mb-4 rounded-md bg-white px-3 py-2 text-[12px] text-muted">{notice}</p>}

      {visible.length === 0 ? (
        <div className="sf-card flex flex-col items-center justify-center px-6 py-20 text-center">
          <FolderOpen size={32} className="mb-3 text-muted/50" />
          <p className="font-display text-xl">아직 프로젝트가 없습니다.</p>
          <p className="sf-muted mt-1">첫 프롬프트를 입력하면 전체 구성 초안이 만들어집니다.</p>
          <Link href="/" className="sf-btn sf-btn-accent mt-5">
            새 만들기
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((project) => {
            const preset = isDesignPreset(project.designSystem?.preset)
              ? DESIGN_PRESETS[project.designSystem.preset]
              : null;
            return (
              <article key={project.id} className="sf-card overflow-hidden" data-testid="project-card">
                <div
                  className="relative h-28 overflow-hidden border-b border-line"
                  style={{ background: preset?.palette.bg ?? "#eee" }}
                >
                  <div className="absolute inset-x-6 bottom-5">
                    <div className="mb-1.5 h-1.5 w-16" style={{ background: preset?.palette.accent }} />
                    <div className="h-2.5 w-3/4 rounded-sm" style={{ background: preset?.palette.ink, opacity: 0.75 }} />
                    <div className="mt-1.5 h-1.5 w-1/2 rounded-sm" style={{ background: preset?.palette.muted, opacity: 0.55 }} />
                  </div>
                  <span className="absolute right-2 top-2 rounded bg-black/5 px-1.5 py-0.5 font-mono text-[9px] text-muted">
                    16:9
                  </span>
                </div>
                <div className="p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="truncate font-mono text-[10px] text-muted">{preset?.name ?? project.designSystem?.preset}</span>
                    <span className="ml-auto text-[10px] text-muted">{relativeDate(project.updatedAt)}</span>
                  </div>
                  <h2 className="truncate font-display text-lg tracking-tight">{project.title}</h2>
                  <p className="mt-1 line-clamp-2 h-9 text-[12px] leading-relaxed text-muted">
                    {project.brief?.coreMessage || project.masterPrompt}
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
                    <span className="sf-chip">{project.slideCount} 페이지</span>
                    <span className="sf-chip">{project.status}</span>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-1.5">
                    <Link className="sf-btn sf-btn-sm sf-btn-primary" href={`/studio/${project.id}`}>
                      결과 열기 <ArrowUpRight size={12} />
                    </Link>
                    <Link className="sf-btn sf-btn-sm" href={`/projects/${project.id}/outline`}>
                      목차 편집
                    </Link>
                    <button className="sf-btn sf-btn-sm" onClick={() => duplicate(project)} title="프로젝트 복제">
                      <Copy size={12} /> 복제
                    </button>
                    {project.status === "draft" || includeDeleted ? (
                      <button
                        className="sf-btn sf-btn-sm"
                        onClick={() => restore(project)}
                        title="복원"
                      >
                        <RotateCcw size={12} />
                      </button>
                    ) : null}
                    <button
                      data-testid="delete-project"
                      className="sf-btn sf-btn-sm ml-auto"
                      onClick={() => setTarget(project)}
                      title="삭제"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <DeleteDialog
        open={Boolean(target)}
        title={`'${target?.title ?? ""}' 프로젝트를 삭제할까요?`}
        description={`이 프로젝트의 ${target?.slideCount ?? 0}개 페이지와 자료가 휴지통으로 이동합니다. 삭제 이전 상태는 버전 스냅샷으로 보존되며, 프로젝트 목록에서 복원할 수 있습니다.`}
        busy={busy}
        onCancel={() => setTarget(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
