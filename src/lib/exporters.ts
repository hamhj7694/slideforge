import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";

import { chromium, type Browser, type Page } from "playwright-core";
import pptxgen from "pptxgenjs";

import { dataDir } from "./db";
import { getProjectWithSlides, recordExport } from "./repo";

export interface ExportResult {
  path: string;
  filename: string;
  pages: number;
  url: string;
}

const VIEWPORT = { width: 1280, height: 720 } as const;
const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];

export function findChrome(): string | null {
  const candidates = [
    process.env.CHROME_PATH,
    ...CHROME_CANDIDATES,
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  try {
    const bundled = chromium.executablePath();
    if (bundled && fs.existsSync(bundled)) return bundled;
  } catch {
    // No bundled browser is installed; caller reports a clear error.
  }
  return null;
}

function printUrl(projectId: string): string {
  const base = (process.env.APP_URL || "http://localhost:3070").replace(/\/+$/, "");
  return `${base}/print/${encodeURIComponent(projectId)}?clean=1`;
}

function requiredChrome(): string {
  const executablePath = findChrome();
  if (!executablePath) {
    throw new Error(
      "Chrome/Chromium 실행 파일을 찾을 수 없습니다. CHROME_PATH 환경 변수를 설정해 주세요.",
    );
  }
  return executablePath;
}

async function launchBrowser() {
  return chromium.launch({
    executablePath: requiredChrome(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
}

async function openPrintPage(
  browser: Browser,
  projectId: string,
  deviceScaleFactor: number,
): Promise<Page> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor,
  });
  const page = await context.newPage();
  await page.goto(printUrl(projectId), {
    waitUntil: "networkidle",
    timeout: 60_000,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForSelector('[data-slide-ready="true"]', { timeout: 30_000 });
  return page;
}

async function warnOnOverflow(page: Page): Promise<void> {
  const offenders = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>(".slide-canvas"))
      .map((element, index) => ({
        slide:
          element.closest("[data-slide-id]")?.getAttribute("data-slide-id") ??
          String(index + 1),
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      }))
      .filter(
        (item) =>
          item.scrollWidth > item.clientWidth + 2 ||
          item.scrollHeight > item.clientHeight + 2,
      ),
  );
  if (offenders.length) {
    console.warn(
      `[SlideForge] 슬라이드 오버플로가 감지되었습니다 (내보내기는 계속 진행): ${JSON.stringify(offenders)}`,
    );
  }
}

export async function exportPdf(projectId: string): Promise<ExportResult> {
  const project = getProjectWithSlides(projectId);
  if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");

  const exportDir = path.join(dataDir(), "exports");
  await fsp.mkdir(exportDir, { recursive: true });
  const filename = `slideforge-${projectId}-${Date.now()}.pdf`;
  const outputPath = path.join(exportDir, filename);

  const browser = await launchBrowser();
  try {
    const page = await openPrintPage(browser, projectId, 1);
    await warnOnOverflow(page);
    await page.pdf({
      path: outputPath,
      width: "1280px",
      height: "720px",
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      preferCSSPageSize: false,
    });

    const bytes = await fsp.readFile(outputPath);
    const counted = (bytes.toString("latin1").match(/\/Type\s*\/Page\b/g) ?? [])
      .length;
    const pages = counted || project.slides.length || 1;
    const relativePath = `exports/${filename}`;
    recordExport({ projectId, format: "pdf", filename, path: relativePath, pages });
    return { path: relativePath, filename, pages, url: `/api/exports/${filename}` };
  } finally {
    await browser.close();
  }
}

export async function exportPptx(projectId: string): Promise<ExportResult> {
  const project = getProjectWithSlides(projectId);
  if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");

  const exportDir = path.join(dataDir(), "exports");
  await fsp.mkdir(exportDir, { recursive: true });
  const timestamp = Date.now();
  const filename = `slideforge-${projectId}-${timestamp}.pptx`;
  const outputPath = path.join(exportDir, filename);
  const tempPngs: string[] = [];

  const browser = await launchBrowser();
  try {
    const page = await openPrintPage(browser, projectId, 2);
    const elements = await page.locator("[data-slide-id]").elementHandles();
    if (!elements.length) {
      throw new Error("인쇄 페이지에서 슬라이드를 찾을 수 없습니다.");
    }

    const pptx = new pptxgen();
    pptx.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 inches
    for (let index = 0; index < elements.length; index += 1) {
      const pngPath = path.join(
        exportDir,
        `slideforge-${projectId}-${timestamp}-${index + 1}.png`,
      );
      tempPngs.push(pngPath);
      await elements[index].screenshot({ path: pngPath, animations: "disabled" });
      const slide = pptx.addSlide();
      slide.addImage({
        // pptxgenjs accepts a Buffer at runtime despite its string-typed declaration.
        data: fs.readFileSync(pngPath) as unknown as string,
        x: 0,
        y: 0,
        w: 13.333,
        h: 7.5,
      });
    }

    await pptx.writeFile({ fileName: outputPath });
    const pages = elements.length || project.slides.length;
    const relativePath = `exports/${filename}`;
    recordExport({ projectId, format: "pptx", filename, path: relativePath, pages });
    return { path: relativePath, filename, pages, url: `/api/exports/${filename}` };
  } finally {
    await Promise.all(
      tempPngs.map((file) => fsp.unlink(file).catch(() => undefined)),
    );
    await browser.close();
  }
}
