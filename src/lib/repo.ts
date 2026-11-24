import { and, desc, eq, isNull, like, or } from "drizzle-orm";
import { getDb } from "./db";
import {
  appSettings,
  exports as exportTable,
  secrets,
  slides,
  sources,
  usage,
  uploads,
  versions,
  projects,
} from "./db/schema";
import type {
  DesignSystem,
  LayoutSpec,
  Project,
  ProjectBrief,
  ProjectSource,
  ProjectWithSlides,
  Slide,
  StructuredContent,
  UsageEntry,
} from "./types";
import { newId, nowIso } from "./utils";

type ProjectRow = typeof projects.$inferSelect;
type SlideRow = typeof slides.$inferSelect;
type SourceRow = typeof sources.$inferSelect;

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    title: row.title,
    purpose: row.purpose,
    audience: row.audience,
    tone: row.tone,
    masterPrompt: row.masterPrompt,
    status: row.status,
    brief: row.brief,
    designSystem: row.designSystem,
    slideCount: row.outline.length,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toSlide(row: SlideRow): Slide {
  return {
    id: row.id,
    projectId: row.projectId,
    order: row.orderIndex,
    title: row.title,
    role: row.role,
    rawInput: row.rawInput,
    attachments: row.attachments,
    content: row.content,
    layout: row.layout,
    designOverrides: row.designOverrides as Partial<DesignSystem>,
    sources: row.sources,
    partId: row.partId ?? undefined,
    visualOverrides: row.visualOverrides as Slide["visualOverrides"],
    status: row.status,
    locked: Boolean(row.locked),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toSource(row: SourceRow): ProjectSource {
  return {
    id: row.id,
    projectId: row.projectId,
    type: row.kind as ProjectSource["type"],
    title: row.label,
    url: row.url ?? undefined,
    filePath: row.storedName ? `/api/uploads/${row.storedName}` : undefined,
    originalContent: row.content,
    extractedContent: row.excerpt || row.content,
    extractionStatus: row.extractionStatus as ProjectSource["extractionStatus"],
    metadata: row.metadata,
    importedAt: row.createdAt,
  };
}

export interface CreateProjectData {
  title: string;
  masterPrompt: string;
  purpose: string;
  audience: string;
  tone: string;
  brief: ProjectBrief;
  designSystem: DesignSystem;
  sources: ProjectSource[];
}

export function listProjects(options: {
  search?: string;
  includeDeleted?: boolean;
} = {}): Project[] {
  const db = getDb();
  const rows = db
    .select()
    .from(projects)
    .where(
      and(
        options.includeDeleted ? undefined : isNull(projects.deletedAt),
        options.search
          ? or(
              like(projects.title, `%${options.search}%`),
              like(projects.masterPrompt, `%${options.search}%`),
            )
          : undefined,
      ),
    )
    .orderBy(desc(projects.updatedAt))
    .all();
  return rows.map(toProject);
}

export function getProject(id: string, includeDeleted = false): Project | null {
  const row = getDb()
    .select()
    .from(projects)
    .where(
      includeDeleted
        ? eq(projects.id, id)
        : and(eq(projects.id, id), isNull(projects.deletedAt)),
    )
    .get();
  return row ? toProject(row) : null;
}

export function getProjectWithSlides(id: string): ProjectWithSlides | null {
  const project = getProject(id);
  if (!project) return null;
  const db = getDb();
  const slideRows = db
    .select()
    .from(slides)
    .where(eq(slides.projectId, id))
    .orderBy(slides.orderIndex)
    .all();
  const sourceRows = db
    .select()
    .from(sources)
    .where(eq(sources.projectId, id))
    .orderBy(desc(sources.createdAt))
    .all();
  return {
    ...project,
    slides: slideRows.map(toSlide),
    sources: sourceRows.map(toSource),
  };
}

export function createProject(data: CreateProjectData): ProjectWithSlides {
  const db = getDb();
  const timestamp = nowIso();
  const id = newId("prj");
  const sourceRows = data.sources.map((source) => ({
    id: source.id || newId("src"),
    projectId: id,
    kind: source.type,
    label: source.title,
    url: source.url ?? null,
    mime: null,
    storedName: source.filePath ? source.filePath.split("/").pop() ?? null : null,
    excerpt: source.extractedContent.slice(0, 20000),
    content: source.originalContent.slice(0, 50000),
    extractionStatus: source.extractionStatus,
    metadata: (source.metadata ?? {}) as Record<string, unknown>,
    createdAt: timestamp,
  }));

  db.transaction((tx) => {
    tx.insert(projects)
      .values({
        id,
        title: data.title,
        purpose: data.purpose,
        audience: data.audience,
        tone: data.tone,
        masterPrompt: data.masterPrompt,
        brief: data.brief,
        designSystem: data.designSystem,
        status: "draft",
        outline: data.brief.outline,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();

    data.brief.outline.forEach((item, index) => {
      const content: StructuredContent = { title: item.title };
      const layout: LayoutSpec = { kind: item.visual, showFooter: true };
      tx.insert(slides)
        .values({
          id: newId("sld"),
          projectId: id,
          orderIndex: index,
          title: item.title,
          role: item.role,
          rawInput: "",
          attachments: [],
          content,
          layout,
          designOverrides: {},
          sources: [],
          partId: item.partId ?? null,
          visualOverrides: {},
          status: "draft",
          locked: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
    });

    for (const row of sourceRows) tx.insert(sources).values(row).run();
  });

  return getProjectWithSlides(id)!;
}

export function updateProject(
  id: string,
  patch: Partial<{
    title: string;
    purpose: string;
    audience: string;
    tone: string;
    masterPrompt: string;
    brief: ProjectBrief;
    designSystem: DesignSystem;
    status: Project["status"];
  }>,
): Project | null {
  const db = getDb();
  db.update(projects)
    .set({
      ...patch,
      outline: patch.brief?.outline ?? undefined,
      updatedAt: nowIso(),
    })
    .where(eq(projects.id, id))
    .run();
  return getProject(id);
}

export function softDeleteProject(id: string) {
  getDb()
    .update(projects)
    .set({ deletedAt: nowIso(), updatedAt: nowIso() })
    .where(eq(projects.id, id))
    .run();
}

export function restoreProject(id: string) {
  getDb()
    .update(projects)
    .set({ deletedAt: null, updatedAt: nowIso() })
    .where(eq(projects.id, id))
    .run();
}

export function duplicateProject(id: string): ProjectWithSlides | null {
  const original = getProjectWithSlides(id);
  if (!original) return null;
  const timestamp = nowIso();
  const newProjectId = newId("prj");
  const brief: ProjectBrief = {
    ...structuredClone(original.brief),
    outline: original.brief.outline.map((item) => ({ ...item, id: newId("ol") })),
    parts: original.brief.parts.map((part) => ({ ...part, id: newId("part") })),
  };
  const db = getDb();
  db.transaction((tx) => {
    tx.insert(projects)
      .values({
        id: newProjectId,
        title: `${original.title} (복사본)`,
        purpose: original.purpose,
        audience: original.audience,
        tone: original.tone,
        masterPrompt: original.masterPrompt,
        brief,
        designSystem: structuredClone(original.designSystem),
        status: "draft",
        outline: brief.outline,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();
    original.slides.forEach((slide, index) => {
      tx.insert(slides)
        .values({
          id: newId("sld"),
          projectId: newProjectId,
          orderIndex: index,
          title: slide.title,
          role: slide.role,
          rawInput: slide.rawInput,
          attachments: structuredClone(slide.attachments),
          content: structuredClone(slide.content),
          layout: structuredClone(slide.layout),
          designOverrides: structuredClone(slide.designOverrides),
          sources: structuredClone(slide.sources),
          partId: slide.partId ?? null,
          visualOverrides: structuredClone(slide.visualOverrides),
          status: slide.status,
          locked: false,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
    });
    original.sources.forEach((source) => {
      tx.insert(sources)
        .values({
          id: newId("src"),
          projectId: newProjectId,
          kind: source.type,
          label: source.title,
          url: source.url ?? null,
          mime: null,
          storedName: source.filePath ? source.filePath.split("/").pop() ?? null : null,
          excerpt: source.extractedContent.slice(0, 20000),
          content: source.originalContent.slice(0, 50000),
          extractionStatus: source.extractionStatus,
          metadata: (source.metadata ?? {}) as Record<string, unknown>,
          createdAt: timestamp,
        })
        .run();
    });
  });
  return getProjectWithSlides(newProjectId);
}

export function getSlide(projectId: string, slideId: string): Slide | null {
  const row = getDb()
    .select()
    .from(slides)
    .where(and(eq(slides.id, slideId), eq(slides.projectId, projectId)))
    .get();
  return row ? toSlide(row) : null;
}

export function createSlide(
  projectId: string,
  data: { title?: string; role?: string; rawInput?: string; afterSlideId?: string; partId?: string },
): Slide {
  const db = getDb();
  const existing = db
    .select()
    .from(slides)
    .where(eq(slides.projectId, projectId))
    .orderBy(slides.orderIndex)
    .all();
  const anchor = data.afterSlideId
    ? existing.findIndex((slide) => slide.id === data.afterSlideId)
    : existing.length - 1;
  const order = anchor >= 0 ? anchor + 1 : existing.length;
  const timestamp = nowIso();
  const id = newId("sld");
  db.transaction((tx) => {
    if (anchor >= 0) {
      existing.slice(anchor + 1).forEach((slide) => {
        tx.update(slides)
          .set({ orderIndex: slide.orderIndex + 1 })
          .where(eq(slides.id, slide.id))
          .run();
      });
    }
    tx.insert(slides)
      .values({
        id,
        projectId,
        orderIndex: order,
        title: data.title ?? "새 슬라이드",
        role: data.role ?? "",
        rawInput: data.rawInput ?? "",
        attachments: [],
        content: { title: data.title ?? "새 슬라이드" },
        layout: { kind: "statement", showFooter: true },
        designOverrides: {},
        sources: [],
        partId: data.partId ?? null,
        visualOverrides: {},
        status: "draft",
        locked: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      .run();
  });
  touchProject(projectId);
  return getSlide(projectId, id)!;
}

type SlidePatch = Partial<{
  title: string;
  role: string;
  rawInput: string;
  content: StructuredContent;
  layout: LayoutSpec;
  designOverrides: Partial<DesignSystem>;
  visualOverrides: Slide["visualOverrides"];
  partId: string;
  attachments: Slide["attachments"];
  status: Slide["status"];
  locked: boolean;
  sources: Slide["sources"];
}>;

export function updateSlide(projectId: string, slideId: string, patch: SlidePatch): Slide | null {
  const db = getDb();
  const result = db
    .update(slides)
    .set({ ...patch, updatedAt: nowIso() })
    .where(and(eq(slides.id, slideId), eq(slides.projectId, projectId)))
    .run();
  if (!result.changes) return null;
  touchProject(projectId);
  return getSlide(projectId, slideId);
}

export function deleteSlide(projectId: string, slideId: string): boolean {
  const db = getDb();
  const result = db
    .delete(slides)
    .where(and(eq(slides.id, slideId), eq(slides.projectId, projectId)))
    .run();
  if (result.changes) {
    db.select()
      .from(slides)
      .where(eq(slides.projectId, projectId))
      .orderBy(slides.orderIndex)
      .all()
      .forEach((slide, index) => {
        db.update(slides)
          .set({ orderIndex: index })
          .where(eq(slides.id, slide.id))
          .run();
      });
    touchProject(projectId);
  }
  return result.changes > 0;
}

export function reorderSlides(projectId: string, slideIds: string[]) {
  const db = getDb();
  db.transaction((tx) => {
    slideIds.forEach((id, index) => {
      tx.update(slides)
        .set({ orderIndex: index, updatedAt: nowIso() })
        .where(and(eq(slides.id, id), eq(slides.projectId, projectId)))
        .run();
    });
  });
  touchProject(projectId);
}

function touchProject(projectId: string) {
  getDb()
    .update(projects)
    .set({ updatedAt: nowIso() })
    .where(eq(projects.id, projectId))
    .run();
}

export function snapshotProjectVersion(
  projectId: string,
  label: string,
  kind: "project" | "slide" = "project",
  slideId?: string,
): string {
  const project = getProjectWithSlides(projectId);
  if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");
  const id = newId("ver");
  getDb()
    .insert(versions)
    .values({
      id,
      projectId,
      slideId: slideId ?? null,
      kind,
      label,
      snapshot: { ...project } as unknown as Record<string, unknown>,
      createdAt: nowIso(),
    })
    .run();
  return id;
}

export function snapshotSlideVersion(projectId: string, slideId: string, label: string) {
  const slide = getSlide(projectId, slideId);
  if (!slide) return null;
  const id = newId("ver");
  getDb()
    .insert(versions)
    .values({
      id,
      projectId,
      slideId,
      kind: "slide",
      label,
      snapshot: {
        title: slide.title,
        rawInput: slide.rawInput,
        content: slide.content,
        layout: slide.layout,
        designOverrides: slide.designOverrides,
        visualOverrides: slide.visualOverrides,
        status: slide.status,
      } as unknown as Record<string, unknown>,
      createdAt: nowIso(),
    })
    .run();
  const rows = getDb()
    .select()
    .from(versions)
    .where(and(eq(versions.projectId, projectId), eq(versions.slideId, slideId)))
    .orderBy(desc(versions.createdAt))
    .all();
  // Keep a bounded history; the most recent 30 snapshots are enough for a single-user editor.
  rows.slice(30).forEach((row) => {
    getDb().delete(versions).where(eq(versions.id, row.id)).run();
  });
  return id;
}

export function listVersions(projectId: string, slideId?: string) {
  const rows = getDb()
    .select()
    .from(versions)
    .where(
      slideId
        ? and(eq(versions.projectId, projectId), eq(versions.slideId, slideId))
        : and(eq(versions.projectId, projectId), isNull(versions.slideId)),
    )
    .orderBy(desc(versions.createdAt))
    .all();
  return rows.map((row) => ({
    id: row.id,
    projectId: row.projectId,
    slideId: row.slideId ?? undefined,
    kind: row.kind,
    label: row.label,
    snapshot: row.snapshot,
    createdAt: row.createdAt,
  }));
}

export function restoreSlideVersion(projectId: string, slideId: string, versionId: string) {
  const row = getDb()
    .select()
    .from(versions)
    .where(and(eq(versions.id, versionId), eq(versions.projectId, projectId)))
    .get();
  if (!row || row.slideId !== slideId) return null;
  const snapshot = row.snapshot as unknown as SlidePatch;
  snapshotSlideVersion(projectId, slideId, "복원 이전 상태");
  return updateSlide(projectId, slideId, snapshot);
}

export function restoreProjectVersion(projectId: string, versionId: string): ProjectWithSlides | null {
  const row = getDb()
    .select()
    .from(versions)
    .where(and(eq(versions.id, versionId), eq(versions.projectId, projectId)))
    .get();
  if (!row) return null;
  const snapshot = row.snapshot as unknown as ProjectWithSlides;
  snapshotProjectVersion(projectId, "복원 이전 상태");
  const timestamp = nowIso();
  const db = getDb();
  db.transaction((tx) => {
    tx.update(projects)
      .set({
        title: snapshot.title,
        purpose: snapshot.purpose,
        audience: snapshot.audience,
        tone: snapshot.tone,
        masterPrompt: snapshot.masterPrompt,
        brief: snapshot.brief,
        designSystem: snapshot.designSystem,
        outline: snapshot.brief.outline,
        updatedAt: timestamp,
      })
      .where(eq(projects.id, projectId))
      .run();
    tx.delete(slides).where(eq(slides.projectId, projectId)).run();
    snapshot.slides.forEach((slide, index) => {
      tx.insert(slides)
        .values({
          id: slide.id,
          projectId,
          orderIndex: index,
          title: slide.title,
          role: slide.role,
          rawInput: slide.rawInput,
          attachments: slide.attachments,
          content: slide.content,
          layout: slide.layout,
          designOverrides: slide.designOverrides ?? {},
          sources: slide.sources ?? [],
          partId: slide.partId ?? null,
          visualOverrides: slide.visualOverrides ?? {},
          status: slide.status,
          locked: slide.locked,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
        .run();
    });
  });
  return getProjectWithSlides(projectId);
}

export function addSource(
  projectId: string,
  data: {
    type: ProjectSource["type"];
    title: string;
    url?: string;
    text?: string;
    storedName?: string;
    mime?: string;
    metadata?: Record<string, unknown>;
  },
): ProjectSource {
  const id = newId("src");
  getDb()
    .insert(sources)
    .values({
      id,
      projectId,
      kind: data.type,
      label: data.title,
      url: data.url ?? null,
      mime: data.mime ?? null,
      storedName: data.storedName ?? null,
      excerpt: (data.text ?? "").slice(0, 20000),
      content: (data.text ?? "").slice(0, 50000),
      extractionStatus: "done",
      metadata: data.metadata ?? {},
      createdAt: nowIso(),
    })
    .run();
  touchProject(projectId);
  return toSource(
    getDb().select().from(sources).where(eq(sources.id, id)).get()!,
  );
}

export function deleteSource(projectId: string, sourceId: string) {
  getDb()
    .delete(sources)
    .where(and(eq(sources.id, sourceId), eq(sources.projectId, projectId)))
    .run();
  touchProject(projectId);
}

export function createUpload(data: {
  originalName: string;
  storedName: string;
  mime: string;
  size: number;
  extractedText?: string;
}) {
  const id = newId("upl");
  getDb()
    .insert(uploads)
    .values({
      id,
      originalName: data.originalName,
      storedName: data.storedName,
      mime: data.mime,
      size: data.size,
      extractedText: data.extractedText ?? "",
      createdAt: nowIso(),
    })
    .run();
  return getUploadById(id);
}

export function getUploadById(id: string) {
  const row = getDb().select().from(uploads).where(eq(uploads.id, id)).get();
  if (!row) return null;
  return {
    id: row.id,
    originalName: row.originalName,
    storedName: row.storedName,
    url: `/api/uploads/${row.storedName}`,
    mime: row.mime,
    size: row.size,
    extractedText: row.extractedText,
  };
}

export function getUploadByStoredName(storedName: string) {
  const row = getDb()
    .select()
    .from(uploads)
    .where(eq(uploads.storedName, storedName))
    .get();
  return row ?? null;
}

export function recordExport(data: {
  projectId: string;
  format: string;
  filename: string;
  path: string;
  pages: number;
  meta?: Record<string, unknown>;
}) {
  const id = newId("exp");
  getDb()
    .insert(exportTable)
    .values({
      id,
      projectId: data.projectId,
      format: data.format,
      filename: data.filename,
      path: data.path,
      pages: data.pages,
      meta: data.meta ?? {},
      createdAt: nowIso(),
    })
    .run();
  return id;
}

export function getExport(id: string) {
  return getDb().select().from(exportTable).where(eq(exportTable.id, id)).get() ?? null;
}

export function listExports(projectId: string) {
  return getDb()
    .select()
    .from(exportTable)
    .where(eq(exportTable.projectId, projectId))
    .orderBy(desc(exportTable.createdAt))
    .all();
}

export function recordUsage(entry: Omit<UsageEntry, "id" | "createdAt">) {
  getDb()
    .insert(usage)
    .values({ ...entry, id: newId("use"), createdAt: nowIso() })
    .run();
}

export function getUsageSummary() {
  const rows = getDb().select().from(usage).orderBy(desc(usage.createdAt)).limit(100).all();
  return {
    totalCalls: rows.length,
    totalCostUsd: rows.reduce((sum, row) => sum + row.costUsd, 0),
    totalInputTokens: rows.reduce((sum, row) => sum + row.inputTokens, 0),
    totalOutputTokens: rows.reduce((sum, row) => sum + row.outputTokens, 0),
    recent: rows.slice(0, 20) as UsageEntry[],
  };
}

export interface ResolvedSettings {
  provider: "local" | "openai" | "anthropic" | "openrouter";
  model: string;
  baseUrl: string;
  hasKey: boolean;
  maskedKey: string;
  source: "env" | "database" | "none";
}

export function getSettings(): ResolvedSettings {
  const row = getDb().select().from(appSettings).get();
  const envProvider = (process.env.AI_PROVIDER || "local") as ResolvedSettings["provider"];
  const provider = (row?.provider ?? envProvider) as ResolvedSettings["provider"];
  const model =
    row?.model ||
    process.env.AI_MODEL ||
    (provider === "openai" ? "gpt-4o-mini" : provider === "anthropic" ? "claude-3-5-haiku-latest" : "local-draft-v1");
  const baseUrl = row?.baseUrl || process.env.AI_BASE_URL || "";
  const secret = getDb().select().from(secrets).where(eq(secrets.provider, provider)).get();
  const envKey =
    provider === "openai"
      ? process.env.OPENAI_API_KEY
      : provider === "anthropic"
        ? process.env.ANTHROPIC_API_KEY
        : provider === "openrouter"
          ? process.env.OPENROUTER_API_KEY
          : undefined;
  const apiKey = secret?.apiKey || envKey || "";
  return {
    provider,
    model,
    baseUrl,
    hasKey: Boolean(apiKey),
    maskedKey: apiKey ? `${apiKey.slice(0, 6)}···${apiKey.slice(-4)}` : "",
    source: secret?.apiKey ? "database" : envKey ? "env" : "none",
  };
}

export function saveSettings(data: {
  provider?: ResolvedSettings["provider"];
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  clearApiKey?: boolean;
}): ResolvedSettings {
  const db = getDb();
  const current = getSettings();
  const provider = data.provider ?? current.provider;
  db.insert(appSettings)
    .values({
      id: "default",
      provider,
      model: data.model ?? current.model,
      baseUrl: data.baseUrl ?? current.baseUrl,
      updatedAt: nowIso(),
    })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: {
        provider,
        model: data.model ?? current.model,
        baseUrl: data.baseUrl ?? current.baseUrl,
        updatedAt: nowIso(),
      },
    })
    .run();

  if (data.clearApiKey) {
    db.delete(secrets).where(eq(secrets.provider, provider)).run();
  } else if (data.apiKey) {
    db.insert(secrets)
      .values({ id: provider, provider, apiKey: data.apiKey, updatedAt: nowIso() })
      .onConflictDoUpdate({
        target: secrets.id,
        set: { apiKey: data.apiKey, updatedAt: nowIso() },
      })
      .run();
  }
  return getSettings();
}

export function getApiKey(provider: ResolvedSettings["provider"]): string {
  const secret = getDb().select().from(secrets).where(eq(secrets.provider, provider)).get();
  if (secret?.apiKey) return secret.apiKey;
  if (provider === "openai") return process.env.OPENAI_API_KEY || "";
  if (provider === "anthropic") return process.env.ANTHROPIC_API_KEY || "";
  if (provider === "openrouter") return process.env.OPENROUTER_API_KEY || "";
  return "";
}
