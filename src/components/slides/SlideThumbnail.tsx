"use client";

import { useEffect, useRef, useState } from "react";
import type { DesignSystem, Slide } from "@/lib/types";
import { SlideRenderer } from "./SlideRenderer";

export function SlideThumbnail({
  slide,
  design,
  index,
  total,
}: {
  slide: Slide;
  design: DesignSystem;
  index: number;
  total: number;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    const update = () => setScale(node.clientWidth / 1280);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={frame}
      className="relative w-full overflow-hidden border border-line bg-white"
      style={{ aspectRatio: "16 / 9" }}
    >
      <div
        className="absolute left-0 top-0"
        style={{
          width: 1280,
          height: 720,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      >
        <SlideRenderer slide={slide} design={design} index={index} total={total} />
      </div>
    </div>
  );
}
