import { expect, test } from "@playwright/test";
import {
  createQaProject,
  editorUrl,
  getProject,
  getVersions,
  uniqueTitle,
  waitForCanvas,
} from "./helpers/api";

test.describe("F. Design change at any stage", () => {
  test("switches preset, snapshots the previous design and restores it", async ({ page, request }) => {
    const project = await createQaProject(request, {
      title: uniqueTitle("QA 디자인 변경"),
      pageCount: 3,
      preset: "modern-editorial",
    });

    await page.goto(editorUrl(project.id));
    const slideId = await waitForCanvas(page, project.id);

    await page.getByLabel("디자인 스타일").selectOption("neo-brutalism");

    await expect
      .poll(async () => (await getProject(request, project.id)).project.designSystem.preset, {
        timeout: 10_000,
      })
      .toBe("neo-brutalism");
    await expect(
      page.locator(`.slide-canvas[data-slide-id="${slideId}"]`),
    ).toHaveAttribute("data-preset", "neo-brutalism");

    const { versions } = await getVersions(request, project.id);
    const designSnapshot = versions.find((version) => version.label === "디자인 변경 이전");
    expect(designSnapshot, "design change must create a snapshot").toBeTruthy();

    await request.post(`/api/projects/${project.id}/versions/${designSnapshot!.id}/restore`, {
      data: {},
    });

    await expect
      .poll(async () => (await getProject(request, project.id)).project.designSystem.preset, {
        timeout: 10_000,
      })
      .toBe("modern-editorial");
  });
});
