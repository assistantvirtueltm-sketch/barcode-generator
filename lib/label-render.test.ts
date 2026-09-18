import { describe, expect, it } from "vitest";

import { barPattern } from "./barcode-modules";
import { APLI_118990, LABEL_STYLE } from "./label-layout";
import { buildLabelContent } from "./label-render";
import { createMeasurer } from "./pdf";
import { resolveCode, type Symbology } from "./symbology";

const spec = APLI_118990;
const measure = await createMeasurer();

function contentFor(input: string, name: string, symbology?: Symbology) {
  const resolved = resolveCode(input, symbology ?? "auto");
  if (!resolved.ok) throw new Error(resolved.error);
  const pattern = barPattern(
    resolved.code.symbology,
    resolved.code.value,
  );
  return {
    pattern,
    content: buildLabelContent({
      spec,
      pattern,
      name,
      humanReadable: resolved.code.humanReadable,
      measure,
    }),
  };
}

describe("barPattern", () => {
  it("décode un EAN-13 en 95 modules et 30 barres", () => {
    const pattern = barPattern("ean13", "5901234123457");
    expect(pattern.totalModules).toBe(95);
    expect(pattern.bars).toHaveLength(30);
    expect(pattern.quietLeftModules).toBe(11);
    expect(pattern.quietRightModules).toBe(7);
  });

  it("décode les autres symbologies", () => {
    expect(barPattern("ean8", "96385074").totalModules).toBe(67);
    expect(barPattern("upca", "036000291452").totalModules).toBe(95);
    expect(barPattern("code128", "REF-1234").totalModules).toBeGreaterThan(0);
  });
});

describe("buildLabelContent", () => {
  it("tient dans l'étiquette, zones de silence comprises", () => {
    const { pattern, content } = contentFor(
      "5901234123457",
      "Café moulu arabica 250 g",
    );

    for (const bar of content.bars) {
      expect(bar.xMm).toBeGreaterThanOrEqual(0);
      expect(bar.xMm + bar.widthMm).toBeLessThanOrEqual(spec.labelWidthMm);
      expect(bar.yMm).toBeGreaterThan(0);
      expect(bar.yMm + bar.heightMm).toBeLessThanOrEqual(spec.labelHeightMm);
    }

    const firstBar = content.bars[0];
    const lastBar = content.bars.at(-1)!;
    // Les zones de silence normatives tiennent dans l'étiquette.
    expect(
      firstBar.xMm - pattern.quietLeftModules * content.moduleMm,
    ).toBeGreaterThanOrEqual(-1e-9);
    expect(
      lastBar.xMm +
        lastBar.widthMm +
        pattern.quietRightModules * content.moduleMm,
    ).toBeLessThanOrEqual(spec.labelWidthMm + 1e-9);
  });

  it("reste au-dessus du grossissement minimal de 80 % pour un EAN-13", () => {
    const { content } = contentFor("5901234123457", "Produit");
    expect(content.magnification).toBeGreaterThanOrEqual(0.8);
    expect(content.magnification).toBeLessThanOrEqual(1);
    expect(content.moduleMm).toBeGreaterThan(LABEL_STYLE.thinModuleWarnMm);
    expect(content.warnings).toEqual([]);
  });

  it("plafonne la X-dimension au nominal quand la place le permet", () => {
    const { content } = contentFor("96385074", "Petit code");
    expect(content.moduleMm).toBeCloseTo(LABEL_STYLE.nominalModuleMm, 10);
    expect(content.magnification).toBeCloseTo(1, 10);
  });

  it("imprime le libellé et les chiffres, centrés dans l'étiquette", () => {
    const { content } = contentFor("5901234123457", "Thé vert");
    expect(content.texts).toHaveLength(2);
    const [name, digits] = content.texts;
    expect(name.text).toBe("Thé vert");
    expect(name.bold).toBe(true);
    expect(digits.text).toBe("5 901234 123457");
    for (const text of content.texts) {
      expect(text.xMm).toBeGreaterThanOrEqual(LABEL_STYLE.paddingXMm - 1e-9);
      expect(text.baselineYMm).toBeLessThanOrEqual(spec.labelHeightMm);
    }
    // Le libellé est au-dessus des barres, les chiffres en dessous.
    expect(name.baselineYMm).toBeLessThan(content.bars[0].yMm);
    expect(digits.baselineYMm).toBeGreaterThan(
      content.bars[0].yMm + content.bars[0].heightMm,
    );
  });

  it("donne toute la hauteur aux barres quand il n'y a pas de libellé", () => {
    const withName = contentFor("5901234123457", "Produit").content;
    const withoutName = contentFor("5901234123457", "  ").content;
    expect(withoutName.texts).toHaveLength(1);
    expect(withoutName.bars[0].heightMm).toBeGreaterThan(
      withName.bars[0].heightMm,
    );
    expect(
      withoutName.bars[0].yMm + withoutName.bars[0].heightMm,
    ).toBeLessThanOrEqual(spec.labelHeightMm);
  });

  it("tronque un libellé trop long et le signale", () => {
    const { content } = contentFor(
      "5901234123457",
      "Confiture extra de myrtilles sauvages des Vosges bocal familial 750 g",
    );
    const name = content.texts[0];
    expect(name.text.endsWith("…")).toBe(true);
    expect(content.warnings.join(" ")).toContain("tronqué");
  });

  it("alerte quand un Code 128 rend les barres trop fines", () => {
    const { content } = contentFor(
      "REFERENCE-INTERNE-2026-000123456789",
      "Pièce détachée",
      "code128",
    );
    expect(content.moduleMm).toBeLessThan(LABEL_STYLE.thinModuleWarnMm);
    expect(content.warnings.join(" ")).toContain("Barres très fines");
  });
});
