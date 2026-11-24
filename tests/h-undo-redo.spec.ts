import { expect, test } from "@playwright/test";
import {
  createQaProject,
  editorUrl,
  forceLocalProvider,
  getSlide,
  uniqueTitle,
  waitForCanvas,
} from "./helpers/api";

test.describe("H. Undo / redo keyboard shortcuts", () => {
  test.beforeEach(async ({ request }) => {
    await forceLocalProvider(request);
  });

  /**
   * Autosave is debounced (450ms) and the canvas text node is keyed by its value,
   * so this test deliberately polls the API after each keyboard action instead
   * of asserting immediately. Keep it active: the debounce is expected, not flake.
   */
  test("Ctrl+Z reverts and Ctrl+Shift+Z reapplies the last two text edits", async ({
    page,
    request,
  }) => {
    const project = await createQaProject(request, {
      title: uniqueTitle("QA 실행취소"),
      pageCount: 3,
    });

    await page.goto(editorUrl(project.id));
    const slideId = await waitForCanvas(page, project.id);
    const titleNode = page.locator(`.slide-canvas[data-slide-id="${slideId}"] [data-el="title"]`).first();
    await expect(titleNode).toBeVisible();

    const first = "QA undo-redo first edit";
    const second = "QA undo-redo second edit";

    await titleNode.fill(first);
    await page.getByRole("button", { name: "버전" }).click();
    await expect
      .poll(async () => (await getSlide(request, project.id, slideId)).slide.content.title, {
        timeout: 10_000,
      })
      .toBe(first);

    await titleNode.fill(second);
    await page.getByRole("button", { name: "버전" }).click();
    await expect
      .poll(async () => (await getSlide(request, project.id, slideId)).slide.content.title, {
        timeout: 10_000,
      })
      .toBe(second);

    // The shortcut handler intentionally ignores contentEditable/input targets,
    // so focus a button before pressing the shortcuts.
    await page.getByRole("button", { name: "버전" }).click();
    await page.keyboard.press("Control+z");
    await expect
      .poll(async () => (await getSlide(request, project.id, slideId)).slide.content.title, {
        timeout: 10_000,
      })
      .toBe(first);
    await expect(titleNode).toHaveText(first);

    await page.keyboard.press("Control+Shift+Z");
    await expect
      .poll(async () => (await getSlide(request, project.id, slideId)).slide.content.title, {
        timeout: 10_000,
      })
      .toBe(second);
    await expect(titleNode).toHaveText(second);
  });
});
