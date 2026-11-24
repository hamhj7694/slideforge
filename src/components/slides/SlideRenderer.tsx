"use client";

import * as React from "react";
import type { JSX } from "react";
import { designCssVars } from "@/lib/design";
import type {
  DesignSystem,
  LayoutSpec,
  Slide,
  SlideImage,
  SlideSection,
  StructuredContent,
} from "@/lib/types";
import "./slides.css";

export interface SlideRenderProps {
  slide: Slide;
  design: DesignSystem;
  index: number; // 0-based
  total: number;
  editable?: boolean; // default false
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onTextChange?: (elementId: string, fieldPath: string, value: string) => void;
  onImageChange?: (elementId: string, url: string) => void;
}

type SelectHandler = NonNullable<SlideRenderProps["onSelect"]>;
type TextChangeHandler = NonNullable<SlideRenderProps["onTextChange"]>;
type ImageChangeHandler = NonNullable<SlideRenderProps["onImageChange"]>;
type TextTag =
  | "span"
  | "div"
  | "p"
  | "h1"
  | "h2"
  | "h3"
  | "blockquote"
  | "li"
  | "td"
  | "th";

const EMPTY_CONTENT: StructuredContent = { title: "" };
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const EMPTY_HINT = "내용을 입력하세요";

const pad = (n: number): string => String(n).padStart(2, "0");

interface EditableProps {
  id: string;
  path: string;
  text?: string;
  as?: TextTag;
  className?: string;
  style?: React.CSSProperties;
  editable: boolean;
  selectedId?: string | null;
  onSelect?: SelectHandler;
  onTextChange?: TextChangeHandler;
  placeholder?: string;
}

/** A single text node. In print mode this is plain text: no contentEditable, no handles. */
function Editable({
  id,
  path,
  text,
  as,
  className,
  style,
  editable,
  selectedId,
  onSelect,
  onTextChange,
  placeholder,
}: EditableProps): JSX.Element {
  const value = text ?? "";
  const canEdit = editable && !!onTextChange;
  const classes = [
    "sf-txt",
    className,
    editable && selectedId === id ? "sf-selected" : "",
    editable && !value ? "sf-empty" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const props: Record<string, unknown> = {
    "data-el": id,
    className: classes,
    style,
    onClick: editable
      ? (event: React.MouseEvent<HTMLElement>) => {
          event.stopPropagation();
          onSelect?.(id);
        }
      : undefined,
  };

  if (canEdit) {
    props.contentEditable = true;
    props.suppressContentEditableWarning = true;
    props.spellCheck = false;
    props["data-placeholder"] = placeholder ?? EMPTY_HINT;
    props.onBlur = (event: React.FocusEvent<HTMLElement>) => {
      const next = event.currentTarget.textContent ?? "";
      if (next !== value) onTextChange?.(id, path, next);
    };
  }

  const Tag = (as ?? "span") as React.ElementType;
  return React.createElement(Tag, props, value);
}

interface ImageNodeProps {
  id: string;
  image?: SlideImage;
  captionPath?: string;
  className?: string;
  style?: React.CSSProperties;
  editable: boolean;
  selectedId?: string | null;
  onSelect?: SelectHandler;
  onImageChange?: ImageChangeHandler;
  onTextChange?: TextChangeHandler;
}

function ImageNode({
  id,
  image,
  captionPath,
  className,
  style,
  editable,
  selectedId,
  onSelect,
  onImageChange,
  onTextChange,
}: ImageNodeProps): JSX.Element {
  const [failed, setFailed] = React.useState(false);
  const url = (image?.url ?? "").trim();

  React.useEffect(() => {
    setFailed(false);
  }, [url]);

  const showPlaceholder = !url || failed;
  const classes = [
    "sf-image",
    editable && selectedId === id ? "sf-selected" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const promptChange = (): void => {
    if (!onImageChange) return;
    const next = window.prompt("이미지 URL을 입력하세요", url) || "";
    onImageChange(id, next);
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (!editable) return;
    event.stopPropagation();
    onSelect?.(id);
    if (
      onImageChange &&
      (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
    ) {
      promptChange();
    }
  };

  return (
    <div data-el={id} className={classes} style={style} onClick={handleClick}>
      {showPlaceholder ? (
        <div className="sf-image-placeholder" aria-hidden="true">
          {editable && <span className="sf-image-placeholder-label">이미지</span>}
        </div>
      ) : (
        <img
          src={url}
          alt={image?.alt ?? ""}
          style={{ objectFit: image?.fit ?? "cover" }}
          onError={() => setFailed(true)}
          draggable={false}
        />
      )}

      {editable && onImageChange && (
        <button
          type="button"
          className="sf-image-change"
          onClick={(event) => {
            event.stopPropagation();
            promptChange();
          }}
        >
          이미지 변경
        </button>
      )}

      {image && (image.caption || editable) && captionPath && (
        <span className="sf-image-caption">
          <Editable
            key={`${id}-caption-${image.caption ?? ""}`}
            id={`${id}-caption`}
            path={captionPath}
            text={image.caption}
            editable={editable}
            selectedId={selectedId}
            onSelect={onSelect}
            onTextChange={onTextChange}
          />
        </span>
      )}
    </div>
  );
}

export function SlideRenderer({
  slide,
  design,
  index,
  total,
  editable = false,
  selectedId = null,
  onSelect,
  onTextChange,
  onImageChange,
}: SlideRenderProps): JSX.Element {
  const content = slide?.content ?? EMPTY_CONTENT;
  const layout: LayoutSpec = slide?.layout ?? { kind: "cover" };
  const overrides = slide?.visualOverrides ?? {};
  const showFooter = design.details.footer && slide?.layout?.showFooter !== false;

  /** Layout-only adjustments; never carries text. */
  function overrideStyle(id: string): React.CSSProperties {
    const o = overrides[id];
    if (!o) return {};
    const style: React.CSSProperties = {};
    if (o.x !== undefined || o.y !== undefined) {
      style.transform = `translate(${o.x ?? 0}px, ${o.y ?? 0}px)`;
    }
    if (o.width !== undefined) style.width = o.width;
    if (o.height !== undefined) style.height = o.height;
    if (o.z !== undefined) style.zIndex = o.z;
    if (o.hidden) style.display = "none";
    return style;
  }

  function T(
    id: string,
    path: string,
    text: string | undefined,
    extra: Partial<
      Pick<EditableProps, "as" | "className" | "style" | "placeholder">
    > = {},
  ): JSX.Element {
    return (
      <Editable
        key={`${id}-${text ?? ""}`}
        id={id}
        path={path}
        text={text}
        editable={editable}
        selectedId={selectedId}
        onSelect={onSelect}
        onTextChange={onTextChange}
        {...extra}
      />
    );
  }

  function nodeProps(id: string, className = ""): {
    "data-el": string;
    className: string;
    onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  } {
    return {
      "data-el": id,
      className: [className, editable && selectedId === id ? "sf-selected" : ""]
        .filter(Boolean)
        .join(" "),
      onClick: editable
        ? (event: React.MouseEvent<HTMLElement>) => {
            event.stopPropagation();
            onSelect?.(id);
          }
        : undefined,
    };
  }

  function Img(
    id: string,
    image: SlideImage | undefined,
    className: string,
    captionPath?: string,
    style?: React.CSSProperties,
  ): JSX.Element {
    return (
      <ImageNode
        key={`${id}-${image?.url ?? ""}`}
        id={id}
        image={image}
        captionPath={captionPath}
        className={className}
        style={{ ...style, ...overrideStyle(id) }}
        editable={editable}
        selectedId={selectedId}
        onSelect={onSelect}
        onImageChange={onImageChange}
        onTextChange={onTextChange}
      />
    );
  }

  function Tags(): JSX.Element | null {
    const tags = content.tags?.length ? content.tags : editable ? [""] : [];
    if (!tags.length) return null;
    return (
      <div className="sf-tags">
        {tags.map((tag, i) => (
          <span className="sf-tag" key={`tag-wrap-${i}`}>
            {T(`tag-${i}`, `tags.${i}`, tag)}
          </span>
        ))}
      </div>
    );
  }

  function Header({ className = "" }: { className?: string }): JSX.Element {
    return (
      <header className={`sf-head ${className}`}>
        {T("title", "title", content.title, { as: "h1", className: "sf-title" })}
        {T("lede", "lede", content.lede, { as: "p", className: "sf-lede" })}
      </header>
    );
  }

  function SectionColumn({
    section,
    i,
  }: {
    section: SlideSection;
    i: number;
  }): JSX.Element {
    return (
      <article className="sf-col" key={`section-col-${i}`}>
        <span className="sf-col-index" aria-hidden="true">
          {pad(i + 1)}
        </span>
        {T(`section-${i}-label`, `sections.${i}.label`, section.label, {
          className: "sf-eyebrow",
        })}
        {T(`section-${i}-heading`, `sections.${i}.heading`, section.heading, {
          as: "h3",
          className: "sf-col-heading",
        })}
        {T(`section-${i}-body`, `sections.${i}.body`, section.body, {
          as: "p",
          className: "sf-col-body",
        })}
      </article>
    );
  }

  function MetricCard({
    metric,
    i,
    compact = false,
  }: {
    metric: NonNullable<StructuredContent["metrics"]>[number];
    i: number;
    compact?: boolean;
  }): JSX.Element {
    return (
      <div className={`sf-metric ${compact ? "sf-metric-compact" : ""}`} key={`metric-card-${i}`}>
        {T(`metric-${i}-value`, `metrics.${i}.value`, metric.value, {
          as: "div",
          className: "sf-metric-value",
        })}
        {T(`metric-${i}-label`, `metrics.${i}.label`, metric.label, {
          className: "sf-metric-label",
        })}
        {metric.note !== undefined &&
          T(`metric-${i}-note`, `metrics.${i}.note`, metric.note, {
            className: "sf-metric-note",
          })}
      </div>
    );
  }

  const sections: SlideSection[] = content.sections?.length
    ? content.sections
    : editable
      ? [{}]
      : [];
  const bullets = content.bullets?.length ? content.bullets : editable ? [""] : [];
  const metrics = content.metrics?.length
    ? content.metrics
    : editable
      ? [{ value: "", label: "" }]
      : [];
  const timeline = content.timeline?.length
    ? content.timeline
    : editable
      ? [{ label: "", title: "", body: "" }]
      : [];
  const steps = content.steps?.length
    ? content.steps
    : editable
      ? [{ title: "", body: "" }]
      : [];
  const images = content.images?.length
    ? content.images
    : editable
      ? [{ url: "" }]
      : [];
  const series = content.chart?.series?.length ? content.chart.series : [];

  function renderLayout(): JSX.Element {
    switch (layout.kind) {
      /* 01 — Cover: oversized headline over a half-bleed visual. */
      case "cover":
        return (
          <div className="sf-layout sf-l-cover">
            <div className="sf-cover-main">
              <div className="sf-cover-copy">
                {T("subtitle", "subtitle", content.subtitle, {
                  className: "sf-subtitle",
                })}
                {T("title", "title", content.title, {
                  as: "h1",
                  className: "sf-title sf-title-xl",
                })}
                {T("lede", "lede", content.lede, {
                  as: "p",
                  className: "sf-lede",
                })}
                {Tags()}
              </div>
              <div className="sf-cover-visual">
                {Img("image-0", images[0], "sf-image-hero", "images.0.caption")}
              </div>
            </div>
          </div>
        );

      /* 02 — Section divider: giant index watermark and a thin accent rule. */
      case "section":
        return (
          <div className="sf-layout sf-l-section">
            <div className="sf-section-index" aria-hidden="true">
              {pad(index + 1)}
            </div>
            <div className="sf-section-copy">
              {T("subtitle", "subtitle", content.subtitle, {
                className: "sf-subtitle",
              })}
              {T("title", "title", content.title, {
                as: "h2",
                className: "sf-title sf-title-section",
              })}
              {T("lede", "lede", content.lede, {
                as: "p",
                className: "sf-lede",
              })}
              {Tags()}
            </div>
            <div className="sf-section-rule" aria-hidden="true" />
          </div>
        );

      /* 03 — Statement: single large pull-quote with attribution. */
      case "statement":
        return (
          <div className="sf-layout sf-l-statement">
            <div className="sf-quote-mark" aria-hidden="true">
              “
            </div>
            {T("title", "title", content.title, {
              as: "h2",
              className: "sf-statement-title",
            })}
            {T("quote", "quote.text", content.quote?.text, {
              as: "blockquote",
              className: "sf-quote",
            })}
            {T("quote-attribution", "quote.attribution", content.quote?.attribution, {
              className: "sf-quote-by",
            })}
          </div>
        );

      /* 04 — Split: copy and image, mirrorable via layout.imageSide. */
      case "split":
        return (
          <div
            className={`sf-layout sf-l-split ${layout.imageSide === "left" ? "sf-image-first" : ""}`}
          >
            <div className="sf-split-copy">
              {T("title", "title", content.title, {
                as: "h2",
                className: "sf-title",
              })}
              {T("lede", "lede", content.lede, {
                as: "p",
                className: "sf-lede",
              })}
              <ul className="sf-bullets">
                {bullets.map((bullet, i) => (
                  <li className="sf-bullet" key={`bullet-wrap-${i}`}>
                    <span className="sf-bullet-mark" aria-hidden="true" />
                    {T(`bullet-${i}`, `bullets.${i}`, bullet)}
                  </li>
                ))}
              </ul>
            </div>
            <div className="sf-split-visual">
              {Img("image-0", images[0], "sf-image-panel", "images.0.caption")}
            </div>
          </div>
        );

      /* 05 — Editorial three column: ruled columns with numbered sections. */
      case "editorial-3col":
        return (
          <div className="sf-layout sf-l-editorial">
            {Header({ className: "sf-head-tight" })}
            <div
              className="sf-editorial-grid"
              style={{ gridTemplateColumns: `repeat(${Math.min(sections.length || 1, 4)}, minmax(0, 1fr))` }}
            >
              {sections.map((section, i) => SectionColumn({ section, i }))}
            </div>
          </div>
        );

      /* 06 — Metrics: large numeric cards in a responsive grid. */
      case "metrics":
        return (
          <div className="sf-layout sf-l-metrics">
            {Header({})}
            <div
              className="sf-metrics-grid"
              style={{ gridTemplateColumns: `repeat(${Math.min(metrics.length || 1, 4)}, minmax(0, 1fr))` }}
            >
              {metrics.map((metric, i) => MetricCard({ metric, i }))}
            </div>
          </div>
        );

      /* 07 — Timeline: horizontal rail with events. */
      case "timeline":
        return (
          <div className="sf-layout sf-l-timeline">
            {Header({ className: "sf-head-tight" })}
            <div
              className="sf-timeline-track"
              style={{ gridTemplateColumns: `repeat(${Math.min(timeline.length || 1, 5)}, minmax(0, 1fr))` }}
            >
              {timeline.map((item, i) => (
                <div className="sf-timeline-item" key={`timeline-${i}`}>
                  <span className="sf-timeline-dot" aria-hidden="true" />
                  {T(`timeline-${i}-label`, `timeline.${i}.label`, item.label, {
                    className: "sf-timeline-label",
                  })}
                  {T(`timeline-${i}-title`, `timeline.${i}.title`, item.title, {
                    as: "h3",
                    className: "sf-timeline-title",
                  })}
                  {T(`timeline-${i}-body`, `timeline.${i}.body`, item.body, {
                    as: "p",
                    className: "sf-timeline-body",
                  })}
                </div>
              ))}
            </div>
          </div>
        );

      /* 08 — Process: numbered steps joined by arrows. */
      case "process":
        return (
          <div className="sf-layout sf-l-process">
            {Header({ className: "sf-head-tight" })}
            <div
              className="sf-steps"
              style={{ gridTemplateColumns: `repeat(${Math.min(steps.length || 1, 5)}, minmax(0, 1fr))` }}
            >
              {steps.map((step, i) => (
                <div className="sf-step" key={`step-${i}`}>
                  <span className="sf-step-num" aria-hidden="true">
                    {pad(i + 1)}
                  </span>
                  {T(`step-${i}-title`, `steps.${i}.title`, step.title, {
                    as: "h3",
                    className: "sf-step-title",
                  })}
                  {T(`step-${i}-body`, `steps.${i}.body`, step.body, {
                    as: "p",
                    className: "sf-step-body",
                  })}
                </div>
              ))}
            </div>
          </div>
        );

      /* 09 — Before / after: two opposed panels with a directional cue. */
      case "before-after": {
        const beforeItems = content.before?.items?.length
          ? content.before.items
          : editable
            ? [""]
            : [];
        const afterItems = content.after?.items?.length
          ? content.after.items
          : editable
            ? [""]
            : [];
        return (
          <div className="sf-layout sf-l-before-after">
            {Header({ className: "sf-head-tight" })}
            <div className="sf-ba-grid">
              <section className="sf-ba-panel sf-ba-before">
                {T("before-item-title", "before.title", content.before?.title, {
                  as: "h3",
                  className: "sf-ba-heading",
                })}
                <ul className="sf-ba-list">
                  {beforeItems.map((item, i) => (
                    <li key={`before-item-wrap-${i}`}>
                      {T(`before-item-${i}`, `before.items.${i}`, item)}
                    </li>
                  ))}
                </ul>
              </section>
              <div className="sf-ba-arrow" aria-hidden="true">
                →
              </div>
              <section className="sf-ba-panel sf-ba-after">
                {T("after-item-title", "after.title", content.after?.title, {
                  as: "h3",
                  className: "sf-ba-heading",
                })}
                <ul className="sf-ba-list">
                  {afterItems.map((item, i) => (
                    <li key={`after-item-wrap-${i}`}>
                      {T(`after-item-${i}`, `after.items.${i}`, item)}
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>
        );
      }

      /* 10 — Case study: asymmetric image, narrative sections, quote strip. */
      case "case-study":
        return (
          <div className="sf-layout sf-l-case">
            <div className="sf-case-copy">
              {T("title", "title", content.title, {
                as: "h1",
                className: "sf-title",
              })}
              {T("lede", "lede", content.lede, {
                as: "p",
                className: "sf-lede",
              })}
              <div className="sf-case-sections">
                {sections.map((section, i) => SectionColumn({ section, i }))}
              </div>
            </div>
            <div className="sf-case-visual">
              {Img("image-0", images[0], "sf-image-panel", "images.0.caption")}
            </div>
            <div className="sf-case-quote">
              {T("quote", "quote.text", content.quote?.text, {
                as: "blockquote",
                className: "sf-quote sf-quote-small",
              })}
            </div>
          </div>
        );

      /* 11 — Full bleed: edge-to-edge image with a legibility scrim. */
      case "fullbleed": {
        const fullImages = images.length ? images : [{ url: "" }];
        return (
          <div className="sf-fullbleed">
            {Img("image-0", fullImages[0], "sf-image-full", "images.0.caption")}
            <div className="sf-fullbleed-scrim" aria-hidden="true" />
            <div className="sf-fullbleed-copy">
              {T("title", "title", content.title, {
                as: "h1",
                className: "sf-title sf-title-xl",
              })}
              {T("subtitle", "subtitle", content.subtitle, {
                className: "sf-subtitle",
              })}
              {T("lede", "lede", content.lede, {
                as: "p",
                className: "sf-lede",
              })}
              {Tags()}
            </div>
          </div>
        );
      }

      /* 12 — Gallery: mosaic of images with captions. */
      case "gallery": {
        const galleryImages = content.images?.length
          ? content.images
          : editable
            ? [{ url: "" }, { url: "" }, { url: "" }]
            : [];
        return (
          <div className="sf-layout sf-l-gallery">
            {Header({ className: "sf-head-tight" })}
            <div
              className="sf-gallery-grid"
              style={{ gridTemplateColumns: galleryImages.length > 2 ? "1.25fr 1fr 1fr" : "1fr 1fr" }}
            >
              {galleryImages.map((image, i) => (
                <figure className="sf-gallery-item" key={`image-wrap-${i}`}>
                  {Img(`image-${i}`, image, "sf-image-tile", `images.${i}.caption`)}
                </figure>
              ))}
            </div>
          </div>
        );
      }

      /* 13 — Table: semantic table with editable headers and cells. */
      case "table": {
        const table = content.table;
        const columns = table?.columns ?? [];
        const rows = table?.rows ?? [];
        return (
          <div className="sf-layout sf-l-table">
            {Header({ className: "sf-head-tight" })}
            {table ? (
              <div className="sf-table-wrap">
                <table {...nodeProps("table", "sf-table")}>
                  <thead>
                    <tr>
                      {columns.map((column, i) => (
                        <th scope="col" key={`table-col-wrap-${i}`}>
                          {T(`table-col-${i}`, `table.columns.${i}`, column)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, r) => (
                      <tr key={`table-row-${r}`}>
                        {columns.map((_, col) => (
                          <td key={`table-cell-wrap-${r}-${col}`}>
                            {T(
                              `table-row-${r}-cell-${col}`,
                              `table.rows.${r}.${col}`,
                              row[col] ?? "",
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {table.note !== undefined &&
                  T("table-note", "table.note", table.note, {
                    className: "sf-table-note",
                  })}
              </div>
            ) : editable ? (
              <div className="sf-table-empty sf-empty" data-placeholder={EMPTY_HINT} />
            ) : null}
          </div>
        );
      }

      /* 14 — Data story: CSS bar chart paired with narrative metrics. */
      case "data-story": {
        const max = Math.max(1, ...series.map((point) => Math.abs(point.value)));
        return (
          <div className="sf-layout sf-l-data-story">
            {Header({ className: "sf-head-tight" })}
            {(series.length > 0 || editable) && (
              <div className="sf-data-grid">
                <div {...nodeProps("chart", "sf-chart")}>
                  {T("chart-title", "chart.title", content.chart?.title, {
                    as: "h3",
                    className: "sf-chart-title",
                  })}
                  <div className="sf-chart-bars">
                    {series.map((point, i) => {
                      const pct = Math.max(4, Math.round((Math.abs(point.value) / max) * 100));
                      return (
                        <div className="sf-chart-col" key={`chart-col-${i}`}>
                          <span className="sf-chart-value">
                            {point.value}
                            {content.chart?.unit ?? ""}
                          </span>
                          <div className="sf-chart-bar-track">
                            <div className="sf-chart-bar" style={{ height: `${pct}%` }} />
                          </div>
                          {T(`chart-label-${i}`, `chart.series.${i}.label`, point.label, {
                            className: "sf-chart-label",
                          })}
                        </div>
                      );
                    })}
                    {series.length === 0 && editable && (
                      <div className="sf-chart-empty sf-empty" data-placeholder={EMPTY_HINT} />
                    )}
                  </div>
                  {content.chart?.note !== undefined &&
                    T("chart-note", "chart.note", content.chart.note, {
                      className: "sf-chart-note",
                    })}
                </div>
                <div className="sf-data-side">
                  {metrics.map((metric, i) => MetricCard({ metric, i, compact: true }))}
                  {content.quote?.text &&
                    T("quote", "quote.text", content.quote.text, {
                      as: "blockquote",
                      className: "sf-data-quote",
                    })}
                </div>
              </div>
            )}
          </div>
        );
      }

      /* 15 — Closing: quiet, centered sign-off. */
      case "closing":
      default:
        return (
          <div className="sf-layout sf-l-closing">
            <div className="sf-closing-rule" aria-hidden="true" />
            {T("subtitle", "subtitle", content.subtitle, {
              className: "sf-subtitle",
            })}
            {T("title", "title", content.title, {
              as: "h1",
              className: "sf-title sf-title-closing",
            })}
            {T("lede", "lede", content.lede, {
              as: "p",
              className: "sf-lede",
            })}
            {Tags()}
            <div className="sf-closing-mark" aria-hidden="true">
              ●
            </div>
          </div>
        );
    }
  }

  const rootStyle = {
    ...designCssVars(design),
    "--sf-columns": String(design.grid.columns),
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    position: "relative",
    overflow: "hidden",
    background: "var(--sf-bg)",
    color: "var(--sf-ink)",
    fontFamily: "var(--sf-body)",
  } as React.CSSProperties;

  return (
    <div
      className={`slide-canvas style-${design.preset}`}
      data-slide-id={slide.id}
      data-slide-ready="true"
      data-preset={design.preset}
      data-motif={design.motif ?? ""}
      data-layout={layout.kind}
      data-image-treatment={design.image.treatment}
      data-mode={design.mode}
      data-has-footer={showFooter ? "true" : "false"}
      style={rootStyle}
    >
      {!showFooter && (
        <div className="sf-kicker-rail">
          {T("kicker", "kicker", content.kicker, { className: "sf-kicker" })}
        </div>
      )}

      {renderLayout()}

      {(editable || !!content.footnote) && (
        <div className="sf-footnote-wrap">
          {T("footnote", "footnote", content.footnote, {
            className: "sf-footnote-text",
          })}
        </div>
      )}

      {showFooter && (
        <footer className="sf-foot">
          <span className="sf-foot-left">
            {T("kicker", "kicker", content.kicker, { className: "sf-kicker" })}
          </span>
          <span className="sf-page">{index + 1} / {total}</span>
        </footer>
      )}
    </div>
  );
}

/** Korean human-readable labels for the stable element ids used by the node panel. */
export function elementLabel(id: string): string {
  const exact: Record<string, string> = {
    title: "제목",
    subtitle: "소제목",
    kicker: "키커",
    lede: "리드문",
    quote: "인용문",
    "quote-attribution": "인용 출처",
    table: "테이블",
    "table-note": "테이블 참고",
    chart: "차트",
    "chart-title": "차트 제목",
    "chart-note": "차트 참고",
    footnote: "각주",
    "before-item-title": "Before 제목",
    "after-item-title": "After 제목",
  };
  if (exact[id]) return exact[id];

  const n = (value: string): string => pad(Number(value) + 1);
  const rules: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/^section-(\d+)-heading$/, (m) => `섹션 ${n(m[1])} 제목`],
    [/^section-(\d+)-body$/, (m) => `섹션 ${n(m[1])} 본문`],
    [/^section-(\d+)-label$/, (m) => `섹션 ${n(m[1])} 라벨`],
    [/^bullet-(\d+)$/, (m) => `불릿 ${n(m[1])}`],
    [/^metric-(\d+)-value$/, (m) => `지표 ${n(m[1])} 값`],
    [/^metric-(\d+)-label$/, (m) => `지표 ${n(m[1])} 라벨`],
    [/^metric-(\d+)-note$/, (m) => `지표 ${n(m[1])} 메모`],
    [/^timeline-(\d+)-label$/, (m) => `타임라인 ${n(m[1])} 날짜`],
    [/^timeline-(\d+)-title$/, (m) => `타임라인 ${n(m[1])} 제목`],
    [/^timeline-(\d+)-body$/, (m) => `타임라인 ${n(m[1])} 설명`],
    [/^step-(\d+)-title$/, (m) => `단계 ${n(m[1])} 제목`],
    [/^step-(\d+)-body$/, (m) => `단계 ${n(m[1])} 설명`],
    [/^before-item-(\d+)$/, (m) => `Before 항목 ${n(m[1])}`],
    [/^after-item-(\d+)$/, (m) => `After 항목 ${n(m[1])}`],
    [/^image-(\d+)$/, (m) => `이미지 ${n(m[1])}`],
    [/^image-(\d+)-caption$/, (m) => `이미지 ${n(m[1])} 캡션`],
    [/^tag-(\d+)$/, (m) => `태그 ${n(m[1])}`],
    [/^table-col-(\d+)$/, (m) => `테이블 열 ${n(m[1])}`],
    [/^table-row-(\d+)-cell-(\d+)$/, (m) => `테이블 ${n(m[1])}행 ${n(m[2])}열`],
    [/^chart-label-(\d+)$/, (m) => `차트 항목 ${n(m[1])}`],
  ];

  for (const [pattern, label] of rules) {
    const match = id.match(pattern);
    if (match) return label(match);
  }
  return "요소";
}
