"use client";

import {
  labelsPerSheet,
  matrixSizeMm,
  sheetGapsMm,
  sheetMarginsMm,
  type SheetSpec,
} from "@/lib/label-layout";

const fmt = (valueMm: number) =>
  valueMm.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

/**
 * Fiche du support : ses cotes et où l'acheter. Générée à partir de la
 * `SheetSpec`, donc valable telle quelle pour tout format ajouté ensuite.
 */
export function SheetSpecCard({ spec }: { spec: SheetSpec }) {
  const margins = sheetMarginsMm(spec);
  const gaps = sheetGapsMm(spec);
  const matrix = matrixSizeMm(spec);

  const rows: [string, string][] = [
    ["Étiquette", `${fmt(spec.labelWidthMm)} × ${fmt(spec.labelHeightMm)} mm`],
    [
      "Disposition",
      `${labelsPerSheet(spec)} par feuille (${spec.columns} × ${spec.rows})`,
    ],
    ["Pas", `${fmt(spec.columnPitchMm)} × ${fmt(spec.rowPitchMm)} mm`],
    ["Gouttières", `${fmt(gaps.columnGapMm)} / ${fmt(gaps.rowGapMm)} mm`],
    ["Marges", `${fmt(margins.leftMm)} / ${fmt(margins.topMm)} mm`],
    ["Matrice", `${fmt(matrix.widthMm)} × ${fmt(matrix.heightMm)} mm`],
  ];

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-xs">
      <h2 className="text-sm font-semibold tracking-wide text-stone-500 uppercase">
        Support
      </h2>
      <p className="mt-1 text-sm font-medium text-stone-900">
        {spec.reference}
      </p>
      <p className="text-xs text-stone-500">{spec.name}</p>

      <dl className="mt-3 space-y-1 text-xs">
        {rows.map(([term, value]) => (
          <div key={term} className="flex justify-between gap-3">
            <dt className="text-stone-500">{term}</dt>
            <dd className="font-mono text-stone-800">{value}</dd>
          </div>
        ))}
      </dl>

      {spec.purchase ? (
        <a
          href={spec.purchase.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 block rounded-md border border-stone-300 px-3 py-2 text-center text-sm font-medium text-stone-700 hover:bg-stone-50"
        >
          <span className="inline-flex items-center gap-1.5">
            Acheter le support
            {/* Icône « lien externe » en SVG : le caractère ↗ est rendu en
                émoji par certains navigateurs. */}
            <svg
              aria-hidden="true"
              viewBox="0 0 12 12"
              className="size-3 stroke-current"
              fill="none"
              strokeWidth={1.5}
              strokeLinecap="round"
            >
              <path d="M4.5 1.5H10.5V7.5" />
              <path d="M10.5 1.5L4 8" />
              <path d="M9 9.5v1H1.5V3h1" />
            </svg>
          </span>
          <span className="mt-0.5 block text-xs font-normal text-stone-500">
            {spec.purchase.label}
          </span>
        </a>
      ) : null}
    </section>
  );
}
