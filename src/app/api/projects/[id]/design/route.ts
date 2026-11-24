import { proposeDesignSystem } from "@/lib/ai";
import { DETECTED_PRESET_FALLBACK } from "@/lib/ai/design-bridge";
import { body, handle, ok } from "@/lib/api";
import { resolveDesignSystem } from "@/lib/design";
import {
  getProjectWithSlides,
  snapshotProjectVersion,
  updateProject,
} from "@/lib/repo";
import { designUpdateSchema } from "@/lib/schemas";
import type { DesignSystem } from "@/lib/types";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

const HEX = /^#[0-9a-fA-F]{3,8}$/;

function safePalette(input: unknown): Partial<DesignSystem["palette"]> {
  if (!input || typeof input !== "object") return {};
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof value === "string" && HEX.test(value)) result[key] = value;
  }
  return result as Partial<DesignSystem["palette"]>;
}

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const input = await body(request, designUpdateSchema);
    const project = getProjectWithSlides(id);
    if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");

    snapshotProjectVersion(id, "디자인 변경 이전");

    const requested =
      input.preset ??
      (input.instruction
        ? DETECTED_PRESET_FALLBACK(input.instruction)
        : project.designSystem.preset);
    let design = resolveDesignSystem(project.designSystem, requested);

    if (input.overrides) {
      const palette = { ...design.palette };
      if (input.overrides.accent) palette.accent = input.overrides.accent;
      if (input.overrides.bg) palette.bg = input.overrides.bg;
      if (input.overrides.ink) palette.ink = input.overrides.ink;
      design = resolveDesignSystem({ ...design, palette }, design.preset);
      if (input.overrides.mode) design.mode = input.overrides.mode;
    }

    let notice: string | undefined;
    if (input.instruction) {
      const proposal = await proposeDesignSystem(
        {
          brief: project.brief,
          preset: requested,
          instruction: input.instruction,
          current: design,
        },
        { projectId: id, operation: "design.propose" },
      );
      notice = proposal.notice;
      const palette = safePalette(proposal.data.palette);
      if (Object.keys(palette).length) {
        design = resolveDesignSystem(
          { ...design, palette: { ...design.palette, ...palette } },
          design.preset,
        );
      }
    }

    updateProject(id, { designSystem: design });
    return ok({
      design,
      project: getProjectWithSlides(id),
      notice:
        notice ??
        (requested !== project.designSystem.preset
          ? `${design.name} 스타일을 적용했습니다. 이전 디자인은 버전에서 복원할 수 있습니다.`
          : undefined),
    });
  } catch (error) {
    return handle(error);
  }
}
