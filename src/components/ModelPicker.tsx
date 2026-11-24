"use client";

import { useEffect, useState } from "react";
import { api, apiPatch } from "@/lib/client";

export interface ModelSettings {
  provider: "local" | "openai" | "anthropic" | "openrouter";
  model: string;
  baseUrl: string;
  hasKey: boolean;
  maskedKey: string;
  source: "env" | "database" | "none";
}

const MODELS: Record<string, { value: string; label: string }[]> = {
  local: [{ value: "local-draft-v1", label: "로컬 기획 엔진 (키 불필요)" }],
  openai: [
    { value: "gpt-4o-mini", label: "gpt-4o-mini · 빠르고 저렴" },
    { value: "gpt-4.1-mini", label: "gpt-4.1-mini · 균형" },
    { value: "gpt-4o", label: "gpt-4o · 고품질" },
  ],
  anthropic: [
    { value: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku · 빠름" },
    { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5 · 고품질" },
  ],
  openrouter: [
    { value: "openai/gpt-4o-mini", label: "OpenRouter · gpt-4o-mini" },
    { value: "anthropic/claude-3.5-sonnet", label: "OpenRouter · Claude 3.5" },
  ],
};

export function ModelPicker({
  compact = false,
  onNotice,
}: {
  compact?: boolean;
  onNotice?: (message: string) => void;
}) {
  const [settings, setSettings] = useState<ModelSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<{ settings: ModelSettings }>("/api/settings")
      .then((data) => setSettings(data.settings))
      .catch(() => undefined);
  }, []);

  async function update(patch: Partial<ModelSettings>) {
    if (!settings) return;
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    try {
      const data = await apiPatch<{ settings: ModelSettings; notice?: string }>(
        "/api/settings",
        patch,
      );
      setSettings(data.settings);
      onNotice?.(data.notice ?? "모델 설정이 저장되었습니다.");
    } catch (error) {
      onNotice?.((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!settings) {
    return <div className="h-9 w-48 animate-pulse rounded-md bg-black/[0.05]" />;
  }

  return (
    <div className="flex items-center gap-2">
      <select
        aria-label="AI 제공자"
        className="h-9 rounded-md border border-line bg-white px-2 text-[12px] font-medium text-ink outline-none focus:border-ink/40"
        value={settings.provider}
        onChange={(event) => {
          const provider = event.target.value as ModelSettings["provider"];
          update({ provider, model: MODELS[provider]?.[0]?.value ?? "local-draft-v1" });
        }}
      >
        <option value="local">로컬 생성</option>
        <option value="openai">OpenAI</option>
        <option value="anthropic">Anthropic</option>
        <option value="openrouter">OpenRouter</option>
      </select>
      <select
        aria-label="AI 모델"
        className="h-9 max-w-[190px] rounded-md border border-line bg-white px-2 text-[12px] text-ink outline-none focus:border-ink/40"
        value={settings.model}
        onChange={(event) => update({ model: event.target.value })}
      >
        {(MODELS[settings.provider] ?? []).map((model) => (
          <option key={model.value} value={model.value}>
            {compact ? model.value : model.label}
          </option>
        ))}
        {!(MODELS[settings.provider] ?? []).some((m) => m.value === settings.model) && (
          <option value={settings.model}>{settings.model}</option>
        )}
      </select>
      <span
        title={settings.hasKey ? `키: ${settings.maskedKey} (${settings.source})` : "API 키 없음"}
        className={`flex items-center gap-1 text-[11px] ${settings.hasKey ? "text-emerald-700" : "text-muted"}`}
      >
        <span
          className={`h-1.5 w-1.5 rounded-full ${settings.hasKey ? "bg-emerald-500" : "bg-amber-400"}`}
        />
        {saving ? "저장 중" : settings.hasKey ? "키 연결됨" : "로컬 폴백"}
      </span>
    </div>
  );
}
