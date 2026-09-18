/**
 * Géométrie de la planche d'étiquettes — SOURCE UNIQUE des cotes.
 *
 * Toutes les dimensions sont exprimées en millimètres et converties en points
 * PDF au dernier moment (voir `mmToPt`). Aucune position ne doit être écrite en
 * dur ailleurs dans le code : une erreur de 1 mm décale toute la planche et rend
 * le support papier inutilisable.
 *
 * Une planche est décrite par son **pas** (distance entre deux étiquettes
 * consécutives, cote réelle du massicot), pas par sa gouttière : c'est ainsi que
 * les fabricants spécifient leurs supports, et la gouttière s'en déduit. La
 * matrice est centrée sur la page, d'où des marges calculées plutôt que saisies.
 */

export const MM_PER_INCH = 25.4;
export const PT_PER_INCH = 72;

/** Millimètres → points PostScript (unité de pdf-lib). */
export function mmToPt(valueMm: number): number {
  return (valueMm * PT_PER_INCH) / MM_PER_INCH;
}

export const A4_MM = { widthMm: 210, heightMm: 297 } as const;

export interface SheetSpec {
  id: string;
  /** Libellé affiché dans l'UI. */
  name: string;
  /** Référence commerciale du support. */
  reference: string;
  labelWidthMm: number;
  labelHeightMm: number;
  columns: number;
  rows: number;
  /** Pas horizontal : bord gauche d'une étiquette au bord gauche de la suivante. */
  columnPitchMm: number;
  /** Pas vertical : bord haut d'une étiquette au bord haut de la suivante. */
  rowPitchMm: number;
  /** Marges imposées, si le support n'est pas centré sur la page. */
  marginLeftMm?: number;
  marginTopMm?: number;
}

/**
 * Apli / Agipa réf. 118990 — 65 étiquettes de 38 × 21,2 mm par feuille A4.
 *
 * Cotes relevées dans le gabarit Word du fabricant
 * (`docs/apli-118990-gabarit.doc`, cf. `docs/apli-118990-gabarit.md`) :
 * les étiquettes sont **jointives**, sans aucune gouttière, et la matrice de
 * 190 × 275,6 mm est centrée sur la feuille — ce qui redonne exactement les
 * marges du gabarit, 10,0 mm à gauche et 10,707 mm en haut.
 *
 * Ne pas confondre avec la matrice Avery L7651 (même 38 × 21,2 mm, mais pas de
 * 40,6 mm avec gouttières de 2,6 mm) : ce pas décale les colonnes extérieures
 * de 5 mm et les fait déborder du support.
 */
export const APLI_118990: SheetSpec = {
  id: "apli-118990",
  name: "65 étiquettes 38 × 21,2 mm (A4)",
  reference: "Apli/Agipa 118990",
  labelWidthMm: 38,
  labelHeightMm: 21.2,
  columns: 5,
  rows: 13,
  columnPitchMm: 38,
  rowPitchMm: 21.2,
};

export const SHEET_SPECS: readonly SheetSpec[] = [APLI_118990];

export function labelsPerSheet(spec: SheetSpec): number {
  return spec.columns * spec.rows;
}

/** Encombrement de la matrice d'étiquettes (hors marges). */
export function matrixSizeMm(spec: SheetSpec): {
  widthMm: number;
  heightMm: number;
} {
  return {
    widthMm: (spec.columns - 1) * spec.columnPitchMm + spec.labelWidthMm,
    heightMm: (spec.rows - 1) * spec.rowPitchMm + spec.labelHeightMm,
  };
}

/**
 * Marges du support : celles déclarées par la planche, sinon celles qui
 * découlent du centrage de la matrice sur la page.
 */
export function sheetMarginsMm(spec: SheetSpec): {
  leftMm: number;
  topMm: number;
} {
  const matrix = matrixSizeMm(spec);
  return {
    leftMm: spec.marginLeftMm ?? (A4_MM.widthMm - matrix.widthMm) / 2,
    topMm: spec.marginTopMm ?? (A4_MM.heightMm - matrix.heightMm) / 2,
  };
}

/** Gouttières déduites du pas — utile à l'affichage, jamais au calcul. */
export function sheetGapsMm(spec: SheetSpec): {
  columnGapMm: number;
  rowGapMm: number;
} {
  return {
    columnGapMm: spec.columnPitchMm - spec.labelWidthMm,
    rowGapMm: spec.rowPitchMm - spec.labelHeightMm,
  };
}

/** Décalage global d'impression, pour compenser la dérive d'une imprimante. */
export interface PrintOffsetMm {
  xMm: number;
  yMm: number;
}

export const NO_OFFSET: PrintOffsetMm = { xMm: 0, yMm: 0 };

/**
 * Rectangle exprimé depuis le coin **haut-gauche** de la page (sens de lecture),
 * converti vers le repère bas-gauche de PDF par `lib/pdf.ts`.
 */
export interface RectMm {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

/**
 * Emplacement de la n-ième étiquette (0 = en haut à gauche), remplissage
 * ligne par ligne, de gauche à droite.
 */
export function labelSlot(
  spec: SheetSpec,
  index: number,
  offset: PrintOffsetMm = NO_OFFSET,
): RectMm {
  const perSheet = labelsPerSheet(spec);
  if (!Number.isInteger(index) || index < 0 || index >= perSheet) {
    throw new RangeError(
      `index d'étiquette hors planche : ${index} (0..${perSheet - 1})`,
    );
  }
  const margins = sheetMarginsMm(spec);
  const column = index % spec.columns;
  const row = Math.floor(index / spec.columns);
  return {
    xMm: margins.leftMm + column * spec.columnPitchMm + offset.xMm,
    yMm: margins.topMm + row * spec.rowPitchMm + offset.yMm,
    widthMm: spec.labelWidthMm,
    heightMm: spec.labelHeightMm,
  };
}

/**
 * Contrôle que les cotes tiennent dans une A4. `slack` est l'espace restant à
 * droite / en bas une fois la dernière étiquette posée. Sert de garde-fou en
 * test : sur un support centré, il doit valoir la marge opposée.
 */
export function sheetFitReport(spec: SheetSpec): {
  usedWidthMm: number;
  usedHeightMm: number;
  slackRightMm: number;
  slackBottomMm: number;
  fits: boolean;
} {
  const margins = sheetMarginsMm(spec);
  const matrix = matrixSizeMm(spec);
  const usedWidthMm = margins.leftMm + matrix.widthMm;
  const usedHeightMm = margins.topMm + matrix.heightMm;
  const slackRightMm = A4_MM.widthMm - usedWidthMm;
  const slackBottomMm = A4_MM.heightMm - usedHeightMm;
  return {
    usedWidthMm,
    usedHeightMm,
    slackRightMm,
    slackBottomMm,
    fits: slackRightMm >= -1e-9 && slackBottomMm >= -1e-9,
  };
}

/** Points PostScript → millimètres. */
export function ptToMm(valuePt: number): number {
  return (valuePt * MM_PER_INCH) / PT_PER_INCH;
}

/**
 * Mise en page interne d'une étiquette. Les bandes sont empilées du haut vers
 * le bas ; la hauteur restante va aux barres.
 */
export const LABEL_STYLE = {
  paddingXMm: 1.5,
  paddingYMm: 1.2,
  nameBandMm: 3.2,
  gapNameBarcodeMm: 0.6,
  gapBarcodeDigitsMm: 0.5,
  digitsBandMm: 2.6,
  nameMaxPt: 7,
  nameMinPt: 4.5,
  digitsMaxPt: 6.5,
  digitsMinPt: 4,
  /** X-dimension nominale d'un EAN-13 à 100 % de grossissement. */
  nominalModuleMm: 0.33,
  /** Sous ce seuil, les barres deviennent risquées à l'impression jet d'encre. */
  thinModuleWarnMm: 0.25,
} as const;
