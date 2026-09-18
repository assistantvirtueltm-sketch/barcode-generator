/**
 * Contenu d'une étiquette, en primitives de dessin (rectangles + textes)
 * exprimées en millimètres depuis le coin haut-gauche de l'étiquette.
 *
 * Module pur et unique source de vérité de la mise en page : il alimente à la
 * fois le PDF (`lib/pdf.ts`) et l'aperçu SVG de l'UI, ce qui garantit que ce que
 * l'on voit à l'écran est exactement ce qui sera imprimé.
 */
import type { BarPattern } from "./barcode-modules";
import { LABEL_STYLE, ptToMm, type SheetSpec } from "./label-layout";

/** Largeur d'un texte en points, à la taille et à la graisse demandées. */
export type MeasureText = (
  text: string,
  sizePt: number,
  bold: boolean,
) => number;

export interface LabelRect {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

export interface LabelText {
  /** Bord gauche du texte. */
  xMm: number;
  /** Ligne de base du texte (et non son sommet). */
  baselineYMm: number;
  sizePt: number;
  text: string;
  bold: boolean;
  /** Largeur mesurée du texte : l'aperçu s'en sert pour coller au PDF. */
  widthMm: number;
}

export interface LabelContent {
  /** Barres noires à remplir. */
  bars: readonly LabelRect[];
  texts: readonly LabelText[];
  /** X-dimension retenue. */
  moduleMm: number;
  /** Grossissement par rapport à la X-dimension nominale (1 = 100 %). */
  magnification: number;
  warnings: readonly string[];
}

function fitFontSize(
  text: string,
  maxWidthMm: number,
  maxPt: number,
  minPt: number,
  bold: boolean,
  measure: MeasureText,
): { sizePt: number; text: string; widthMm: number } {
  for (let sizePt = maxPt; sizePt >= minPt; sizePt -= 0.25) {
    const widthMm = ptToMm(measure(text, sizePt, bold));
    if (widthMm <= maxWidthMm) return { sizePt, text, widthMm };
  }
  // Toujours trop large à la taille minimale : on tronque au caractère près.
  let truncated = text;
  while (truncated.length > 1) {
    truncated = truncated.slice(0, -1);
    const candidate = `${truncated.trimEnd()}…`;
    const widthMm = ptToMm(measure(candidate, minPt, bold));
    if (widthMm <= maxWidthMm) {
      return { sizePt: minPt, text: candidate, widthMm };
    }
  }
  return {
    sizePt: minPt,
    text: "…",
    widthMm: ptToMm(measure("…", minPt, bold)),
  };
}

export interface BuildLabelContentInput {
  spec: SheetSpec;
  pattern: BarPattern;
  /** Libellé produit imprimé au-dessus des barres (peut être vide). */
  name: string;
  /** Chaîne lisible imprimée sous les barres. */
  humanReadable: string;
  measure: MeasureText;
}

export function buildLabelContent({
  spec,
  pattern,
  name,
  humanReadable,
  measure,
}: BuildLabelContentInput): LabelContent {
  const style = LABEL_STYLE;
  const warnings: string[] = [];

  const innerWidthMm = spec.labelWidthMm - 2 * style.paddingXMm;
  const innerHeightMm = spec.labelHeightMm - 2 * style.paddingYMm;

  const hasName = name.trim().length > 0;
  const nameBandMm = hasName ? style.nameBandMm : 0;
  const gapNameMm = hasName ? style.gapNameBarcodeMm : 0;
  const barsHeightMm =
    innerHeightMm -
    nameBandMm -
    gapNameMm -
    style.gapBarcodeDigitsMm -
    style.digitsBandMm;

  if (barsHeightMm <= 0) {
    throw new Error(
      "Mise en page impossible : la hauteur d'étiquette ne laisse pas de place aux barres.",
    );
  }

  // X-dimension : nominale si elle rentre, sinon réduite pour que le code et
  // ses zones de silence tiennent dans la largeur utile.
  const totalWithQuietModules =
    pattern.totalModules + pattern.quietLeftModules + pattern.quietRightModules;
  const moduleMm = Math.min(
    style.nominalModuleMm,
    innerWidthMm / totalWithQuietModules,
  );
  const magnification = moduleMm / style.nominalModuleMm;

  if (moduleMm < style.thinModuleWarnMm) {
    warnings.push(
      `Barres très fines (${moduleMm.toFixed(3)} mm, ${Math.round(magnification * 100)} % du nominal) : vérifier la lecture avant d'imprimer une planche entière.`,
    );
  }

  const blockWidthMm = totalWithQuietModules * moduleMm;
  const blockXMm = (spec.labelWidthMm - blockWidthMm) / 2;
  const barsXMm = blockXMm + pattern.quietLeftModules * moduleMm;

  // Par construction, les bandes remplissent exactement la hauteur utile :
  // titre + barres + chiffres = innerHeightMm.
  const barsTopMm = style.paddingYMm + nameBandMm + gapNameMm;

  const bars: LabelRect[] = pattern.bars.map((bar) => ({
    xMm: barsXMm + bar.xModules * moduleMm,
    yMm: barsTopMm,
    widthMm: bar.widthModules * moduleMm,
    heightMm: barsHeightMm,
  }));

  const texts: LabelText[] = [];

  if (hasName) {
    const fitted = fitFontSize(
      name.trim(),
      innerWidthMm,
      style.nameMaxPt,
      style.nameMinPt,
      true,
      measure,
    );
    if (fitted.text !== name.trim()) {
      warnings.push("Libellé tronqué pour tenir sur l'étiquette.");
    }
    texts.push({
      xMm: (spec.labelWidthMm - fitted.widthMm) / 2,
      // Ligne de base posée au bas de la bande de titre.
      baselineYMm: style.paddingYMm + nameBandMm - 0.4,
      sizePt: fitted.sizePt,
      text: fitted.text,
      bold: true,
      widthMm: fitted.widthMm,
    });
  }

  if (humanReadable.trim().length > 0) {
    const fitted = fitFontSize(
      humanReadable,
      innerWidthMm,
      style.digitsMaxPt,
      style.digitsMinPt,
      false,
      measure,
    );
    texts.push({
      xMm: (spec.labelWidthMm - fitted.widthMm) / 2,
      baselineYMm:
        barsTopMm + barsHeightMm + style.gapBarcodeDigitsMm + style.digitsBandMm - 0.5,
      sizePt: fitted.sizePt,
      text: fitted.text,
      bold: false,
      widthMm: fitted.widthMm,
    });
  }

  return { bars, texts, moduleMm, magnification, warnings };
}
