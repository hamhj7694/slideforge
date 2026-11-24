import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  forceLocalProvider,
  getProject,
  getSettings,
  outlineUrl,
  type SettingsView,
} from "./helpers/api";

test.describe("A. Local-first creation", () => {
  let originalSettings: SettingsView | undefined;

  test.beforeAll(async ({ request }: { request: APIRequestContext }) => {
    originalSettings = (await getSettings(request)).settings;
  });

  test.beforeEach(async ({ request }: { request: APIRequestContext }) => {
    await forceLocalProvider(request);
  });

  test.afterAll(async ({ request }: { request: APIRequestContext }) => {
    if (!originalSettings) return;
    await request.patch("/api/settings", {
      data: {
        provider: originalSettings.provider,
        model: originalSettings.model,
        baseUrl: originalSettings.baseUrl,
      },
    });
  });

  test("creates a 12-page project from the UI with no API key", async ({ page, request }) => {
    await page.goto("/");

    // The homepage explicitly advertises the keyless local engine.
    await expect(
      page.getByText("API 키가 없어도 로컬 엔진으로 전체 구성 초안을 만들 수 있습니다."),
    ).toBeVisible();
    await expect(page.getByText("로컬 폴백")).toBeVisible();
    expect((await getSettings(request)).settings.hasKey).toBe(false);

    await page.getByTestId("master-prompt").fill(
      "QA 로컬 우선 생성 검증용 프롬프트입니다. 열두 페이지 구성과 스타일 선택을 확인합니다.",
    );
    await page.getByTestId("page-count").fill("12");
    await page.getByTestId("style-swiss-editorial").click();

    await page.getByTestId("create-project").click();

    await expect(page).toHaveURL(/\/projects\/prj_[^/]+\/outline/);
    const projectId = page.url().match(/projects\/(prj_[^/]+)\/outline/)?.[1] ?? "";
    expect(projectId).not.toBe("");

    await expect(page.getByTestId("outline-list")).toBeVisible();
    await expect(page.getByTestId("outline-row")).toHaveCount(12);

    const { project } = await getProject(request, projectId);
    expect(project.slides).toHaveLength(12);
    expect(project.designSystem.preset).toBe("swiss-editorial");
    expect(project.brief.outline).toHaveLength(12);
    expect(project.status).toBe("draft");
  });
});
