"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  FileText,
  ImageIcon,
  Link2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { ModelPicker } from "@/components/ModelPicker";
import { presetOptions } from "@/lib/ai/design-bridge";
import { api, apiPost } from "@/lib/client";
import { classifyReferenceRole, classifySource } from "@/lib/intake";
import type { DesignPresetId, ProjectWithSlides, ReferenceRole, SourceType } from "@/lib/types";

interface Attachment {
  key: string;
  label: string;
  uploadId?: string;
  url?: string;
  mime?: string;
  text?: string;
  kind: SourceType;
  isReference: boolean;
  role: ReferenceRole;
  note: string;
}

const PRESETS = presetOptions();
const KIND_LABELS: Record<SourceType, string> = {
  "job-posting": "채용공고",
  resume: "이력서",
  "career-history": "경력",
  "cover-letter": "자기소개서",
  portfolio: "포트폴리오",
  "project-doc": "프로젝트 문서",
  image: "이미지",
  website: "웹사이트",
  text: "텍스트",
};
const ROLE_LABELS: Record<ReferenceRole, string> = {
  structure: "구성",
  style: "스타일",
  both: "구성 + 스타일",
};

export default function HomePage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [prompt, setPrompt] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [link, setLink] = useState("");
  const [pageCount, setPageCount] = useState<string>("");
  const [preset, setPreset] = useState<DesignPresetId>("modern-editorial");
  const [autoPreset, setAutoPreset] = useState(true);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function addAttachment(item: Omit<Attachment, "key" | "isReference" | "role" | "note">) {
    setAttachments((current) => [
      ...current,
      {
        ...item,
        key: `${item.label}-${current.length}-${Date.now()}`,
        isReference: false,
        role: classifyReferenceRole(item.label),
        note: "",
      },
    ]);
  }

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      try {
        const form = new FormData();
        form.append("file", file);
        const { upload } = await api<{
          upload: { id: string; originalName: string; mime: string };
        }>("/api/uploads", { method: "POST", body: form });
        addAttachment({
          label: upload.originalName,
          uploadId: upload.id,
          mime: upload.mime,
          kind: classifySource(upload.originalName, upload.mime),
        });
      } catch (error) {
        setNotice(`${file.name} 업로드 실패: ${(error as Error).message}`);
      }
    }
  }

  async function addLink() {
    const value = link.trim();
    if (!value) return;
    const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    addAttachment({
      label: normalized.replace(/^https?:\/\//, "").slice(0, 80),
      url: normalized,
      kind: "website",
    });
    setLink("");
  }

  function patchAttachment(key: string, patch: Partial<Attachment>) {
    setAttachments((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  async function create() {
    if (prompt.trim().length < 10 && attachments.length === 0) {
      setNotice("자료와 요청을 10자 이상 적거나 파일을 하나 넣어 주세요.");
      return;
    }
    setBusy(true);
    setNotice("자료를 읽고 구성과 슬라이드를 만들고 있습니다. 페이지가 끝나면 바로 결과로 이동합니다.");
    try {
      const data = await apiPost<{
        project: ProjectWithSlides;
        generation: { notice?: string; slides: number; references: number };
      }>("/api/studio/create", {
        masterPrompt: prompt.trim(),
        preset: autoPreset ? undefined : preset,
        pageCount: pageCount ? Number(pageCount) : undefined,
        sources: [
          ...attachments.map((item) => ({
            label: item.label,
            ...(item.uploadId ? { uploadId: item.uploadId } : {}),
            ...(item.url ? { url: item.url } : {}),
            ...(item.mime ? { mime: item.mime } : {}),
            ...(item.text ? { text: item.text } : {}),
            kind: item.kind,
            isReference: item.isReference,
            ...(item.isReference ? { note: item.note || undefined } : {}),
          })),
          ...(pasteText.trim()
            ? [{ label: "붙여넣은 자료", kind: "text" as SourceType, text: pasteText.trim() }]
            : []),
        ],
      });
      const extra = data.generation.notice ? ` ${data.generation.notice}` : "";
      setNotice(`${data.generation.slides}페이지를 만들었습니다.${extra}`);
      router.push(`/studio/${data.project.id}`);
    } catch (error) {
      setNotice(`생성 실패: ${(error as Error).message}`);
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-5 pb-28 pt-10">
      <section className="mb-8">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">
          Portfolio Builder
        </p>
        <h1 className="font-display text-[40px] leading-[1.12] tracking-tight text-ink sm:text-[52px]">
          자료와 요청을 주면
          <br />
          포트폴리오를 만듭니다.
        </h1>
        <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-muted">
          이력서, 채용공고, 참고 디자인을 한 번에 넣으세요. 구성과 페이지 초안을 모두 만든 뒤,
          결과에서 필요한 페이지만 고치면 됩니다.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3 text-[12px] text-muted">
          <Link href="/projects" className="sf-btn sf-btn-sm">
            기존 프로젝트 열기 <ArrowRight size={13} />
          </Link>
          <span>예시 공고로 시험할 때는 파일 이름에 &lsquo;예시&rsquo;를 넣어 주세요.</span>
        </div>
      </section>

      <section className="sf-card mb-4 p-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label className="sf-label mb-0" htmlFor="master-prompt">자료와 요청</label>
          <ModelPicker onNotice={setNotice} />
        </div>
        <textarea
          id="master-prompt"
          data-testid="master-prompt"
          className="sf-input min-h-[190px] resize-y text-[14px] leading-relaxed"
          placeholder={
            "취업 포트폴리오를 만들고 싶습니다. 12페이지로 핵심 역량, 마케팅 실무 경험, AI 활용 경험, 문제 인식, 구현 경험, 기여 방향을 순서대로 이어 주세요. " +
            "아래에 붙인 이력서와 공고를 근거로 쓰고, 없는 성과는 만들지 마세요."
          }
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
        />
        <p className="sf-muted mt-2">
          긴 문장으로 써도 됩니다. &lsquo;제목:&rsquo;, &lsquo;목적:&rsquo;, &lsquo;톤:&rsquo;, &lsquo;12페이지&rsquo;처럼 적은 단서는 자동으로 읽습니다.
        </p>
      </section>

      <section className="sf-card mb-4 p-5" data-testid="source-composer">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg tracking-tight">정보와 레퍼런스</h2>
            <p className="sf-muted mt-1">
              파일 이름으로 자료 종류를 구분합니다. 참고용이라면 &lsquo;참고로 분석&rsquo;에 체크하세요.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="sf-btn sf-btn-sm"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
            >
              <Upload size={13} /> 파일 넣기
            </button>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.webp,.gif"
              onChange={(event) => {
                void addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </div>
        </div>

        {attachments.length > 0 && (
          <ul className="mb-4 space-y-2">
            {attachments.map((item) => (
              <li key={item.key} className="rounded-lg border border-line bg-white p-3">
                <div className="flex flex-wrap items-center gap-2">
                  {item.kind === "image" ? (
                    <ImageIcon size={14} className="shrink-0 text-accent" />
                  ) : (
                    <FileText size={14} className="shrink-0 text-accent" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">
                    {item.label}
                  </span>
                  <select
                    className="h-8 rounded border border-line bg-white px-1.5 text-[11px]"
                    aria-label={`${item.label} 자료 종류`}
                    value={item.kind}
                    onChange={(event) => patchAttachment(item.key, { kind: event.target.value as SourceType })}
                  >
                    {(Object.keys(KIND_LABELS) as SourceType[]).map((kind) => (
                      <option key={kind} value={kind}>{KIND_LABELS[kind]}</option>
                    ))}
                  </select>
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-muted">
                    <input
                      type="checkbox"
                      checked={item.isReference}
                      onChange={(event) => patchAttachment(item.key, { isReference: event.target.checked })}
                    />
                    참고로 분석
                  </label>
                  <button
                    type="button"
                    className="sf-btn sf-btn-ghost sf-btn-sm px-1.5"
                    aria-label={`${item.label} 제거`}
                    onClick={() => setAttachments((current) => current.filter((a) => a.key !== item.key))}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                {item.isReference && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-[180px_1fr]">
                    <select
                      className="sf-input h-8"
                      aria-label={`${item.label} 참고 역할`}
                      value={item.role}
                      onChange={(event) => patchAttachment(item.key, { role: event.target.value as ReferenceRole })}
                    >
                      {(Object.keys(ROLE_LABELS) as ReferenceRole[]).map((role) => (
                        <option key={role} value={role}>{ROLE_LABELS[role]}</option>
                      ))}
                    </select>
                    <input
                      className="sf-input h-8"
                      aria-label={`${item.label} 참고 메모`}
                      placeholder="이미지라면 색감·여백·제목 스타일을 적어 주세요"
                      value={item.note}
                      onChange={(event) => patchAttachment(item.key, { note: event.target.value })}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2">
          <input
            className="sf-input h-9"
            aria-label="참고 웹사이트 주소"
            placeholder="https:// 참고할 사이트 주소를 붙여넣고 추가"
            value={link}
            onChange={(event) => setLink(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void addLink();
              }
            }}
          />
          <button type="button" className="sf-btn sf-btn-sm shrink-0" onClick={() => void addLink()}>
            <Link2 size={13} /> 링크 추가
          </button>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <label className="sf-label" htmlFor="paste-source">따로 붙여넣은 자료</label>
          <textarea
            id="paste-source"
            className="sf-input min-h-[64px] resize-y"
            placeholder="공고 원문처럼 별도로 보관할 글을 붙여넣으세요. 위의 요청 문장과 섞이지 않습니다."
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
          />
          {pasteText.trim() && (
            <button
              type="button"
              className="sf-btn sf-btn-sm mt-2"
              onClick={() => {
                addAttachment({
                  label: `붙여넣은 자료 ${attachments.length + 1}`,
                  kind: classifySource(pasteText.slice(0, 120)),
                  text: pasteText.trim(),
                });
                setPasteText("");
              }}
            >
              <Plus size={13} /> 자료로 추가
            </button>
          )}
        </div>
      </section>

      <details className="sf-card p-5">
        <summary className="cursor-pointer text-[13px] font-semibold">
          스타일 · 페이지 수 직접 지정 (선택)
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="sf-label" htmlFor="page-count">페이지 수</label>
            <input
              id="page-count"
              data-testid="page-count"
              type="number"
              min={3}
              max={30}
              className="sf-input"
              placeholder="비워두면 자료에서 읽습니다"
              value={pageCount}
              onChange={(event) => setPageCount(event.target.value)}
            />
            <label className="mt-3 flex items-center gap-2 text-[12px] text-muted">
              <input
                type="checkbox"
                checked={autoPreset}
                onChange={(event) => setAutoPreset(event.target.checked)}
              />
              참고 자료에서 스타일 자동 감지
            </label>
          </div>
          <div>
            <label className="sf-label" htmlFor="preset-select">디자인 프리셋</label>
            <select
              id="preset-select"
              className="sf-input"
              disabled={autoPreset}
              value={preset}
              onChange={(event) => setPreset(event.target.value as DesignPresetId)}
            >
              {PRESETS.map((option) => (
                <option key={option.id} value={option.id}>{option.name}</option>
              ))}
            </select>
            <p className="sf-muted mt-2">
              자동 감지를 켜두면 참고 자료에서 단서를 찾고, 없으면 Modern Editorial을 씁니다.
            </p>
          </div>
        </div>
      </details>

      <div className="sticky bottom-4 mt-8 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-paper/95 px-4 py-3 shadow-panel backdrop-blur">
        <p className="max-w-xl text-[12px] text-muted">
          {notice || "API 키가 없어도 로컬 엔진으로 전체 초안을 만들 수 있습니다."}
        </p>
        <button
          data-testid="create-project"
          type="button"
          className="sf-btn sf-btn-accent px-5"
          onClick={() => void create()}
          disabled={busy}
        >
          {busy ? "만드는 중…" : "포트폴리오 생성"} <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}
