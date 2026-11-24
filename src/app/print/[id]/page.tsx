import type { JSX } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SlideRenderer } from "@/components/slides/SlideRenderer";
import { getProjectWithSlides } from "@/lib/repo";
import type { DesignSystem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ clean?: string }>;
};

export default async function PrintPage({ params, searchParams }: Params): Promise<JSX.Element> {
  const { id } = await params;
  const { clean } = await searchParams;
  const project = getProjectWithSlides(id);
  if (!project) notFound();

  const slides = [...project.slides].sort((a, b) => a.order - b.order);
  const isClean = clean === "1";

  return (
    <div>
      <style>{`
        @page { size: 1280px 720px; margin: 0; }
        @media screen { body { background: #d9d7d0 !important; } }
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
          .sf-topbar, .print-toolbar { display: none !important; }
          /* slides.css declares break-after:page on every canvas; the last one
             would otherwise produce a trailing blank page in Chromium PDF. */
          .print-sheet:last-child .slide-canvas {
            break-after: auto !important;
            page-break-after: auto !important;
          }
        }
      `}</style>

      {!isClean && (
        <div className="print-toolbar sticky top-14 z-30 flex items-center gap-3 border-b border-line bg-white/95 px-5 py-2 text-[12px] text-muted backdrop-blur">
          <Link href={`/projects/${id}/editor`} className="sf-btn sf-btn-sm">
            편집기로 돌아가기
          </Link>
          <span>
            인쇄 프리뷰 · {slides.length}페이지 · 1280×720 · PDF에서 텍스트 선택 가능
          </span>
          <span className="sf-chip ml-auto">브라우저에서 PDF 저장: Ctrl+P</span>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: isClean ? 0 : 24 }}>
        {slides.map((slide, index) => {
          const overrides = slide.designOverrides as Partial<DesignSystem>;
          const design: DesignSystem = {
            ...project.designSystem,
            ...overrides,
            palette: { ...project.designSystem.palette, ...(overrides.palette ?? {}) },
            typography: { ...project.designSystem.typography, ...(overrides.typography ?? {}) },
            grid: { ...project.designSystem.grid, ...(overrides.grid ?? {}) },
            shape: { ...project.designSystem.shape, ...(overrides.shape ?? {}) },
            image: { ...project.designSystem.image, ...(overrides.image ?? {}) },
            details: { ...project.designSystem.details, ...(overrides.details ?? {}) },
          };
          return (
            <div
              key={slide.id}
              className="print-sheet"
              style={{
                width: 1280,
                height: 720,
                flex: "0 0 auto",
                margin: 0,
                overflow: "hidden",
                boxShadow: isClean ? "none" : "0 12px 40px rgba(0,0,0,.18)",
              }}
            >
              <SlideRenderer slide={slide} design={design} index={index} total={slides.length} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
