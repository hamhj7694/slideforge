import { expect, test } from "@playwright/test";
import {
  createQaProject,
  editorUrl,
  getSlide,
  uniqueTitle,
  waitForCanvas,
} from "./helpers/api";

test.describe("E. visualOverrides stay separate from content", () => {
  test("numeric node-panel inputs move an element without changing text", async ({
    page,
    request,
  }) => {
    const project = await createQaProject(request, {
      title: uniqueTitle("QA 배치 분리"),
      pageCount: 3,
    });

    await page.goto(editorUrl(project.id));
    const slideId = await waitForCanvas(page, project.id);
    const before = (await getSlide(request, project.id, slideId)).slide;

    await page.getByRole("button", { name: "노드" }).click();
    await expect(page.getByTestId("node-list")).toBeVisible();
    await page.getByTestId("node-list").getByRole("button", { name: /^title/ }).click();

    const xInput = page.locator("label").filter({ hasText: /^x$/ }).locator('input[type="number"]');
    const yInput = page.locator("label").filter({ hasText: /^y$/ }).locator('input[type="number"]');
    await expect(xInput).toBeVisible();
    await expect(yInput).toBeVisible();
    await xInput.fill("24");
    await yInput.fill("-16");
    await page.getByTestId("node-list").getByRole("button", { name: /^title/ }).click();

    await expect
      .poll(
        async () => {
          const overrides = (await getSlide(request, project.id, slideId)).slide.visualOverrides;
          return overrides.title ?? {};
        },
        { timeout: 10_000 },
      )
      .toMatchObject({ x: 24, y: -16 });

    const after = (await getSlide(request, project.id, slideId)).slide;
    expect(after.content).toEqual(before.content);
    expect(after.visualOverrides.title).toMatchObject({ x: 24, y: -16 });
    expect(Object.keys(after.content)).not.toContain("visualOverrides");

    await page.reload();
    expect(await waitForCanvas(page, project.id)).toBe(slideId);
    expect((await getSlide(request, project.id, slideId)).slide.visualOverrides.title).toMatchObject({
      x: 24,
      y: -16,
    });
  });
});
