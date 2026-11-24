import fs from "node:fs/promises";
import path from "node:path";
import dns from "node:dns/promises";

import JSZip from "jszip";
import mammoth from "mammoth";

import { dataDir } from "./db";
import { createUpload } from "./repo";
import { newId } from "./utils";

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

export const ALLOWED_EXTENSIONS: string[] = [
  "pdf",
  "docx",
  "pptx",
  "txt",
  "md",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "svg",
];

const MAX_EXTRACTED_CHARS = 12000;
const MAX_FETCH_BYTES = 300 * 1024;
const FETCH_TIMEOUT_MS = 12_000;

const IMAGE_MIMES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/bmp",
  "image/avif",
]);

const MIME_BY_EXTENSION: Record<string, string[]> = {
  pdf: ["application/pdf", "application/x-pdf"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  pptx: [
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ],
  txt: ["text/plain", "application/txt"],
  md: ["text/markdown", "text/x-markdown", "text/plain"],
  png: ["image/png"],
  jpg: ["image/jpeg", "image/jpg"],
  jpeg: ["image/jpeg", "image/jpg"],
  gif: ["image/gif"],
  webp: ["image/webp"],
  svg: ["image/svg+xml"],
};

export function isImageMime(mime: string): boolean {
  return IMAGE_MIMES.has((mime || "").split(";")[0].trim().toLowerCase());
}

/** Returns a sanitized, dot-less lowercase extension. Never use the raw name for paths. */
export function safeExtension(name: string): string {
  const base = (name || "").replace(/\\/g, "/").split("/").pop() || "";
  const dot = base.lastIndexOf(".");
  if (dot < 0 || dot === base.length - 1) return "";
  return base
    .slice(dot + 1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 10);
}

function resolveMime(ext: string, provided: string): string {
  const normalized = (provided || "").split(";")[0].trim().toLowerCase();
  const allowed = MIME_BY_EXTENSION[ext] ?? [];
  if (
    normalized &&
    normalized !== "application/octet-stream" &&
    normalized !== "binary/octet-stream"
  ) {
    if (!allowed.includes(normalized)) {
      throw new Error(
        "파일 확장자와 MIME 형식이 일치하지 않습니다. 지원하는 형식인지 확인해 주세요.",
      );
    }
  }
  return normalized || allowed[0] || "application/octet-stream";
}

function clampText(text: string): string {
  return (text || "").replace(/\u0000/g, "").slice(0, MAX_EXTRACTED_CHARS);
}

async function extractPdf(buffer: Buffer): Promise<string> {
  try {
    // @ts-ignore - the legacy ESM build is loaded dynamically in Node.
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const task = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
      isEvalSupported: false,
    });
    try {
      const pdf = await task.promise;
      const chunks: string[] = [];
      let length = 0;
      for (let pageNo = 1; pageNo <= pdf.numPages; pageNo += 1) {
        const page = await pdf.getPage(pageNo);
        const content = await page.getTextContent();
        for (const item of content.items) {
          const str = (item as unknown as { str?: unknown } | null)?.str;
          if (typeof str !== "string") continue;
          chunks.push(str);
          length += str.length;
          if (length >= MAX_EXTRACTED_CHARS) break;
        }
        if (length >= MAX_EXTRACTED_CHARS) break;
      }
      return clampText(chunks.join(" "));
    } finally {
      if (typeof task.destroy === "function") await task.destroy();
    }
  } catch {
    return "";
  }
}

async function extractDocx(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return clampText(result.value || "");
  } catch {
    return "";
  }
}

function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      safeCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) => safeCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&amp;/gi, "&");
}

async function extractPptx(buffer: Buffer): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const slideNames = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
      .sort((a, b) => {
        const aNum = Number(a.match(/slide(\d+)\.xml$/i)?.[1] ?? 0);
        const bNum = Number(b.match(/slide(\d+)\.xml$/i)?.[1] ?? 0);
        return aNum - bNum;
      });
    const parts: string[] = [];
    let length = 0;
    for (const name of slideNames) {
      const entry = zip.file(name);
      if (!entry) continue;
      const xml = await entry.async("string");
      const runs = xml.match(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/gi) ?? [];
      const slideText =
        runs
          .map((run) =>
            decodeEntities(
              run.replace(/^<a:t(?:\s[^>]*)?>/i, "").replace(/<\/a:t>$/i, ""),
            ),
          )
          .filter(Boolean)
          .join(" ") ||
        decodeEntities(xml.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
      parts.push(slideText);
      length += slideText.length;
      if (length >= MAX_EXTRACTED_CHARS) break;
    }
    return clampText(parts.join("\n"));
  } catch {
    return "";
  }
}

async function extractText(ext: string, buffer: Buffer): Promise<string> {
  try {
    switch (ext) {
      case "pdf":
        return await extractPdf(buffer);
      case "docx":
        return await extractDocx(buffer);
      case "pptx":
        return await extractPptx(buffer);
      case "txt":
      case "md":
        return clampText(buffer.toString("utf8"));
      default:
        return "";
    }
  } catch {
    // Text extraction is best-effort: an unreadable document must not fail the upload.
    return "";
  }
}

export async function saveUpload(file: File): Promise<{
  id: string;
  originalName: string;
  storedName: string;
  url: string;
  mime: string;
  size: number;
  extractedText: string;
}> {
  if (!file || typeof file.arrayBuffer !== "function") {
    throw new Error("업로드할 파일이 올바르지 않습니다.");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      "파일 크기가 20MB를 초과했습니다. 더 작은 파일을 선택해 주세요.",
    );
  }
  const ext = safeExtension(file.name);
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    throw new Error(
      "지원하지 않는 파일 형식입니다. PDF, DOCX, PPTX, TXT, MD 및 이미지 파일만 업로드할 수 있습니다.",
    );
  }
  const mime = resolveMime(ext, file.type || "");
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new Error(
      "파일 크기가 20MB를 초과했습니다. 더 작은 파일을 선택해 주세요.",
    );
  }

  // The stored name is derived only from a random id and the validated extension.
  const storedName = `${newId("upl")}.${ext}`;
  const uploadDir = path.join(dataDir(), "uploads");
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, storedName), buffer, { flag: "wx" });

  const extractedText = await extractText(ext, buffer);
  const uploaded = createUpload({
    originalName: file.name || "upload",
    storedName,
    mime,
    size: buffer.length,
    extractedText,
  });
  if (!uploaded) throw new Error("업로드 정보를 저장하지 못했습니다.");
  return uploaded;
}

function isBlockedIpv4(ip: string): boolean {
  const parts = ip.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return false;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local + 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
}

function isBlockedIpv6(ip: string): boolean {
  const value = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (value === "::" || value === "::1" || value === "0:0:0:0:0:0:0:1") {
    return true;
  }
  if (/^f[cd][0-9a-f]{2}:/.test(value)) return true; // fc00::/7
  if (/^fe[89ab][0-9a-f]:/.test(value)) return true; // fe80::/10
  const embedded =
    value.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i) ??
    value.match(/^::(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (embedded) return isBlockedIpv4(embedded[1]);
  return false;
}

function assertSafeTarget(rawUrl: string): URL {
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new Error("올바른 URL을 입력해 주세요.");
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    throw new Error("http 또는 https URL만 지원합니다.");
  }
  if (target.username || target.password) {
    throw new Error("인증 정보가 포함된 URL은 사용할 수 없습니다.");
  }
  const hostname = target.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (!hostname) throw new Error("올바른 URL을 입력해 주세요.");
  if (hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("로컬 주소는 사용할 수 없습니다.");
  }
  if (isBlockedIpv4(hostname) || isBlockedIpv6(hostname)) {
    throw new Error("사설망 또는 예약된 IP 주소는 사용할 수 없습니다.");
  }
  return target;
}

async function assertDnsSafe(hostname: string): Promise<void> {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const addresses = await dns.lookup(host, { all: true, verbatim: true });
  if (!addresses.length) throw new Error("DNS 조회 결과가 없습니다.");
  for (const { address } of addresses) {
    if (isBlockedIpv4(address) || isBlockedIpv6(address)) {
      throw new Error("사설망 또는 예약된 IP 주소는 사용할 수 없습니다.");
    }
  }
}

async function readBodyLimited(response: Response): Promise<string> {
  const declared = Number(response.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_FETCH_BYTES) {
    throw new Error("페이지 내용이 300KB를 초과합니다.");
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let received = 0;
  let text = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_FETCH_BYTES) {
        await reader.cancel();
        throw new Error("페이지 내용이 300KB를 초과합니다.");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally {
    reader.releaseLock();
  }
  return text;
}

function cleanHtml(value: string): string {
  // Fetched content is untrusted plain text: decode and collapse, never evaluate.
  return decodeEntities(value).replace(/\s+/g, " ").trim();
}

export async function fetchUrlContent(
  url: string,
): Promise<{ title: string; text: string; url: string }> {
  let target = assertSafeTarget(url);
  let html = "";
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    await assertDnsSafe(target.hostname);
    const response = await fetch(target, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        accept: "text/html,text/plain,*/*",
        "user-agent": "SlideForge/1.0 (url-import)",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      await response.body?.cancel();
      if (!location || redirect === 3) {
        throw new Error("리다이렉트가 너무 많습니다.");
      }
      target = assertSafeTarget(new URL(location, target).toString());
      continue;
    }
    if (!response.ok) {
      throw new Error(`웹 페이지를 가져오지 못했습니다. (HTTP ${response.status})`);
    }
    html = await readBodyLimited(response);
    break;
  }

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title\s*>/i);
  const hostname = target.hostname.replace(/^\[|\]$/g, "");
  const title =
    cleanHtml(titleMatch?.[1] ?? "").slice(0, 200) || hostname || target.href;

  const readable = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ");

  return {
    title,
    text: cleanHtml(readable).slice(0, MAX_EXTRACTED_CHARS),
    url: target.toString(),
  };
}
