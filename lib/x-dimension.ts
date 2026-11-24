/**
 * Règles de X-dimension (largeur d'un module) par symbologie.
 *
 * La X-dimension décide de la lisibilité physique du code : sous un certain
 * seuil, l'imprimante ne sait plus restituer des barres régulières (un module
 * de 0,25 mm ne fait que 6 points sur une laser 600 dpi, et l'engraissement
 * d'encre fait le reste), et le symbole devient inscannable quel que soit le
 * soin apporté à l'encodage.
 *
 * Module pur, sans dépendance : c'est la table de référence du projet.
 */
import type { Symbology } from "./symbology";

export interface XDimensionRule {
  /**
   * X-dimension visée quand la largeur le permet. Au-delà, le code serait
   * inutilement large sur l'étiquette.
   */
  targetMm: number;
  /** Plancher sous lequel la génération est refusée. */
  minimumMm: number;
  /** Origine du plancher, citée à l'utilisateur. */
  reference: string;
  /** Le grossissement en pourcentage a-t-il un sens pour cette symbologie ? */
  hasMagnification: boolean;
}

/** X-dimension nominale d'un EAN-13 à 100 % de grossissement. */
export const EAN_NOMINAL_MM = 0.33;

/**
 * Les familles EAN/UPC ont une plage normative de grossissement de 80 à 200 % ;
 * 80 % de 0,330 mm donne le plancher de 0,264 mm.
 *
 * Le Code 128 n'a pas de X-dimension nominale : le plancher retenu, 0,25 mm,
 * correspond à un usage interne lu au scanner de proximité. Un GS1-128 destiné
 * à la distribution exige au moins 0,495 mm, hors d'atteinte sur une étiquette
 * de 38 mm — un tel code appelle un support plus grand.
 */
export const X_DIMENSION_RULES: Record<Symbology, XDimensionRule> = {
  ean13: {
    targetMm: EAN_NOMINAL_MM,
    minimumMm: 0.264,
    reference: "80 % du nominal EAN (0,330 mm)",
    hasMagnification: true,
  },
  ean8: {
    targetMm: EAN_NOMINAL_MM,
    minimumMm: 0.264,
    reference: "80 % du nominal EAN (0,330 mm)",
    hasMagnification: true,
  },
  upca: {
    targetMm: EAN_NOMINAL_MM,
    minimumMm: 0.264,
    reference: "80 % du nominal UPC (0,330 mm)",
    hasMagnification: true,
  },
  code128: {
    targetMm: EAN_NOMINAL_MM,
    minimumMm: 0.25,
    reference: "0,25 mm, plancher usuel d'une lecture de proximité",
    hasMagnification: false,
  },
};

export function xDimensionRule(symbology: Symbology): XDimensionRule {
  return X_DIMENSION_RULES[symbology];
}
