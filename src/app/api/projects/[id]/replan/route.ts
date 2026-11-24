import { planProject } from "@/lib/ai";
import { handle, ok } from "@/lib/api";
import { getProjectWithSlides } from "@/lib/repo";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

/** Proposes a new outline without mutating the project; the user reviews it before saving. */
export async function POST(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const project = getProjectWithSlides(id);
    if (!project) throw new Error("프로젝트를 찾을 수 없습니다.");
    const plan = await planProject(
      {
        title: project.title,
        masterPrompt: project.masterPrompt,
        purpose: project.purpose,
        audience: project.audience,
        tone: project.tone,
        pageCount: project.brief.outline.length,
        preset: project.designSystem.preset,
        sources: project.sources.map((source) => ({
          label: source.title,
          content: source.extractedContent,
        })),
      },
      { projectId: id, operation: "project.replan" },
    );
    return ok({
      brief: plan.data.brief,
      preset: plan.data.preset,
      generation: {
        provider: plan.provider,
        model: plan.model,
        notice: plan.notice,
        usage: plan.usage,
      },
    });
  } catch (error) {
    return handle(error);
  }
}
