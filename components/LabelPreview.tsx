"use client";

import { ptToMm, type SheetSpec } from "@/lib/label-layout";
import type { LabelContent } from "@/lib/label-render";

interface LabelPreviewProps {
  spec: SheetSpec;
  content: LabelContent;
  /** Facteur d'agrandissement à l'écran (px par mm). */
  pxPerMm?: number;
}

/**
 * Aperçu d'une étiquette à l'échelle, construit à partir des **mêmes**
 * primitives que le PDF : ce qui est affiché est ce qui sera imprimé.
 */
export function LabelPreview({
  spec,
  content,
  pxPerMm = 8,
}: LabelPreviewProps) {
  return (
    <svg
      role="img"
      aria-label="Aperçu de l'étiquette"
      width={spec.labelWidthMm * pxPerMm}
      height={spec.labelHeightMm * pxPerMm}
      viewBox={`0 0 ${spec.labelWidthMm} ${spec.labelHeightMm}`}
      className="rounded-xs border border-dashed border-stone-300 bg-white"
    >
      {content.bars.map((bar, index) => (
        <rect
          key={index}
          x={bar.xMm}
          y={bar.yMm}
          width={bar.widthMm}
          height={bar.heightMm}
          fill="#000"
          shapeRendering="crispEdges"
        />
      ))}
      {content.texts.map((text, index) => (
        <text
          key={index}
          x={text.xMm}
          y={text.baselineYMm}
          fontSize={ptToMm(text.sizePt)}
          fontFamily="Helvetica, Arial, sans-serif"
          fontWeight={text.bold ? 700 : 400}
          textLength={text.widthMm}
          lengthAdjust="spacingAndGlyphs"
          fill="#000"
        >
          {text.text}
        </text>
      ))}
    </svg>
  );
}
