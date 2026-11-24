import { expect, test } from "@playwright/test";
import { createQaProject, editorUrl, getProject, outlineUrl, uniqueTitle } from "./helpers/api";

const SAMPLE_JOB_TITLE = "[QA SAMPLE · 개발용 예시] 공카 AI 마케터 채용공고 (가상)";

// Explicitly sample-labelled so it can never be mistaken for a real posting.
const SAMPLE_JOB_TEXT = [
  "[QA SAMPLE].This is a fictional job posting created only for automated QA.",
  "Role: AI 마케터. The team works with 데이터 analysis, 콘텐츠 planning, 영상 production,",
  "automation (자동화) and basic 개발 support. You will join 기획 meetings, collaborate with",
  "협업 partners, ship a 프로젝트 and report 성과 with clear metrics.",
  "No real company, applicant, deadline or factual claim is represented here.",
].join("\n");

test.describe("B. Job posting as its own source type", () => {
  test("keeps the sample posting as job-posting and maps its requirements in the outline", async ({
    page,
    request,
  }) => {
    const project = await createQaProject(request, {
      title: uniqueTitle("QA 공고 자료"),
      pageCount: 6,
      sources: [
        {
          label: SAMPLE_JOB_TITLE,
          kind: "job-posting",
          text: SAMPLE_JOB_TEXT,
          metadata: { note: "QA 전용 가상 공고" },
        },
      ],
    });

    const persisted = (await getProject(request, project.id)).project;
    expect(persisted.sources).toHaveLength(1);
    expect(persisted.sources[0].type).toBe("job-posting");
    expect(persisted.sources[0].title).toBe(SAMPLE_JOB_TITLE);
    expect(persisted.sources[0].originalContent).toBe(SAMPLE_JOB_TEXT);
    expect(persisted.sources[0].extractedContent).toContain("AI 마케터");

    await page.goto(outlineUrl(project.id));

    const mapping = page.locator("section").filter({ hasText: "공고 요구사항 매핑" }).first();
    await expect(mapping).toBeVisible();
    await expect(mapping.getByText(SAMPLE_JOB_TITLE)).toBeVisible();
    await expect(
      mapping.getByText(`원문 ${SAMPLE_JOB_TEXT.length.toLocaleString()}자 보존`, { exact: false }),
    ).toBeVisible();
    await expect(mapping.getByText("AI 마케터")).toBeVisible();
    await expect(mapping.getByText("데이터")).toBeVisible();
    await expect(mapping.getByText("콘텐츠")).toBeVisible();

    // The editor source panel labels this source type as "공고", not a generic file.
    await page.goto(editorUrl(project.id));
    await page.getByRole("button", { name: "자료" }).click();
    const sourceList = page.getByTestId("source-list");
    await expect(sourceList).toContainText(SAMPLE_JOB_TITLE);
    await expect(sourceList).toContainText("공고");
    await sourceList.getByRole("button", { name: /원문 보기/ }).first().click();
    await expect(sourceList).toContainText("[QA SAMPLE]");
  });
});
