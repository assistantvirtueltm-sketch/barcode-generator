/**
 * Validation et normalisation des codes saisis. Module pur (aucune dépendance
 * navigateur ni bwip-js) : c'est la logique la plus rentable à couvrir par des
 * tests unitaires.
 */

export type Symbology = "ean13" | "ean8" | "upca" | "code128";
export type SymbologyChoice = Symbology | "auto";

export const SYMBOLOGY_LABELS: Record<Symbology, string> = {
  ean13: "EAN-13",
  ean8: "EAN-8",
  upca: "UPC-A",
  code128: "Code 128",
};

/** Nombre total de chiffres, clé de contrôle comprise. */
const GTIN_LENGTH: Record<"ean13" | "ean8" | "upca", number> = {
  ean13: 13,
  ean8: 8,
  upca: 12,
};

export interface ResolvedCode {
  symbology: Symbology;
  /** Valeur transmise au codeur, clé de contrôle comprise. */
  value: string;
  /** Chaîne lisible imprimée sous les barres (groupée pour les GTIN). */
  humanReadable: string;
  /** La clé de contrôle a été calculée à partir d'une saisie incomplète. */
  checkDigitComputed: boolean;
  /** La symbologie a été déduite de la saisie (mode « auto »). */
  detected: boolean;
}

export type CodeResolution =
  | { ok: true; code: ResolvedCode }
  | { ok: false; error: string };

/**
 * Clé de contrôle GTIN (EAN-13, EAN-8, UPC-A) : somme pondérée 3/1 en partant
 * du chiffre le plus à droite de la saisie, complément à 10.
 */
export function gtinCheckDigit(digitsWithoutCheck: string): number {
  if (!/^\d+$/.test(digitsWithoutCheck)) {
    throw new TypeError("gtinCheckDigit attend une suite de chiffres");
  }
  let sum = 0;
  let weight = 3;
  for (let i = digitsWithoutCheck.length - 1; i >= 0; i--) {
    sum += Number(digitsWithoutCheck[i]) * weight;
    weight = weight === 3 ? 1 : 3;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGtin(digits: string): boolean {
  if (!/^\d{2,}$/.test(digits)) return false;
  const body = digits.slice(0, -1);
  return gtinCheckDigit(body) === Number(digits.at(-1));
}

/** Retire les séparateurs usuels d'une saisie numérique (espaces, tirets, points). */
export function normalizeDigits(raw: string): string {
  return raw.replace(/[\s.\-_]/g, "");
}

function groupHumanReadable(symbology: Symbology, value: string): string {
  switch (symbology) {
    case "ean13":
      return `${value.slice(0, 1)} ${value.slice(1, 7)} ${value.slice(7)}`;
    case "ean8":
      return `${value.slice(0, 4)} ${value.slice(4)}`;
    case "upca":
      return `${value.slice(0, 1)} ${value.slice(1, 6)} ${value.slice(6, 11)} ${value.slice(11)}`;
    case "code128":
      return value;
  }
}

function resolveGtin(
  symbology: "ean13" | "ean8" | "upca",
  digits: string,
  detected: boolean,
): CodeResolution {
  const full = GTIN_LENGTH[symbology];
  const name = SYMBOLOGY_LABELS[symbology];
  if (!/^\d+$/.test(digits)) {
    return { ok: false, error: `${name} n'accepte que des chiffres.` };
  }
  if (digits.length === full - 1) {
    const value = digits + gtinCheckDigit(digits);
    return {
      ok: true,
      code: {
        symbology,
        value,
        humanReadable: groupHumanReadable(symbology, value),
        checkDigitComputed: true,
        detected,
      },
    };
  }
  if (digits.length !== full) {
    return {
      ok: false,
      error: `${name} attend ${full} chiffres (ou ${full - 1} pour calculer la clé) — ${digits.length} saisi(s).`,
    };
  }
  if (!isValidGtin(digits)) {
    return {
      ok: false,
      error: `Clé de contrôle invalide : ${digits.at(-1)} saisi, ${gtinCheckDigit(digits.slice(0, -1))} attendu.`,
    };
  }
  return {
    ok: true,
    code: {
      symbology,
      value: digits,
      humanReadable: groupHumanReadable(symbology, digits),
      checkDigitComputed: false,
      detected,
    },
  };
}

function resolveCode128(raw: string, detected: boolean): CodeResolution {
  const value = raw.trim();
  if (value.length === 0) {
    return { ok: false, error: "Saisir un code." };
  }
  const invalid = [...value].find((ch) => {
    const cp = ch.codePointAt(0) ?? 0;
    return cp < 32 || cp > 126;
  });
  if (invalid !== undefined) {
    return {
      ok: false,
      error: `Caractère non codable en Code 128 : « ${invalid} » (ASCII imprimable uniquement).`,
    };
  }
  return {
    ok: true,
    code: {
      symbology: "code128",
      value,
      humanReadable: value,
      checkDigitComputed: false,
      detected,
    },
  };
}

/**
 * Déduit la symbologie d'une saisie. Cas ambigu des 12 chiffres : un UPC-A
 * complet et valide est reconnu comme tel, sinon la saisie est traitée comme un
 * EAN-13 dont la clé reste à calculer. L'UI affiche toujours le type retenu pour
 * que l'utilisateur puisse forcer l'autre choix.
 */
export function detectSymbology(raw: string): Symbology {
  const digits = normalizeDigits(raw);
  if (!/^\d+$/.test(digits)) return "code128";
  switch (digits.length) {
    case 13:
      return "ean13";
    case 12:
      return isValidGtin(digits) ? "upca" : "ean13";
    case 11:
      return "upca";
    case 8:
      return "ean8";
    case 7:
      return "ean8";
    default:
      return "code128";
  }
}

export function resolveCode(
  raw: string,
  choice: SymbologyChoice = "auto",
): CodeResolution {
  if (raw.trim().length === 0) {
    return { ok: false, error: "Saisir un code." };
  }
  const detected = choice === "auto";
  const symbology = detected ? detectSymbology(raw) : choice;
  if (symbology === "code128") {
    return resolveCode128(raw, detected);
  }
  return resolveGtin(symbology, normalizeDigits(raw), detected);
}
