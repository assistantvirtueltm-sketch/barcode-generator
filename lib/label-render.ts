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
import { xDimensionRule } from "./x-dimension";

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
  /** Plancher de lisibilité de la symbologie. */
  minimumModuleMm: number;
  /** Grossissement par rapport à la X-dimension visée (1 = 100 %). */
  magnification: number;
  /**
   * Les barres sont plus fines que le plancher : le code ne sera pas lu de
   * façon fiable, quelle que soit la qualité de l'encodage. La génération du
   * PDF le refuse (voir `lib/pdf.ts`).
   */
  belowMinimum: boolean;
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
  /** Imprimer le libellé au-dessus des barres (défaut : oui). */
  showName?: boolean;
  /** Imprimer la ligne lisible sous les barres (défaut : oui). */
  showHumanReadable?: boolean;
}

export function buildLabelContent({
  spec,
  pattern,
  name,
  humanReadable,
  measure,
  showName = true,
  showHumanReadable = true,
}: BuildLabelContentInput): LabelContent {
  const style = LABEL_STYLE;
  const warnings: string[] = [];

  const innerWidthMm = spec.labelWidthMm - 2 * style.paddingXMm;
  const innerHeightMm = spec.labelHeightMm - 2 * style.paddingYMm;

  // Chaque bande masquée rend sa hauteur aux barres : en mode « code-barres
  // seul », elles occupent toute la hauteur utile de l'étiquette.
  const hasName = showName && name.trim().length > 0;
  const hasHumanReadable = showHumanReadable && humanReadable.trim().length > 0;
  const nameBandMm = hasName ? style.nameBandMm : 0;
  const gapNameMm = hasName ? style.gapNameBarcodeMm : 0;
  const digitsBandMm = hasHumanReadable ? style.digitsBandMm : 0;
  const gapDigitsMm = hasHumanReadable ? style.gapBarcodeDigitsMm : 0;
  const barsHeightMm =
    innerHeightMm - nameBandMm - gapNameMm - gapDigitsMm - digitsBandMm;

  if (barsHeightMm <= 0) {
    throw new Error(
      "Mise en page impossible : la hauteur d'étiquette ne laisse pas de place aux barres.",
    );
  }

  // X-dimension. Le plancher dépend de la symbologie : comparer un Code 128 au
  // nominal EAN n'a pas de sens.
  //
  // Les zones de silence ne sont PAS prélevées sur la largeur imprimable :
  // elles sont assurées par le papier blanc autour des barres. Les planches
  // étant mono-produit, l'impression la plus proche à droite d'un code est le
  // code de l'étiquette voisine, à un pas de distance — le blanc intermédiaire
  // sert de zone de silence aux deux. Deux contraintes, donc :
  //   1. les barres tiennent dans la zone imprimable (marges de sécurité
  //      comprises, pour absorber la dérive d'impression et la tolérance de
  //      découpe) ;
  //   2. le blanc jusqu'au code voisin couvre la zone de silence normative.
  const rule = xDimensionRule(pattern.symbology);
  const maxQuietModules = Math.max(
    pattern.quietLeftModules,
    pattern.quietRightModules,
  );
  const moduleMm = Math.min(
    rule.targetMm,
    innerWidthMm / pattern.totalModules,
    spec.columnPitchMm / (pattern.totalModules + maxQuietModules),
  );
  const magnification = moduleMm / rule.targetMm;
  const belowMinimum = moduleMm < rule.minimumMm;

  if (belowMinimum) {
    const mesure = rule.hasMagnification
      ? `${moduleMm.toFixed(3)} mm, ${Math.round(magnification * 100)} % du nominal`
      : `${moduleMm.toFixed(3)} mm`;
    warnings.push(
      `Code trop dense pour cette étiquette : barres de ${mesure}, sous le plancher de ${rule.minimumMm.toFixed(3)} mm (${rule.reference}). Raccourcir le code, ou utiliser un support plus large.`,
    );
  }

  // Les barres sont centrées sur l'étiquette : le blanc restant se répartit
  // également de part et d'autre et alimente les zones de silence.
  const barsWidthMm = pattern.totalModules * moduleMm;
  const barsXMm = (spec.labelWidthMm - barsWidthMm) / 2;

  // Par construction, les bandes remplissent exactement la hauteur utile :
  // titre + barres + chiffres = innerHeightMm.
  const barsTopMm = style.paddingYMm + nameBandMm + gapNameMm;

  const bars: LabelRect[] = pattern.bars.map((bar) => ({
    xMm: barsXMm + bar.xModules * moduleMm,
    yMm: barsTopMm,
    widthMm: bar.widthModules * moduleMm,
    heightMm: barsHeightMm,
  }));

  if (!hasHumanReadable && pattern.symbology !== "code128") {
    warnings.push(
      "Ligne lisible masquée : sur un EAN/UPC destiné à la vente, cette mention est normative. Acceptable pour un usage interne.",
    );
  }

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

  if (hasHumanReadable) {
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
      baselineYMm: barsTopMm + barsHeightMm + gapDigitsMm + digitsBandMm - 0.5,
      sizePt: fitted.sizePt,
      text: fitted.text,
      bold: false,
      widthMm: fitted.widthMm,
    });
  }

  return {
    bars,
    texts,
    moduleMm,
    minimumModuleMm: rule.minimumMm,
    magnification,
    belowMinimum,
    warnings,
  };
}
