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

  it("retrouve les cotes publiées par le fabricant", () => {
    const margins = sheetMarginsMm(spec);
    // Marge haute publiée : 10,7 mm. La retrouver par centrage confirme que la
    // matrice est bien centrée sur la feuille.
    expect(margins.topMm).toBeCloseTo(10.7, 6);
    expect(margins.leftMm).toBeCloseTo(4.8, 6);
    const gaps = sheetGapsMm(spec);
    expect(gaps.columnGapMm).toBeCloseTo(2.6, 6);
    expect(gaps.rowGapMm).toBeCloseTo(0, 6);
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
    expect(first.xMm).toBeCloseTo(4.8, 6);
    expect(first.yMm).toBeCloseTo(10.7, 6);
    expect(first.widthMm).toBe(38);
    expect(first.heightMm).toBe(21.2);

    const last = labelSlot(spec, 64);
    expect(last.xMm).toBeCloseTo(4.8 + 4 * 40.6, 6);
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
