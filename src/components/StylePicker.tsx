"use client";

import { presetOptions } from "@/lib/ai/design-bridge";
import type { DesignPresetId } from "@/lib/types";

const OPTIONS = presetOptions();
const CORE = OPTIONS.slice(0, 7);
const EXTENDED = OPTIONS.slice(7);

function Swatch({
  id,
  name,
  accent,
  bg,
  active,
  onClick,
}: {
  id: DesignPresetId;
  name: string;
  accent: string;
  bg: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-testid={`style-${id}`}
      onClick={onClick}
      className={`group flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-all ${
        active
          ? "border-ink bg-white shadow-sm ring-1 ring-ink"
          : "border-line bg-white/60 hover:border-ink/30 hover:bg-white"
      }`}
    >
      <span
        className="relative flex h-8 w-11 shrink-0 overflow-hidden rounded-[4px] border border-black/10"
        style={{ background: bg }}
      >
        <span className="absolute bottom-1 left-1 h-1.5 w-6 rounded-full" style={{ background: accent }} />
        <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-black/10" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-semibold text-ink">{name}</span>
        <span className="block truncate font-mono text-[9px] text-muted">{id}</span>
      </span>
    </button>
  );
}

export function StylePicker({
  value,
  onChange,
  compact = false,
}: {
  value: DesignPresetId;
  onChange: (preset: DesignPresetId) => void;
  compact?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="sf-label">큐레이션 스타일</p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {CORE.map((option) => (
            <Swatch
              key={option.id}
              {...option}
              active={value === option.id}
              onClick={() => onChange(option.id)}
            />
          ))}
        </div>
      </div>
      {!compact && (
        <div>
          <p className="sf-label">확장 스타일 · 20종</p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {EXTENDED.map((option) => (
              <Swatch
                key={option.id}
                {...option}
                active={value === option.id}
                onClick={() => onChange(option.id)}
              />
            ))}
          </div>
          <p className="sf-muted mt-2">
            모든 스타일은 지금 선택·적용할 수 있습니다. 세부 디자인 품질은 순차적으로 다듬어집니다.
          </p>
        </div>
      )}
    </div>
  );
}
