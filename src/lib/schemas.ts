import { z } from "zod";
import { LAYOUT_KINDS } from "./types";

export const attachmentSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  url: z.string().min(1),
  mime: z.string().optional(),
  size: z.number().optional(),
  kind: z.enum(["image", "document", "url"]),
  caption: z.string().optional(),
});

export const sectionSchema = z.object({
  label: z.string().optional(),
  heading: z.string().optional(),
  body: z.string().optional(),
});

export const metricSchema = z.object({
  value: z.string(),
  label: z.string(),
  note: z.string().optional(),
});

export const imageSchema = z.object({
  url: z.string(),
  alt: z.string().optional(),
  caption: z.string().optional(),
  fit: z.enum(["cover", "contain"]).optional(),
});

export const contentSchema = z.object({
  kicker: z.string().optional(),
  title: z.string().default(""),
  subtitle: z.string().optional(),
  lede: z.string().optional(),
  sections: z.array(sectionSchema).max(5).optional(),
  bullets: z.array(z.string()).max(8).optional(),
  metrics: z.array(metricSchema).max(4).optional(),
  timeline: z
    .array(
      z.object({
        label: z.string(),
        title: z.string(),
        body: z.string().optional(),
      }),
    )
    .max(6)
    .optional(),
  steps: z
    .array(z.object({ title: z.string(), body: z.string().optional() }))
    .max(6)
    .optional(),
  quote: z
    .object({ text: z.string(), attribution: z.string().optional() })
    .optional(),
  table: z
    .object({
      columns: z.array(z.string()).min(2).max(5),
      rows: z.array(z.array(z.string())).max(8),
      note: z.string().optional(),
    })
    .optional(),
  chart: z
    .object({
      type: z.enum(["bar", "line", "donut"]),
      title: z.string().optional(),
      unit: z.string().optional(),
      series: z.array(z.object({ label: z.string(), value: z.number() })).max(8),
      note: z.string().optional(),
    })
    .optional(),
  before: z
    .object({ title: z.string(), items: z.array(z.string()).max(5) })
    .optional(),
  after: z
    .object({ title: z.string(), items: z.array(z.string()).max(5) })
    .optional(),
  images: z.array(imageSchema).max(4).optional(),
  tags: z.array(z.string()).max(8).optional(),
  footnote: z.string().optional(),
});

export const layoutSchema = z.object({
  kind: z.enum(LAYOUT_KINDS),
  imageSide: z.enum(["left", "right"]).optional(),
  density: z.enum(["low", "medium", "high"]).optional(),
  showFooter: z.boolean().optional(),
  accent: z.enum(["accent", "ink", "none"]).optional(),
  variant: z.string().optional(),
});

const paletteSchema = z.object({
  bg: z.string(),
  surface: z.string(),
  ink: z.string(),
  muted: z.string(),
  accent: z.string(),
  accentSoft: z.string(),
  line: z.string(),
});

export const designSystemSchema = z.object({
  preset: z.enum([
    "swiss-editorial",
    "modern-editorial",
    "minimal-corporate",
    "tech-product",
    "premium-portfolio",
    "data-story",
    "magazine",
  ]),
  name: z.string(),
  mode: z.enum(["light", "dark"]),
  palette: paletteSchema,
  typography: z.object({
    displayFont: z.string(),
    bodyFont: z.string(),
    displayWeight: z.number(),
    bodyWeight: z.number(),
    displayTracking: z.string(),
    headingScale: z.number(),
    bodyScale: z.number(),
    lineHeight: z.number(),
  }),
  grid: z.object({
    margin: z.number(),
    gutter: z.number(),
    columns: z.number(),
  }),
  shape: z.object({ radius: z.number(), rule: z.number() }),
  image: z.object({
    treatment: z.enum(["none", "warm", "mono", "duotone"]),
    overlay: z.number(),
  }),
  details: z.object({
    pageNumber: z.enum(["none", "index", "fraction"]),
    footer: z.boolean(),
    kicker: z.boolean(),
  }),
});

export const createProjectSchema = z.object({
  title: z.string().max(120).optional(),
  masterPrompt: z.string().min(10, "프롬프트를 10자 이상 입력해 주세요.").max(20000),
  purpose: z.string().max(500).optional(),
  audience: z.string().max(500).optional(),
  tone: z.string().max(300).optional(),
  pageCount: z.number().int().min(3).max(30).optional(),
  preset: z
    .enum([
      "swiss-editorial",
      "modern-editorial",
      "minimal-corporate",
      "tech-product",
      "premium-portfolio",
      "data-story",
      "magazine",
    ])
    .optional(),
  sources: z
    .array(
      z.object({
        uploadId: z.string().optional(),
        label: z.string(),
        kind: z.enum(["file", "url", "text"]),
        url: z.string().optional(),
        text: z.string().max(50000).optional(),
        mime: z.string().optional(),
      }),
    )
    .max(20)
    .optional(),
});

export const updateProjectSchema = z.object({
  title: z.string().max(120).optional(),
  purpose: z.string().max(500).optional(),
  audience: z.string().max(500).optional(),
  tone: z.string().max(300).optional(),
  masterPrompt: z.string().max(20000).optional(),
  designSystem: designSystemSchema.optional(),
  brief: z
    .object({
      purpose: z.string(),
      audience: z.string(),
      coreMessage: z.string(),
      storyline: z.string(),
      tone: z.string(),
      visualDirection: z.string(),
      differentiators: z.array(z.string()),
      outline: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          role: z.string(),
          keyMessage: z.string(),
          visual: z.enum(LAYOUT_KINDS),
        }),
      ),
    })
    .optional(),
});

export const createSlideSchema = z.object({
  title: z.string().max(160).optional(),
  role: z.string().max(80).optional(),
  afterSlideId: z.string().optional(),
  rawInput: z.string().max(20000).optional(),
});

export const updateSlideSchema = z.object({
  title: z.string().max(160).optional(),
  role: z.string().max(80).optional(),
  rawInput: z.string().max(20000).optional(),
  content: contentSchema.optional(),
  layout: layoutSchema.optional(),
  designOverrides: z.record(z.unknown()).optional(),
  attachments: z.array(attachmentSchema).max(12).optional(),
  status: z.enum(["draft", "generated", "ready"]).optional(),
  locked: z.boolean().optional(),
  sources: z.array(z.record(z.unknown())).optional(),
});

export const generateSlideSchema = z.object({
  instruction: z.string().max(4000).optional(),
  mode: z.enum(["generate", "regenerate", "design-only"]).default("generate"),
});

export const reviseSlideSchema = z.object({
  instruction: z.string().min(2).max(4000),
  scope: z.enum(["slide", "design-only"]).default("slide"),
});

export const reorderSchema = z.object({
  slideIds: z.array(z.string()).min(1),
});

export const outlineSaveSchema = z.object({
  brief: z.object({
    purpose: z.string(),
    audience: z.string(),
    coreMessage: z.string(),
    storyline: z.string(),
    tone: z.string(),
    visualDirection: z.string(),
    differentiators: z.array(z.string()),
    outline: z.array(
      z.object({
        id: z.string(),
        title: z.string(),
        role: z.string(),
        keyMessage: z.string(),
        visual: z.enum(LAYOUT_KINDS),
      }),
    ),
  }),
  designPreset: z
    .enum([
      "swiss-editorial",
      "modern-editorial",
      "minimal-corporate",
      "tech-product",
      "premium-portfolio",
      "data-story",
      "magazine",
    ])
    .optional(),
});

export const designUpdateSchema = z.object({
  preset: z
    .enum([
      "swiss-editorial",
      "modern-editorial",
      "minimal-corporate",
      "tech-product",
      "premium-portfolio",
      "data-story",
      "magazine",
    ])
    .optional(),
  overrides: z
    .object({
      accent: z.string().optional(),
      bg: z.string().optional(),
      ink: z.string().optional(),
      mode: z.enum(["light", "dark"]).optional(),
    })
    .optional(),
  instruction: z.string().max(2000).optional(),
});

export const importUrlSchema = z.object({
  url: z.string().url(),
});

export const settingsSchema = z.object({
  provider: z.enum(["local", "openai", "anthropic", "openrouter"]),
  model: z.string().max(120),
  baseUrl: z.string().max(300).optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
