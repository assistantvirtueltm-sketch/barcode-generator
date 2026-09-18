/**
 * Encodage des barres via bwip-js.
 *
 * On n'utilise **que** `raw()` : bwip-js fournit la suite de largeurs de
 * barres/espaces en modules, et le rendu (rectangles vectoriels + texte) est
 * fait par nos soins dans le PDF. Aucune rastérisation, aucune police à charger,
 * et le même motif alimente l'aperçu SVG et le PDF.
 *
 * Le sous-chemin `bwip-js/browser` est explicite : il évite que le bundler
 * n'embarque la variante Node (dépendante de zlib) dans le bundle client.
 */
import bwipjs from "bwip-js/browser";

import type { Symbology } from "./symbology";

export interface Bar {
  /** Position du bord gauche de la barre, en modules depuis le début du code. */
  xModules: number;
  widthModules: number;
}

export interface BarPattern {
  symbology: Symbology;
  value: string;
  /** Largeur du code, zones de silence exclues. */
  totalModules: number;
  /** Zone de silence exigée par la norme, en modules. */
  quietLeftModules: number;
  quietRightModules: number;
  bars: readonly Bar[];
}

/**
 * Zones de silence normatives, en modules (X-dimension). Elles ne sont pas
 * imprimées mais réservées : rien ne doit être posé dans cette bande.
 */
const QUIET_ZONE_MODULES: Record<Symbology, { left: number; right: number }> = {
  ean13: { left: 11, right: 7 },
  ean8: { left: 7, right: 7 },
  upca: { left: 9, right: 9 },
  code128: { left: 10, right: 10 },
};

/**
 * Convertit la saisie validée en motif de barres.
 * @throws si bwip-js refuse la valeur (la validation amont doit l'éviter).
 */
export function barPattern(symbology: Symbology, value: string): BarPattern {
  const segments = bwipjs.raw({ bcid: symbology, text: value });
  const first = segments[0];
  if (!first || !("sbs" in first)) {
    throw new Error(
      `bwip-js n'a pas renvoyé de motif linéaire pour ${symbology} (${value}).`,
    );
  }

  // `sbs` = suite des largeurs, en modules, commençant par une barre noire puis
  // alternant espace / barre.
  const bars: Bar[] = [];
  let xModules = 0;
  first.sbs.forEach((widthModules, i) => {
    if (i % 2 === 0 && widthModules > 0) {
      bars.push({ xModules, widthModules });
    }
    xModules += widthModules;
  });

  const quiet = QUIET_ZONE_MODULES[symbology];
  return {
    symbology,
    value,
    totalModules: xModules,
    quietLeftModules: quiet.left,
    quietRightModules: quiet.right,
    bars,
  };
}
