import { expect, test, type APIRequestContext } from "@playwright/test";
import {
  createQaProject,
  editorUrl,
  getProject,
  getVersions,
  uniqueTitle,
  waitForCanvas,
} from "./helpers/api";

async function expectDeleted(projectId: string, request: APIRequestContext): Promise<boolean> {
  const response = await request.get(`/api/projects/${projectId}`);
  const body = (await response.json()) as { data?: { project?: { id: string } | null } };
  return response.status() === 404 && (body.data?.project ?? null) === null;
}

async function expectRestored(projectId: string, request: APIRequestContext): Promise<boolean> {
  const response = await request.get(`/api/projects/${projectId}`);
  return response.status() === 200;
}

test.describe("G. Safe delete gating and restore", () => {
  test("requires exact text + consent, then soft-deletes project and restores pages", async ({
    page,
    request,
  }) => {
    const project = await createQaProject(request, {
      title: uniqueTitle("QA 안전 삭제"),
      pageCount: 4,
    });

    // --- Project delete dialog: gating and cancel -------------------------
    await page.goto("/projects");
    const card = page.getByTestId("project-card").filter({ hasText: project.title });
    await expect(card).toBeVisible();
    await card.getByTestId("delete-project").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const finalButton = dialog.getByTestId("delete-final");
    const confirmInput = dialog.getByTestId("delete-confirm-input");
    const consent = dialog.getByTestId("delete-consent");

    await expect(finalButton).toBeDisabled();
    await confirmInput.fill("삭제 ");
    await expect(finalButton).toBeDisabled();
    await confirmInput.fill("삭");
    await expect(finalButton).toBeDisabled();
    await confirmInput.fill("삭제");
    await expect(finalButton).toBeDisabled();
    await consent.check();
    await expect(finalButton).toBeEnabled();

    await dialog.getByRole("button", { name: "취소" }).click();
    await expect(dialog).toBeHidden();
    expect(await expectDeleted(project.id, request)).toBe(false);
    await expect(card).toBeVisible();

    // --- Page delete: snapshot then version restore -----------------------
    await page.goto(editorUrl(project.id));
    const slideId = await waitForCanvas(page, project.id);
    expect((await getProject(request, project.id)).project.slides).toHaveLength(4);

    await page.getByRole("button", { name: /현재 페이지 삭제/ }).click();
    const pageDialog = page.getByRole("dialog");
    await expect(pageDialog).toBeVisible();
    const pageFinal = pageDialog.getByTestId("delete-final");
    await expect(pageFinal).toBeDisabled();
    await pageDialog.getByTestId("delete-confirm-input").fill("삭제");
    await expect(pageFinal).toBeDisabled();
    await pageDialog.getByTestId("delete-consent").check();
    await expect(pageFinal).toBeEnabled();
    await pageFinal.click();

    await expect
      .poll(async () => (await getProject(request, project.id)).project.slides.length, {
        timeout: 10_000,
      })
      .toBe(3);

    const { versions } = await getVersions(request, project.id);
    const pageDeleteSnapshot = versions.find((version) =>
      version.label.startsWith("페이지 삭제 이전"),
    );
    expect(pageDeleteSnapshot, "page delete must create a version snapshot").toBeTruthy();
    await request.post(`/api/projects/${project.id}/versions/${pageDeleteSnapshot!.id}/restore`, {
      data: {},
    });
    await expect
      .poll(async () => (await getProject(request, project.id)).project.slides.length, {
        timeout: 10_000,
      })
      .toBe(4);
    expect(
      (await getProject(request, project.id)).project.slides.some((slide) => slide.id === slideId),
    ).toBe(true);

    // --- Project soft delete + restore endpoint ---------------------------
    await page.goto("/projects");
    const cardAgain = page.getByTestId("project-card").filter({ hasText: project.title });
    await cardAgain.getByTestId("delete-project").click();
    const finalDialog = page.getByRole("dialog");
    await finalDialog.getByTestId("delete-confirm-input").fill("삭제");
    await finalDialog.getByTestId("delete-consent").check();
    await finalDialog.getByTestId("delete-final").click();

    await expect.poll(() => expectDeleted(project.id, request), { timeout: 10_000 }).toBe(true);

    const deletedList = (await (await request.get("/api/projects?includeDeleted=1")).json()) as {
      data: { projects: Array<{ id: string }> };
    };
    expect(deletedList.data.projects.some((item) => item.id === project.id)).toBe(true);
    const liveList = (await (await request.get("/api/projects")).json()) as {
      data: { projects: Array<{ id: string }> };
    };
    expect(liveList.data.projects.some((item) => item.id === project.id)).toBe(false);

    await request.post(`/api/projects/${project.id}/restore`, { data: {} });
    await expect.poll(() => expectRestored(project.id, request), { timeout: 10_000 }).toBe(true);
    expect((await getProject(request, project.id)).project.id).toBe(project.id);
  });
});
