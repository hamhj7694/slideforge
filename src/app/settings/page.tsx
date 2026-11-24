"use client";

import { useEffect, useState } from "react";
import type { JSX } from "react";
import { AlertCircle, Check, KeyRound, ShieldCheck } from "lucide-react";
import { api, apiPatch } from "@/lib/client";
import type { UsageEntry } from "@/lib/types";

interface SettingsData {
  provider: "local" | "openai" | "anthropic" | "openrouter";
  model: string;
  baseUrl: string;
  hasKey: boolean;
  maskedKey: string;
  source: "env" | "database" | "none";
}

interface UsageSummary {
  totalCalls: number;
  totalCostUsd: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  recent: UsageEntry[];
}

const MODELS: Record<string, { value: string; label: string }[]> = {
  local: [{ value: "local-draft-v1", label: "로컬 결정론적 엔진 (키 불필요)" }],
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

export default function SettingsPage(): JSX.Element {
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [clearKey, setClearKey] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await api<{ settings: SettingsData; usage: UsageSummary }>("/api/settings");
      setSettings(data.settings);
      setUsage(data.usage);
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(patch: Partial<SettingsData> & { apiKey?: string; clearApiKey?: boolean }) {
    if (!settings) return;
    setBusy(true);
    try {
      const data = await apiPatch<{ settings: SettingsData; notice?: string }>(
        "/api/settings",
        patch,
      );
      setSettings(data.settings);
      setNotice(
        data.notice ??
          (patch.clearApiKey
            ? "저장된 API 키를 삭제했습니다. 이제 로컬 엔진을 사용합니다."
            : "설정을 저장했습니다."),
      );
      setApiKey("");
      setClearKey(false);
      void load();
    } catch (error) {
      setNotice(`저장 실패: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  if (!settings) {
    return <div className="mx-auto max-w-4xl px-5 py-20 text-center text-[13px] text-muted">설정을 불러오는 중…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-5 pb-20 pt-10">
      <h1 className="sf-section-title">모델 · 설정</h1>
      <p className="sf-muted mt-1">
        API 키는 서버의 SQLite에만 저장되고 UI에는 마스킹된 일부만 표시됩니다. 키가 없거나 선택한
        모델에 키가 없으면 로컬 생성 엔진으로 자동 전환됩니다.
      </p>
      {notice && (
        <p className="mt-4 rounded-md border border-line bg-white px-3 py-2 text-[12px] text-muted">
          {notice}
        </p>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-5">
          <section className="sf-card p-5">
            <h2 className="mb-4 font-display text-xl tracking-tight">생성 제공자</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="sf-label">제공자</label>
                <select
                  className="sf-input"
                  value={settings.provider}
                  onChange={(event) => {
                    const provider = event.target.value as SettingsData["provider"];
                    void save({ provider, model: MODELS[provider][0].value });
                  }}
                >
                  <option value="local">로컬 생성 (키 불필요)</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="openrouter">OpenRouter</option>
                </select>
              </div>
              <div>
                <label className="sf-label">모델</label>
                <select
                  className="sf-input"
                  value={settings.model}
                  onChange={(event) => void save({ model: event.target.value })}
                >
                  {(MODELS[settings.provider] ?? []).map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                  {!(MODELS[settings.provider] ?? []).some((m) => m.value === settings.model) && (
                    <option value={settings.model}>{settings.model}</option>
                  )}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="sf-label">Base URL (선택 · OpenAI 호환 게이트웨이)</label>
                <input
                  className="sf-input"
                  value={settings.baseUrl}
                  onChange={(event) => setSettings({ ...settings, baseUrl: event.target.value })}
                  onBlur={(event) => void save({ baseUrl: event.target.value })}
                  placeholder="https://api.example.com/v1"
                />
              </div>
            </div>
          </section>

          <section className="sf-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <KeyRound size={17} className="text-accent" />
              <h2 className="font-display text-xl tracking-tight">API 키</h2>
            </div>
            <div
              className={`mb-4 flex items-start gap-2 rounded-md border px-3 py-2 text-[12px] ${
                settings.hasKey
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {settings.hasKey ? <Check size={14} className="mt-0.5" /> : <AlertCircle size={14} className="mt-0.5" />}
              <div>
                <p className="font-semibold">
                  {settings.hasKey
                    ? `${settings.provider} 키 연결됨 · ${settings.maskedKey} · ${settings.source === "env" ? "환경변수" : "DB 저장"}`
                    : "API 키가 없습니다 — 로컬 생성 엔진으로 동작합니다."}
                </p>
                <p className="mt-0.5 opacity-80">
                  선택한 제공자에 키가 없으면 요청 시 로컬로 폴백하고 화면에 알림을 표시합니다.
                </p>
              </div>
            </div>
            <label className="sf-label">
              새 키 입력 ({settings.provider} · 입력 내용은 다시 표시되지 않습니다)
            </label>
            <div className="flex gap-2">
              <input
                data-testid="api-key-input"
                type="password"
                className="sf-input"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="sk-... 또는 선택한 제공자의 키"
                autoComplete="off"
              />
              <button
                data-testid="save-api-key"
                className="sf-btn sf-btn-primary shrink-0"
                disabled={!apiKey.trim() || busy}
                onClick={() => void save({ apiKey })}
              >
                저장
              </button>
            </div>
            <label className="mt-3 flex items-center gap-2 text-[12px] text-muted">
              <input
                type="checkbox"
                checked={clearKey}
                onChange={(event) => setClearKey(event.target.checked)}
              />
              저장된 키 삭제 (확인 후 적용)
            </label>
            <button
              className="sf-btn sf-btn-sm mt-2"
              disabled={!clearKey || busy}
              onClick={() => void save({ clearApiKey: true })}
            >
              키 삭제 확인
            </button>
          </section>

          <section className="sf-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-600" />
              <h2 className="font-display text-lg tracking-tight">보안 원칙</h2>
            </div>
            <ul className="sf-muted space-y-1.5 text-[12px]">
              <li>• 키는 서버 SQLite secrets 테이블에만 저장되며 응답에서는 마스킹됩니다.</li>
              <li>• 자료 원문(채용공고·문서·URL)은 명령이 아닌 데이터로만 취급합니다.</li>
              <li>• URL 가져오기는 SSRF 방지 DNS 검사와 응답 크기 제한을 적용합니다.</li>
              <li>• AI가 생성한 임의의 JavaScript는 실행하지 않습니다.</li>
              <li>• 파일 업로드는 확장자·MIME·크기(최대 20MB)를 검사합니다.</li>
            </ul>
          </section>
        </div>

        <aside className="sf-card h-fit p-5">
          <h2 className="font-display text-lg tracking-tight">사용량</h2>
          {usage ? (
            <>
              <dl className="mt-3 space-y-2 text-[12px]">
                <div className="flex justify-between">
                  <dt className="text-muted">총 호출</dt>
                  <dd className="font-mono">{usage.totalCalls}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">입력 토큰</dt>
                  <dd className="font-mono">{usage.totalInputTokens.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">출력 토큰</dt>
                  <dd className="font-mono">{usage.totalOutputTokens.toLocaleString()}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">예상 비용</dt>
                  <dd className="font-mono">${usage.totalCostUsd.toFixed(4)}</dd>
                </div>
              </dl>
              <div className="sf-divider my-4" />
              <p className="sf-label">최근 호출</p>
              <ul className="space-y-1.5">
                {usage.recent.slice(0, 6).map((entry) => (
                  <li key={entry.id} className="text-[10px] leading-relaxed text-muted">
                    <span className="font-mono text-ink">{entry.operation}</span>
                    <br />
                    {entry.provider} / {entry.model} · {new Date(entry.createdAt).toLocaleString("ko-KR")}
                  </li>
                ))}
                {!usage.recent.length && <li className="sf-muted">아직 기록이 없습니다.</li>}
              </ul>
            </>
          ) : (
            <p className="sf-muted mt-3">불러오는 중…</p>
          )}
        </aside>
      </div>
    </div>
  );
}
