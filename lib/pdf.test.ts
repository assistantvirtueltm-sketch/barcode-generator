import { inflateSync } from "node:zlib";

import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import {
  A4_MM,
  APLI_118990,
  labelsPerSheet,
  mmToPt,
  sheetMarginsMm,
} from "./label-layout";
import {
  buildCalibrationPdf,
  buildSheetPdf,
  sanitizeForPdf,
  sheetFileName,
} from "./pdf";
import { resolveCode, type ResolvedCode } from "./symbology";

const spec = APLI_118990;

function code(input: string): ResolvedCode {
  const resolved = resolveCode(input);
  if (!resolved.ok) throw new Error(resolved.error);
  return resolved.code;
}

/** Contenu décompressé des flux du PDF, pour compter les opérateurs de dessin. */
function contentStreams(bytes: Uint8Array): string {
  const buf = Buffer.from(bytes);
  const chunks: string[] = [];
  let from = 0;
  for (;;) {
    const start = buf.indexOf("stream", from);
    if (start < 0) break;
    const dataStart = buf[start + 6] === 0x0d ? start + 8 : start + 7;
    const end = buf.indexOf("endstream", dataStart);
    if (end < 0) break;
    const chunk = buf.subarray(dataStart, end);
    try {
      chunks.push(inflateSync(chunk).toString("latin1"));
    } catch {
      chunks.push(chunk.toString("latin1"));
    }
    from = end + 9;
  }
  return chunks.join("\n");
}

const countOps = (content: string, pattern: RegExp) =>
  (content.match(pattern) ?? []).length;

describe("buildSheetPdf", () => {
  it("produit une planche A4 complète de 65 étiquettes identiques", async () => {
    const pdf = await buildSheetPdf({
      code: code("5901234123457"),
      name: "Café moulu arabica 250 g",
    });

    expect(Buffer.from(pdf.bytes).toString("latin1", 0, 5)).toBe("%PDF-");
    expect(pdf.labelCount).toBe(labelsPerSheet(spec));
    expect(pdf.startIndex).toBe(0);
    expect(pdf.warnings).toEqual([]);

    const content = contentStreams(pdf.bytes);
    // 30 barres vectorielles (chemins remplis) et 2 textes par étiquette.
    expect(countOps(content, /\nf\n/g)).toBe(30 * 65);
    expect(countOps(content, /Tj/g)).toBe(2 * 65);
    // Aucun opérateur de dessin d'image : les barres restent vectorielles.
    expect(content).not.toMatch(/\bDo\b/);
  });

  it("dimensionne la page en A4 et positionne la 1re barre au bon endroit", async () => {
    const pdf = await buildSheetPdf({
      code: code("5901234123457"),
      name: "Produit",
    });
    const reloaded = await PDFDocument.load(pdf.bytes);
    expect(reloaded.getPageCount()).toBe(1);
    const size = reloaded.getPage(0).getSize();
    expect(size.width).toBeCloseTo(mmToPt(A4_MM.widthMm), 6);
    expect(size.height).toBeCloseTo(mmToPt(A4_MM.heightMm), 6);

    const content = contentStreams(pdf.bytes);
    const firstTranslate = content.match(
      /1 0 0 1 (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) cm/,
    );
    expect(firstTranslate).not.toBeNull();
    const xPt = Number(firstTranslate![1]);
    const yPt = Number(firstTranslate![2]);
    const margins = sheetMarginsMm(spec);
    // La 1re barre est à droite de la marge gauche et sous la marge haute.
    expect(xPt).toBeGreaterThan(mmToPt(margins.leftMm));
    expect(xPt).toBeLessThan(mmToPt(margins.leftMm + spec.labelWidthMm));
    expect(mmToPt(A4_MM.heightMm) - yPt).toBeGreaterThan(
      mmToPt(margins.topMm),
    );
  });

  it("démarre sur une planche entamée sans déborder", async () => {
    const pdf = await buildSheetPdf({
      code: code("5901234123457"),
      name: "Produit",
      startIndex: 60,
    });
    expect(pdf.startIndex).toBe(60);
    expect(pdf.labelCount).toBe(5);
    expect(countOps(contentStreams(pdf.bytes), /Tj/g)).toBe(2 * 5);
  });

  it("borne un nombre d'étiquettes ou un départ incohérents", async () => {
    const tooMany = await buildSheetPdf({
      code: code("5901234123457"),
      name: "Produit",
      count: 999,
    });
    expect(tooMany.labelCount).toBe(65);

    const badStart = await buildSheetPdf({
      code: code("5901234123457"),
      name: "Produit",
      startIndex: -5,
      count: 0,
    });
    expect(badStart.startIndex).toBe(0);
    expect(badStart.labelCount).toBe(1);
  });

  it("applique le décalage de calibration à toute la planche", async () => {
    const base = await buildSheetPdf({
      code: code("5901234123457"),
      name: "Produit",
    });
    const shifted = await buildSheetPdf({
      code: code("5901234123457"),
      name: "Produit",
      offset: { xMm: 1, yMm: 0 },
    });
    const first = (content: string) =>
      Number(
        content.match(/1 0 0 1 (-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?) cm/)![1],
      );
    expect(
      first(contentStreams(shifted.bytes)) - first(contentStreams(base.bytes)),
    ).toBeCloseTo(mmToPt(1), 6);
  });

  it("remonte l'avertissement de libellé remplacé", async () => {
    const pdf = await buildSheetPdf({
      code: code("5901234123457"),
      name: "Bonbons 🍬",
    });
    expect(pdf.warnings.join(" ")).toContain("caractères");
  });
});

describe("buildCalibrationPdf", () => {
  it("trace les 65 emplacements numérotés", async () => {
    const pdf = await buildCalibrationPdf(spec, { xMm: 0.5, yMm: -0.5 });
    const content = contentStreams(pdf.bytes);
    // Un contour (chemin tracé) par emplacement.
    expect(countOps(content, /\nS\n/g)).toBe(65);
    // 65 numéros + la ligne d'en-tête rappelant le décalage.
    expect(countOps(content, /Tj/g)).toBe(66);
    expect(pdf.fileName).toBe("calibration-apli-118990.pdf");
  });
});

describe("sanitizeForPdf", () => {
  it("laisse passer les accents et remplace l'inconnu", () => {
    expect(sanitizeForPdf("Crème brûlée – 250 g")).toEqual({
      text: "Crème brûlée – 250 g",
      changed: false,
    });
    expect(sanitizeForPdf("Bonbons 🍬")).toEqual({
      text: "Bonbons ?",
      changed: true,
    });
  });
});

describe("sheetFileName", () => {
  it("construit un nom de fichier lisible", () => {
    expect(sheetFileName(code("5901234123457"), "Café moulu 250 g")).toBe(
      "etiquettes-cafe-moulu-250-g-5901234123457.pdf",
    );
    expect(sheetFileName(code("5901234123457"), "   ")).toBe(
      "etiquettes-5901234123457.pdf",
    );
  });
});
