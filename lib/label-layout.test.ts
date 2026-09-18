import { describe, expect, it } from "vitest";

import {
  A4_MM,
  APLI_118990,
  labelSlot,
  labelsPerSheet,
  mmToPt,
  ptToMm,
  sheetFitReport,
  sheetGapsMm,
  sheetMarginsMm,
} from "./label-layout";

const spec = APLI_118990;

describe("conversions", () => {
  it("convertit mm ↔ pt", () => {
    expect(mmToPt(25.4)).toBeCloseTo(72, 10);
    expect(ptToMm(72)).toBeCloseTo(25.4, 10);
    expect(ptToMm(mmToPt(38))).toBeCloseTo(38, 10);
  });
});

describe("planche Apli 118990", () => {
  it("compte 65 étiquettes", () => {
    expect(labelsPerSheet(spec)).toBe(65);
  });

  it("retrouve les cotes du gabarit du fabricant", () => {
    const margins = sheetMarginsMm(spec);
    // Marges du gabarit Word : 567 twips (10,0 mm) à gauche, 607 twips
    // (10,707 mm) en haut. Les retrouver par centrage confirme le modèle.
    expect(margins.leftMm).toBeCloseTo(10, 6);
    expect(margins.topMm).toBeCloseTo(10.7, 6);
    // Étiquettes jointives : aucune gouttière, ni horizontale ni verticale.
    const gaps = sheetGapsMm(spec);
    expect(gaps.columnGapMm).toBeCloseTo(0, 6);
    expect(gaps.rowGapMm).toBeCloseTo(0, 6);
  });

  /**
   * Bornes de colonnes et hauteur de ligne relevées dans le gabarit Word du
   * fabricant (`docs/apli-118990-gabarit.doc`) : marge gauche 567 twips, table
   * décalée de -8 twips, bornes de cellules et hauteur de ligne exacte -1202.
   * Ce test fige la seule source autoritaire des cotes.
   */
  it("colle aux bornes en twips du gabarit", () => {
    const TWIPS_PER_MM = 1440 / 25.4;
    const templateColumnsMm = [-8, 2146, 4301, 6455, 8609].map(
      (twips) => (567 + twips) / TWIPS_PER_MM,
    );
    const templateRowHeightMm = 1202 / TWIPS_PER_MM;

    expect(spec.labelHeightMm).toBeCloseTo(templateRowHeightMm, 2);
    expect(spec.rowPitchMm).toBeCloseTo(templateRowHeightMm, 2);

    templateColumnsMm.forEach((expectedXMm, column) => {
      // Tolérance de 0,2 mm : le gabarit décale la table de -8 twips
      // (0,14 mm), compensation de bordure propre au rendu des tableaux Word.
      expect(
        Math.abs(labelSlot(spec, column).xMm - expectedXMm),
      ).toBeLessThan(0.2);
    });

    // La matrice couvre 190 × 275,6 mm, comme le gabarit.
    const report = sheetFitReport(spec);
    expect(report.usedWidthMm - sheetMarginsMm(spec).leftMm).toBeCloseTo(190, 6);
    expect(report.usedHeightMm - sheetMarginsMm(spec).topMm).toBeCloseTo(
      275.6,
      6,
    );
  });

  it("tient dans une A4 avec des marges symétriques", () => {
    const report = sheetFitReport(spec);
    const margins = sheetMarginsMm(spec);
    expect(report.fits).toBe(true);
    expect(report.slackRightMm).toBeCloseTo(margins.leftMm, 6);
    expect(report.slackBottomMm).toBeCloseTo(margins.topMm, 6);
  });

  it("place la première et la dernière étiquette", () => {
    const first = labelSlot(spec, 0);
    expect(first.xMm).toBeCloseTo(10, 6);
    expect(first.yMm).toBeCloseTo(10.7, 6);
    expect(first.widthMm).toBe(38);
    expect(first.heightMm).toBe(21.2);

    const last = labelSlot(spec, 64);
    expect(last.xMm).toBeCloseTo(10 + 4 * 38, 6);
    expect(last.yMm).toBeCloseTo(10.7 + 12 * 21.2, 6);
    expect(last.xMm + last.widthMm).toBeLessThanOrEqual(A4_MM.widthMm);
    expect(last.yMm + last.heightMm).toBeLessThanOrEqual(A4_MM.heightMm);
  });

  it("remplit ligne par ligne, de gauche à droite", () => {
    const first = labelSlot(spec, 0);
    const second = labelSlot(spec, 1);
    const nextRow = labelSlot(spec, 5);
    expect(second.xMm - first.xMm).toBeCloseTo(spec.columnPitchMm, 6);
    expect(second.yMm).toBe(first.yMm);
    expect(nextRow.xMm).toBeCloseTo(first.xMm, 6);
    expect(nextRow.yMm - first.yMm).toBeCloseTo(spec.rowPitchMm, 6);
  });

  it("applique le décalage de calibration", () => {
    const base = labelSlot(spec, 0);
    const shifted = labelSlot(spec, 0, { xMm: -0.8, yMm: 1.2 });
    expect(shifted.xMm).toBeCloseTo(base.xMm - 0.8, 6);
    expect(shifted.yMm).toBeCloseTo(base.yMm + 1.2, 6);
  });

  it("refuse un index hors planche", () => {
    expect(() => labelSlot(spec, 65)).toThrow(RangeError);
    expect(() => labelSlot(spec, -1)).toThrow(RangeError);
    expect(() => labelSlot(spec, 1.5)).toThrow(RangeError);
  });
});
