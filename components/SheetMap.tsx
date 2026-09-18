"use client";

import {
  A4_MM,
  labelSlot,
  labelsPerSheet,
  type SheetSpec,
} from "@/lib/label-layout";

interface SheetMapProps {
  spec: SheetSpec;
  /** Index 0-based de la première étiquette imprimée. */
  startIndex: number;
  count: number;
  onSelectStart: (index: number) => void;
}

/**
 * Plan de la planche A4 : visualise et sélectionne les emplacements utilisés,
 * pour reprendre une planche déjà entamée.
 */
export function SheetMap({
  spec,
  startIndex,
  count,
  onSelectStart,
}: SheetMapProps) {
  const slots = Array.from({ length: labelsPerSheet(spec) }, (_, index) => ({
    index,
    rect: labelSlot(spec, index),
  }));

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${A4_MM.widthMm} ${A4_MM.heightMm}`}
      className="max-h-96 rounded-sm border border-stone-300 bg-white"
      aria-label="Plan de la planche : cliquer pour choisir la première étiquette"
    >
      {slots.map(({ index, rect }) => {
        const used = index >= startIndex && index < startIndex + count;
        return (
          <g key={index} onClick={() => onSelectStart(index)}>
            <title>{`Étiquette ${index + 1}`}</title>
            <rect
              x={rect.xMm}
              y={rect.yMm}
              width={rect.widthMm}
              height={rect.heightMm}
              className={
                used
                  ? "cursor-pointer fill-stone-800 stroke-white"
                  : "cursor-pointer fill-stone-200 stroke-white"
              }
              strokeWidth={0.4}
            />
          </g>
        );
      })}
    </svg>
  );
}
