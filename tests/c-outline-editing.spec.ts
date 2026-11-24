import { expect, test } from "@playwright/test";
import { createQaProject, getProject, getVersions, outlineUrl, uniqueTitle } from "./helpers/api";

test.describe("C. Outline editing persists and snapshots", () => {
  test("rename + reorder survives reload and creates a version snapshot", async ({ page, request }) => {
    const project = await createQaProject(request, {
      title: uniqueTitle("QA 목차 편집"),
      pageCount: 5,
    });
    const originalFirstTitle = project.brief.outline[0].title;
    const renamed = "QA renamed page — persisted";

    await page.goto(outlineUrl(project.id));
    const rows = page.getByTestId("outline-row");
    await expect(rows).toHaveCount(5);

    await rows.nth(1).getByRole("textbox", { name: "2페이지 제목" }).fill(renamed);
    await rows.nth(1).getByRole("button", { name: "위로" }).click();

    await page.getByTestId("save-outline").click();
    await expect(page.getByTestId("outline-notice")).toContainText("저장했습니다");

    await page.reload();
    await expect(rows).toHaveCount(5);
    await expect(rows.nth(0).getByRole("textbox", { name: "1페이지 제목" })).toHaveValue(renamed);
    await expect(rows.nth(1).getByRole("textbox", { name: "2페이지 제목" })).toHaveValue(
      originalFirstTitle,
    );

    const { project: saved } = await getProject(request, project.id);
    expect(saved.brief.outline[0].title).toBe(renamed);
    expect(saved.brief.outline[1].title).toBe(originalFirstTitle);
    expect(saved.slides[0].title).toBe(renamed);

    const { versions } = await getVersions(request, project.id);
    // The outline page always sends designPreset, so the route labels the
    // snapshot "목차·디자인 변경 이전"; accept the plain label too.
    expect(versions.some((version) => /^목차(·디자인)? 변경 이전$/.test(version.label))).toBe(true);
  });
});
