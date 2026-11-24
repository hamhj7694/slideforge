import { expect, type APIRequestContext, type APIResponse, type Page } from "@playwright/test";
import type { ProjectWithSlides, Slide } from "../../src/lib/types";

export interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
  detail?: unknown;
}

export interface ProjectEnvelope {
  project: ProjectWithSlides;
  generation?: { provider: string; model: string; notice?: string; usage?: unknown };
}

export interface SlideEnvelope {
  slide: Slide;
  generation?: { provider: string; model: string; notice?: string };
}

export interface VersionRow {
  id: string;
  projectId: string;
  slideId?: string;
  kind: string;
  label: string;
  snapshot: unknown;
  createdAt: string;
}

export interface SettingsView {
  provider: "local" | "openai" | "anthropic" | "openrouter";
  model: string;
  baseUrl: string;
  hasKey: boolean;
  maskedKey: string;
  source: "env" | "database" | "none";
}

export interface ExportEnvelope {
  export: { url: string; filename: string; pages: number };
}

let sequence = 0;
export function uniqueTitle(prefix = "QA"): string {
  sequence += 1;
  return `${prefix} ${Date.now()}-${sequence}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Unwraps the app's { ok, data } envelope while keeping the HTTP status available. */
type MultipartValue = string | number | boolean | { name: string; mimeType: string; buffer: Buffer };

export async function rawApi<T>(
  request: APIRequestContext,
  path: string,
  options: {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    data?: unknown;
    multipart?: Record<string, MultipartValue>;
  } = {},
): Promise<{ status: number; body: ApiEnvelope<T>; response: APIResponse }> {
  const method = options.method ?? "GET";
  const response = await request.fetch(path, {
    method,
    ...(options.data !== undefined ? { data: options.data } : {}),
    ...(options.multipart !== undefined ? { multipart: options.multipart } : {}),
  });
  const body = (await response.json()) as ApiEnvelope<T>;
  return { status: response.status(), body, response };
}

export async function apiGet<T>(request: APIRequestContext, path: string): Promise<T> {
  const { status, body } = await rawApi<T>(request, path);
  expect(status, `GET ${path} failed: ${body.error ?? "unknown error"}`).toBeLessThan(400);
  expect(body.ok, `GET ${path} returned ok=false: ${body.error ?? "unknown error"}`).toBe(true);
  return body.data as T;
}

export async function apiWrite<T>(
  request: APIRequestContext,
  path: string,
  method: "POST" | "PATCH" | "DELETE",
  data?: unknown,
  expectedStatus = 200,
): Promise<T> {
  const { status, body } = await rawApi<T>(request, path, { method, data });
  expect(status, `${method} ${path} failed: ${body.error ?? "unknown error"}`).toBe(expectedStatus);
  expect(body.ok, `${method} ${path} returned ok=false: ${body.error ?? "unknown error"}`).toBe(true);
  return body.data as T;
}

export interface CreateQaProjectOverrides {
  title?: string;
  masterPrompt?: string;
  pageCount?: number;
  preset?: string;
  sources?: Array<{
    label: string;
    kind: string;
    text?: string;
    url?: string;
    metadata?: Record<string, unknown>;
  }>;
}

/**
 * Creates an independent fixture project through the public API. The prompt is
 * deliberately free of numbered lines so buildLocalOutline honours pageCount.
 */
export async function createQaProject(
  request: APIRequestContext,
  overrides: CreateQaProjectOverrides = {},
): Promise<ProjectWithSlides> {
  const data = await apiWrite<ProjectEnvelope>(
    request,
    "/api/projects",
    "POST",
    {
      title: overrides.title ?? uniqueTitle("QA 프로젝트"),
      masterPrompt:
        overrides.masterPrompt ??
        "QA 검증용 샘플 프롬프트입니다. 실제 자료가 아니며 로컬 엔진으로 전체 구성을 만듭니다.",
      pageCount: overrides.pageCount ?? 5,
      preset: overrides.preset ?? "modern-editorial",
      forceProvider: "local",
      sources: overrides.sources ?? [],
    },
    201,
  );
  expect(data.project.slides.length).toBe(overrides.pageCount ?? 5);
  return data.project;
}

export function getProject(request: APIRequestContext, projectId: string): Promise<ProjectEnvelope> {
  return apiGet<ProjectEnvelope>(request, `/api/projects/${projectId}`);
}

export function getSlide(
  request: APIRequestContext,
  projectId: string,
  slideId: string,
): Promise<SlideEnvelope> {
  return apiGet<SlideEnvelope>(request, `/api/projects/${projectId}/slides/${slideId}`);
}

export function getVersions(request: APIRequestContext, projectId: string): Promise<{ versions: VersionRow[] }> {
  return apiGet<{ versions: VersionRow[] }>(request, `/api/projects/${projectId}/versions`);
}

export function getSettings(request: APIRequestContext): Promise<{ settings: SettingsView }> {
  return apiGet<{ settings: SettingsView }>(request, "/api/settings");
}

/** Forces local generation so no remote AI provider call or API key is needed. */
export async function forceLocalProvider(request: APIRequestContext): Promise<void> {
  await apiWrite<{ settings: SettingsView }>(request, "/api/settings", "PATCH", {
    provider: "local",
    model: "local-draft-v1",
  });
}

export function editorUrl(projectId: string): string {
  return `/projects/${projectId}/editor`;
}

export function outlineUrl(projectId: string): string {
  return `/projects/${projectId}/outline`;
}

/** Waits until the editor has mounted a rendered slide canvas. */
export async function waitForCanvas(page: Page, projectId: string): Promise<string> {
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/editor`));
  const canvas = page.locator(".slide-canvas[data-slide-ready='true']").first();
  await expect(canvas).toBeVisible();
  const slideId = await canvas.getAttribute("data-slide-id");
  expect(slideId, "slide canvas must expose data-slide-id").toBeTruthy();
  return slideId as string;
}
