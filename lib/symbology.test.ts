import { describe, expect, it } from "vitest";

import {
  detectSymbology,
  gtinCheckDigit,
  isValidGtin,
  normalizeDigits,
  resolveCode,
} from "./symbology";

describe("gtinCheckDigit", () => {
  it("calcule la clé des GTIN de référence", () => {
    expect(gtinCheckDigit("590123412345")).toBe(7); // EAN-13
    expect(gtinCheckDigit("400638133393")).toBe(1); // EAN-13
    expect(gtinCheckDigit("9638507")).toBe(4); // EAN-8
    expect(gtinCheckDigit("03600029145")).toBe(2); // UPC-A
  });

  it("valide les codes complets", () => {
    expect(isValidGtin("5901234123457")).toBe(true);
    expect(isValidGtin("5901234123458")).toBe(false);
    expect(isValidGtin("96385074")).toBe(true);
    expect(isValidGtin("036000291452")).toBe(true);
  });
});

describe("normalizeDigits", () => {
  it("retire les séparateurs de saisie", () => {
    expect(normalizeDigits("5 901234-123457")).toBe("5901234123457");
    expect(normalizeDigits(" 0360.0029_1452 ")).toBe("036000291452");
  });
});

describe("detectSymbology", () => {
  it("déduit le type de la longueur", () => {
    expect(detectSymbology("5901234123457")).toBe("ean13");
    expect(detectSymbology("96385074")).toBe("ean8");
    expect(detectSymbology("9638507")).toBe("ean8");
    expect(detectSymbology("03600029145")).toBe("upca");
    expect(detectSymbology("ABC-1234")).toBe("code128");
    expect(detectSymbology("12345")).toBe("code128");
  });

  it("tranche les 12 chiffres selon la clé de contrôle", () => {
    // UPC-A complet et valide.
    expect(detectSymbology("036000291452")).toBe("upca");
    // EAN-13 amputé de sa clé (la clé UPC-A ne tombe pas juste).
    expect(detectSymbology("590123412345")).toBe("ean13");
  });
});

describe("resolveCode", () => {
  it("accepte un EAN-13 valide et le groupe pour l'impression", () => {
    const res = resolveCode("5901234123457");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.code).toMatchObject({
      symbology: "ean13",
      value: "5901234123457",
      humanReadable: "5 901234 123457",
      checkDigitComputed: false,
    });
  });

  it("complète la clé d'un EAN-13 saisi sur 12 chiffres", () => {
    const res = resolveCode("590123412345", "ean13");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.code.value).toBe("5901234123457");
    expect(res.code.checkDigitComputed).toBe(true);
  });

  it("refuse une clé de contrôle fausse en citant la clé attendue", () => {
    const res = resolveCode("5901234123458", "ean13");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("7 attendu");
  });

  it("refuse une longueur impossible", () => {
    const res = resolveCode("123456", "ean13");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error).toContain("13 chiffres");
  });

  it("refuse les lettres sur un type numérique", () => {
    const res = resolveCode("59012341234A", "ean13");
    expect(res.ok).toBe(false);
  });

  it("groupe l'UPC-A et l'EAN-8", () => {
    const upc = resolveCode("036000291452", "upca");
    const ean8 = resolveCode("96385074", "ean8");
    expect(upc.ok && upc.code.humanReadable).toBe("0 36000 29145 2");
    expect(ean8.ok && ean8.code.humanReadable).toBe("9638 5074");
  });

  it("accepte l'ASCII imprimable en Code 128 et rejette le reste", () => {
    const ok = resolveCode("REF/2026-01", "code128");
    expect(ok.ok).toBe(true);
    const ko = resolveCode("RÉF-1", "code128");
    expect(ko.ok).toBe(false);
    if (ko.ok) return;
    expect(ko.error).toContain("Code 128");
  });

  it("refuse une saisie vide", () => {
    expect(resolveCode("   ").ok).toBe(false);
  });
});
