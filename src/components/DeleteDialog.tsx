"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export function DeleteDialog({
  open,
  title,
  description,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [consent, setConsent] = useState(false);

  useEffect(() => {
    if (open) {
      setValue("");
      setConsent(false);
    }
  }, [open]);

  if (!open) return null;
  const ready = value === "삭제" && consent && !busy;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4" role="dialog" aria-modal="true">
      <div className="sf-card w-full max-w-md p-6 sf-fade-in">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2 text-accent">
            <AlertTriangle size={18} />
            <span className="text-[12px] font-bold uppercase tracking-widest">안전한 삭제</span>
          </div>
          <button className="sf-btn sf-btn-ghost sf-btn-sm px-2" onClick={onCancel} aria-label="닫기">
            <X size={16} />
          </button>
        </div>
        <h3 className="font-display text-2xl tracking-tight">{title}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-muted">{description}</p>
        <div className="mt-5 space-y-3">
          <div>
            <label className="sf-label" htmlFor="delete-confirm-input">
              확인을 위해 정확히 <span className="text-accent">삭제</span>를 입력하세요
            </label>
            <input
              id="delete-confirm-input"
              data-testid="delete-confirm-input"
              className="sf-input"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus
            />
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-[12px] text-muted">
            <input
              type="checkbox"
              data-testid="delete-consent"
              className="mt-0.5"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
            />
            삭제 대상과 영향을 받는 범위를 확인했으며, 이전 상태가 버전에 저장되는 것을 이해합니다.
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="sf-btn" onClick={onCancel}>
            취소
          </button>
          <button
            data-testid="delete-final"
            className="sf-btn sf-btn-accent"
            disabled={!ready}
            onClick={() => onConfirm()}
          >
            {busy ? "삭제 중…" : "최종 삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}
