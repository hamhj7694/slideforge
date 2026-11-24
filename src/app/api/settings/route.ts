import { body, handle, ok } from "@/lib/api";
import { getSettings, getUsageSummary, saveSettings } from "@/lib/repo";
import { settingsSchema } from "@/lib/schemas";

export const runtime = "nodejs";

export async function GET() {
  try {
    return ok({ settings: getSettings(), usage: getUsageSummary() });
  } catch (error) {
    return handle(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const input = await body(request, settingsSchema);
    const settings = saveSettings(input);
    return ok({
      settings,
      notice: settings.hasKey
        ? `${settings.provider} / ${settings.model} 설정이 저장되었습니다.`
        : "API 키가 없어 로컬 생성 엔진을 사용합니다. 설정에서 키를 입력하면 실제 모델로 전환됩니다.",
    });
  } catch (error) {
    return handle(error);
  }
}
