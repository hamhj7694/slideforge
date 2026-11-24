"use client";

import { useRef, useState } from "react";
import { FileText, Image as ImageIcon, Link2, Plus, Trash2, UploadCloud } from "lucide-react";
import { api, apiPost } from "@/lib/client";
import type { SourceType } from "@/lib/types";

export interface ComposedSource {
  label: string;
  kind: SourceType;
  text?: string;
  uploadId?: string;
  url?: string;
  mime?: string;
  metadata?: Record<string, unknown>;
}

export const SOURCE_LABELS: Record<SourceType, string> = {
  "job-posting": "채용공고",
  resume: "이력서",
  "career-history": "경력기술서",
  "cover-letter": "자기소개서",
  portfolio: "기존 포트폴리오",
  "project-doc": "프로젝트 문서",
  image: "이미지 · 스크린샷",
  website: "참고 웹사이트",
  text: "자유 텍스트",
};

const KINDS = Object.keys(SOURCE_LABELS) as SourceType[];

export function SourceComposer({
  sources,
  onChange,
  onNotice,
}: {
  sources: ComposedSource[];
  onChange: (sources: ComposedSource[]) => void;
  onNotice: (message: string) => void;
}) {
  const [kind, setKind] = useState<SourceType>("job-posting");
  const [label, setLabel] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function addSource(source: ComposedSource) {
    if (!source.label && !source.text && !source.uploadId && !source.url) return;
    onChange([
      ...sources,
      {
        ...source,
        label: source.label || SOURCE_LABELS[source.kind] + ` ${sources.length + 1}`,
      },
    ]);
    setLabel("");
    setText("");
    setUrl("");
  }

  async function uploadFiles(files: FileList | File[]) {
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        const data = await api<{ upload: { id: string; url: string; mime: string; originalName: string; extractedText: string } }>(
          "/api/uploads",
          { method: "POST", body: form },
        );
        addSource({
          kind: file.type.startsWith("image/") ? "image" : kind === "image" ? "image" : kind,
          label: label || file.name,
          uploadId: data.upload.id,
          mime: data.upload.mime,
          text: data.upload.extractedText.slice(0, 4000),
          metadata: { originalName: data.upload.originalName, previewUrl: data.upload.url },
        });
      }
      onNotice("파일을 업로드했습니다. 원문은 프로젝트에 그대로 보존됩니다.");
    } catch (error) {
      onNotice(`업로드 실패: ${(error as Error).message}`);
    } finally {
      setUploading(false);
    }
  }

  async function importUrl() {
    if (!url.trim()) return;
    try {
      const data = await apiPost<{ title: string; text: string }>("/api/import-url", { url });
      addSource({ kind, label: label || data.title, url, text: data.text });
      onNotice("URL 콘텐츠를 가져왔습니다. 자료는 텍스트로만 취급합니다.");
    } catch (error) {
      onNotice(`URL 가져오기 실패: ${(error as Error).message}`);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[160px_1fr]">
        <select
          aria-label="자료 유형"
          className="sf-input h-10"
          value={kind}
          onChange={(event) => setKind(event.target.value as SourceType)}
        >
          {KINDS.map((item) => (
            <option key={item} value={item}>
              {SOURCE_LABELS[item]}
            </option>
          ))}
        </select>
        <input
          className="sf-input h-10"
          placeholder="자료 이름 (예: 공카 AI 마케터 공고)"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
        />
      </div>

      <textarea
        className="sf-input min-h-[88px] resize-y"
        placeholder={
          kind === "job-posting"
            ? "채용공고 원문을 붙여넣으세요. 기업명, 모집직무, 담당업무, 필수·우대 요건 등이 포함되면 좋습니다."
            : "참고 자료 원문을 붙여넣으세요."
        }
        value={text}
        onChange={(event) => setText(event.target.value)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="sf-btn sf-btn-sm"
          onClick={() => addSource({ kind, label, text })}
        >
          <Plus size={13} /> 텍스트 추가
        </button>
        <button
          type="button"
          className="sf-btn sf-btn-sm"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
        >
          <UploadCloud size={13} /> {uploading ? "업로드 중…" : "파일 업로드"}
        </button>
        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp,.gif"
          onChange={(event) => event.target.files && uploadFiles(event.target.files)}
        />
        <div className="flex flex-1 items-center gap-1.5">
          <input
            className="sf-input h-9"
            placeholder="https://public-example.com/posting"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
          <button type="button" className="sf-btn sf-btn-sm" onClick={importUrl}>
            <Link2 size={13} /> 가져오기
          </button>
        </div>
      </div>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (event.dataTransfer.files.length) uploadFiles(event.dataTransfer.files);
        }}
        className={`rounded-lg border border-dashed px-3 py-2 text-center text-[11px] transition-colors ${
          dragging ? "border-accent bg-accent-soft text-accent" : "border-line text-muted"
        }`}
      >
        파일을 여기로 드래그하거나 위 버튼으로 첨부하세요 · PDF · DOCX · PPTX · TXT · MD · 이미지
      </div>

      {sources.length > 0 && (
        <ul className="space-y-1.5">
          {sources.map((source, index) => (
            <li
              key={`${source.label}-${index}`}
              className="flex items-center gap-2 rounded-md border border-line bg-white px-2.5 py-2"
            >
              {source.kind === "image" || source.mime?.startsWith("image/") ? (
                <ImageIcon size={14} className="shrink-0 text-accent" />
              ) : (
                <FileText size={14} className="shrink-0 text-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-ink">{source.label}</p>
                <p className="truncate text-[10px] text-muted">
                  {SOURCE_LABELS[source.kind]} ·{" "}
                  {source.text ? `${source.text.length.toLocaleString()}자 원문 보존` : "파일/URL 첨부"}
                </p>
              </div>
              <button
                type="button"
                className="sf-btn sf-btn-ghost sf-btn-sm px-2"
                aria-label={`${source.label} 제거`}
                onClick={() => onChange(sources.filter((_, i) => i !== index))}
              >
                <Trash2 size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
