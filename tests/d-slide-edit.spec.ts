import { expect, test } from "@playwright/test";
import {
  createQaProject,
  editorUrl,
  forceLocalProvider,
  getSlide,
  uniqueTitle,
  waitForCanvas,
} from "./helpers/api";

test.describe("D. Slide generation and text editing", () => {
  test.beforeEach(async ({ request }) => {
    await forceLocalProvider(request);
  });

  test("edits content.title only and leaves visualOverrides empty", async ({ page, request }) => {
    const project = await createQaProject(request, {
      title: uniqueTitle("QA 슬라이드 편집"),
      pageCount: 3,
    });

    await page.goto(editorUrl(project.id));
    const slideId = await waitForCanvas(page, project.id);

    await page.getByTestId("generate-slide").click();
    await expect
      .poll(async () => (await getSlide(request, project.id, slideId)).slide.status, {
        timeout: 20_000,
      })
      .toBe("generated");

    const generated = (await getSlide(request, project.id, slideId)).slide;
    expect(generated.visualOverrides).toEqual({});

    const titleNode = page.locator(`.slide-canvas[data-slide-id="${slideId}"] [data-el="title"]`).first();
    await expect(titleNode).toBeVisible();
    const editedTitle = "QA edited title — persisted in content.title";
    await titleNode.fill(editedTitle);
    // Blur through a non-editable control so onBlur commits the text change.
    await page.getByRole("button", { name: "버전" }).click();

    await expect
      .poll(async () => (await getSlide(request, project.id, slideId)).slide.content.title, {
        timeout: 10_000,
      })
      .toBe(editedTitle);

    await page.reload();
    expect(await waitForCanvas(page, project.id)).toBe(slideId);
    const reloaded = (await getSlide(request, project.id, slideId)).slide;

    expect(reloaded.content.title).toBe(editedTitle);
    expect({ ...reloaded.content, title: generated.content.title }).toEqual(generated.content);
    expect(reloaded.visualOverrides).toEqual({});
    await expect(
      page.locator(`.slide-canvas[data-slide-id="${slideId}"] [data-el="title"]`).first(),
    ).toHaveText(editedTitle);
  });
});
