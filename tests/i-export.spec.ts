import { expect, test } from "@playwright/test";
import { apiGet, createQaProject, type ExportEnvelope } from "./helpers/api";

test.describe("I. Export PDF and PPTX", () => {
  test.beforeEach(() => {
    // Exports launch a headless browser and screenshot every slide.
    test.setTimeout(180_000);
  });

  test("12-page project exports a streamable PDF and a .pptx file", async ({ request }) => {
    const project = await createQaProject(request, {
      title: "QA 12-page export fixture",
      pageCount: 12,
    });

    const pdf = await apiGet<ExportEnvelope>(
      request,
      `/api/projects/${project.id}/export?format=pdf`,
    );
    expect(pdf.export.pages).toBe(12);
    expect(pdf.export.url).toMatch(/^\/api\/exports\/slideforge-.*\.pdf$/);

    const pdfStream = await request.get(pdf.export.url);
    expect(pdfStream.ok()).toBeTruthy();
    expect(pdfStream.headers()["content-type"]).toContain("application/pdf");
    const pdfBytes = await pdfStream.body();
    expect(pdfBytes.subarray(0, 4).toString("latin1")).toBe("%PDF");

    const pptx = await apiGet<ExportEnvelope>(
      request,
      `/api/projects/${project.id}/export?format=pptx`,
    );
    expect(pptx.export.url).toMatch(/\.pptx$/);
    expect(pptx.export.pages).toBe(12);

    const pptxStream = await request.get(pptx.export.url);
    expect(pptxStream.ok()).toBeTruthy();
    expect(pptxStream.headers()["content-type"]).toContain(
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    );
    const pptxBytes = await pptxStream.body();
    expect(pptxBytes.subarray(0, 2).toString("latin1")).toBe("PK");
  });
});
