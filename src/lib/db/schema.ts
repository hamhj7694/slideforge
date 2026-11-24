import {
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import type {
  Attachment,
  DesignSystem,
  LayoutSpec,
  OutlineItem,
  ProjectBrief,
  SourceReference,
  SlideStatus,
  StructuredContent,
} from "../types";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  purpose: text("purpose").notNull().default(""),
  audience: text("audience").notNull().default(""),
  tone: text("tone").notNull().default(""),
  masterPrompt: text("master_prompt").notNull().default(""),
  brief: text("brief", { mode: "json" }).$type<ProjectBrief>().notNull(),
  designSystem: text("design_system", { mode: "json" })
    .$type<DesignSystem>()
    .notNull(),
  status: text("status", { mode: "json" })
    .$type<"draft" | "ready" | "exported">()
    .notNull()
    .default("draft"),
  outline: text("outline", { mode: "json" })
    .$type<OutlineItem[]>()
    .notNull()
    .default([]),
  deletedAt: text("deleted_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const slides = sqliteTable("slides", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  orderIndex: integer("order_index").notNull().default(0),
  title: text("title").notNull().default(""),
  role: text("role").notNull().default(""),
  rawInput: text("raw_input").notNull().default(""),
  attachments: text("attachments", { mode: "json" })
    .$type<Attachment[]>()
    .notNull()
    .default([]),
  content: text("content", { mode: "json" })
    .$type<StructuredContent>()
    .notNull(),
  layout: text("layout", { mode: "json" }).$type<LayoutSpec>().notNull(),
  designOverrides: text("design_overrides", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  sources: text("sources", { mode: "json" })
    .$type<SourceReference[]>()
    .notNull()
    .default([]),
  partId: text("part_id"),
  visualOverrides: text("visual_overrides", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  status: text("status", { mode: "json" })
    .$type<SlideStatus>()
    .notNull()
    .default("draft"),
  locked: integer("locked", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const versions = sqliteTable("versions", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  slideId: text("slide_id"),
  kind: text("kind").notNull().default("slide"),
  label: text("label").notNull().default(""),
  snapshot: text("snapshot", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull(),
  createdAt: text("created_at").notNull(),
});

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  kind: text("kind").notNull(),
  label: text("label").notNull(),
  url: text("url"),
  mime: text("mime"),
  storedName: text("stored_name"),
  excerpt: text("excerpt").notNull().default(""),
  content: text("content").notNull().default(""),
  extractionStatus: text("extraction_status").notNull().default("done"),
  metadata: text("metadata", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  createdAt: text("created_at").notNull(),
});

export const uploads = sqliteTable("uploads", {
  id: text("id").primaryKey(),
  originalName: text("original_name").notNull(),
  storedName: text("stored_name").notNull(),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  extractedText: text("extracted_text").notNull().default(""),
  createdAt: text("created_at").notNull(),
});

export const exports = sqliteTable("exports", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull(),
  format: text("format").notNull(),
  filename: text("filename").notNull(),
  path: text("path").notNull(),
  pages: integer("pages").notNull().default(0),
  meta: text("meta", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  createdAt: text("created_at").notNull(),
});

export const usage = sqliteTable("usage", {
  id: text("id").primaryKey(),
  projectId: text("project_id"),
  operation: text("operation").notNull(),
  provider: text("provider").notNull(),
  model: text("model").notNull(),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  costUsd: real("cost_usd").notNull().default(0),
  createdAt: text("created_at").notNull(),
});

export const secrets = sqliteTable("secrets", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull(),
  apiKey: text("api_key").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const appSettings = sqliteTable("app_settings", {
  id: text("id").primaryKey(),
  provider: text("provider").notNull().default("local"),
  model: text("model").notNull().default(""),
  baseUrl: text("base_url").notNull().default(""),
  updatedAt: text("updated_at").notNull(),
});
