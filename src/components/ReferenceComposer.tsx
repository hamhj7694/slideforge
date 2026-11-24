"use client";

import { useRef, useState } from "react";
import { FileText, ImageIcon, Link2, ScanSearch, Trash2, Upload } from "lucide-react";
import { api, apiPost } from "@/lib/client";
import type { ReferenceAnalysis, ReferenceRole, SourceType } from "@/lib/types";

export interface ComposedReference {
  label: string;
  role: ReferenceRole;
  sourceType: SourceType;
  uploadId?: string;
  url?: string;
  text?: string;
  note?: string;
  paletteHints?: string[];
  analysis: ReferenceAnalysis;
}

const ROLE_LABELS: Record<ReferenceRole, string> = {
  structure: "구성",
  style: "스타일",
  both: "구성 + 스타일",
};

async function paletteFromFile(file: File): Promise<string[]> {
  if (!file.type.startsWith("image/") || typeof createImageBitmap !== "function") return [];
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext("2d");
    if (!context) return [];
    context.drawImage(bitmap, 0, 0, 32, 32);
    const { data } = context.getImageData(0, 0, 32, 32);
    const counts = new Map<string, number>();
    for (let index = 0; index < data.length; index += 16) {
      const [red, green, blue, alpha] = [
        data[index],
        data[index + 1],
        data[index + 2],
        data[index + 3],
      ];
      if (alpha < 200) continue;
      if (Math.min(red, green, blue) > 245 || Math.max(red, green, blue) < 25) continue;
      const hex = `#${[red, green, blue]
        .map((value) => Math.round(value / 32) * 32)
        .map((value) => value.toString(16).padStart(2, "0"))
        .join("")}`;
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
    bitmap.close();
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([hex]) => hex);
  } catch {
    return [];
  }
}

type AnalyzePayload = {
  label: string;
  role: ReferenceRole;
  sourceType: SourceType;
  uploadId?: string;
  url?: string;
  text?: string;
  note?: string;
  paletteHints?: string[];
};

export function ReferenceComposer({
  references,
  onChange,
  onNotice,
}: {
  references: ComposedReference[];
  onChange: (references: ComposedReference[]) => void;
  onNotice: (message: string) => void;
}) {
  const [role, setRole] = useState<ReferenceRole>("both");
  const [label, setLabel] = useState("");
  const [note, setNote] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function analyze(payload: AnalyzePayload) {
    setBusy(true);
    try {
      const { analysis } = await apiPost<{ analysis: ReferenceAnalysis }>(
        "/api/references/analyze",
        payload,
      );
      onChange([...references, { ...payload, label: analysis.label, analysis }]);
      onNotice(`${analysis.label}: ${analysis.summary}`);
      setLabel("");
      setNote("");
      setText("");
      setUrl("");
    } catch (error) {
      onNotice(`참고 분석 실패: ${(error as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const { upload } = await api<{
        upload: { id: string; originalName: string; mime: string };
      }>("/api/uploads", { method: "POST", body: form });
      const paletteHints = await paletteFromFile(file);
      await analyze({
        label: label || upload.originalName,
        role,
        sourceType: file.type.startsWith("image/") ? "image" : "portfolio",
        uploadId: upload.id,
        note,
        paletteHints,
      });
    } catch (error) {
      onNotice(`참고 파일 업로드 실패: ${(error as Error).message}`);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3" data-testid="reference-composer">
      <p className="sf-muted text-[12px] leading-relaxed">
        참고할 포트폴리오나 디자인 파일을 올리면 섹션 제목, 페이지 단서, 레이아웃과 스타일
        단서를 뽑아 목차와 디자인 방향에 반영합니다. 이미지는 색상과 함께 설명을 남겨 주세요.
      </p>

      <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
        <select
          className="sf-input h-10"
          aria-label="참고 자료 역할"
          value={role}
          onChange={(event) => setRole(event.target.value as ReferenceRole)}
        >
          {Object.entries(ROLE_LABELS).map(([value, name]) => (
            <option key={value} value={value}>
              {name}
            </option>
          ))}
        </select>
        <input
          className="sf-input h-10"
          aria-label="참고 자료 이름"
          placeholder="예: 지원 포트폴리오 레퍼런스"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </div>

      <textarea
        className="sf-input min-h-[72px] resize-y"
        aria-label="참고 자료 설명"
        placeholder="이미지라면 '세리프 제목, 흑백, 넉넉한 여백'처럼 보고 싶은 방향을 적으세요."
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <textarea
        className="sf-input min-h-[72px] resize-y font-mono text-[11px]"
        aria-label="참고 자료 원문"
        placeholder="목차나 섹션 제목을 그대로 붙여넣어도 됩니다. 1. 서론 형식을 인식합니다."
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="sf-btn sf-btn-sm"
          data-testid="reference-file"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
        >
          <Upload size={13} /> 파일 올리기
        </button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp,.gif"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void onFile(file);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          className="sf-btn sf-btn-sm"
          data-testid="reference-analyze"
          disabled={busy || (!text.trim() && !url.trim())}
          onClick={() =>
            void analyze({
              label: label || (url ? "웹 참고 자료" : "붙여넣은 참고 자료"),
              role,
              sourceType: url ? "website" : "text",
              ...(url ? { url } : { text }),
              note,
            })
          }
        >
          <ScanSearch size={13} /> {busy ? "분석 중…" : "붙여넣기 분석"}
        </button>
        <div className="flex flex-1 items-center gap-1.5">
          <input
            className="sf-input h-9"
            aria-label="참고 웹사이트 주소"
            placeholder="https://…"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <Link2 size={14} className="shrink-0 text-muted" />
        </div>
      </div>

      {references.length > 0 && (
        <ul className="space-y-2" data-testid="reference-list">
          {references.map((reference, index) => (
            <li
              key={`${reference.label}-${index}`}
              className="rounded-lg border border-line bg-white p-3"
              data-testid="reference-item"
            >
              <div className="flex items-start gap-2">
                {reference.sourceType === "image" ? (
                  <ImageIcon size={14} className="mt-0.5 shrink-0 text-accent" />
                ) : (
                  <FileText size={14} className="mt-0.5 shrink-0 text-accent" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-semibold text-ink">
                    {reference.label}
                    <span className="ml-2 font-normal text-muted">
                      {ROLE_LABELS[reference.role]}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-muted">
                    {reference.analysis.summary}
                  </p>
                  {reference.analysis.sectionTitles.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {reference.analysis.sectionTitles.slice(0, 5).map((title) => (
                        <span key={title} className="sf-chip text-[10px]">
                          {title}
                        </span>
                      ))}
                    </div>
                  )}
                  {reference.analysis.paletteHints.length > 0 && (
                    <div className="mt-2 flex gap-1">
                      {reference.analysis.paletteHints.map((hex) => (
                        <span
                          key={hex}
                          className="h-4 w-4 rounded-sm border border-line"
                          style={{ background: hex }}
                          title={hex}
                        />
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="sf-btn sf-btn-ghost sf-btn-sm px-2"
                  aria-label={`${reference.label} 참고 제거`}
                  onClick={() => onChange(references.filter((_, i) => i !== index))}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
