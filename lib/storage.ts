/**
 * Persistance locale — seul point d'accès au `localStorage`.
 *
 * Les données utilisateur ne vivent nulle part ailleurs (pas de backend) :
 * toute lecture est défensive (mode privé, quota, storage bloqué) et versionnée,
 * pour qu'un ancien format soit migré plutôt qu'effacé.
 */
import type { SymbologyChoice } from "./symbology";

export const STORAGE_KEY = "barcode-generator:library:v1";
export const SCHEMA_VERSION = 1;

export interface StoredProduct {
  id: string;
  /** Libellé produit imprimé sur l'étiquette. */
  name: string;
  /** Code tel que saisi (non normalisé), pour pouvoir le réafficher. */
  input: string;
  /** Type choisi par l'utilisateur, « auto » compris. */
  symbology: SymbologyChoice;
  createdAt: string;
  updatedAt: string;
}

export interface LibrarySettings {
  /** Décalage global d'impression, en mm. */
  offsetXMm: number;
  offsetYMm: number;
  /** Première étiquette utilisée par défaut (index 0-based). */
  startIndex: number;
}

export interface Library {
  version: number;
  products: StoredProduct[];
  settings: LibrarySettings;
}

export const DEFAULT_SETTINGS: LibrarySettings = {
  offsetXMm: 0,
  offsetYMm: 0,
  startIndex: 0,
};

export function emptyLibrary(): Library {
  return {
    version: SCHEMA_VERSION,
    products: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function newProductId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `p-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const SYMBOLOGY_CHOICES: readonly SymbologyChoice[] = [
  "auto",
  "ean13",
  "ean8",
  "upca",
  "code128",
];

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function migrateProduct(raw: unknown): StoredProduct | null {
  if (typeof raw !== "object" || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const input = asString(record.input ?? record.code ?? record.value);
  if (input.trim().length === 0) return null;
  const symbology = SYMBOLOGY_CHOICES.includes(
    record.symbology as SymbologyChoice,
  )
    ? (record.symbology as SymbologyChoice)
    : "auto";
  const now = new Date().toISOString();
  return {
    id: asString(record.id) || newProductId(),
    name: asString(record.name ?? record.label ?? record.description),
    input,
    symbology,
    createdAt: asString(record.createdAt, now),
    updatedAt: asString(record.updatedAt, now),
  };
}

export interface MigrationResult {
  library: Library;
  /** Entrées illisibles écartées pendant la migration. */
  dropped: number;
}

/**
 * Normalise un contenu de storage quelconque vers le schéma courant. Ne lève
 * jamais : au pire, renvoie une bibliothèque vide.
 */
export function migrate(raw: unknown): MigrationResult {
  const source = Array.isArray(raw) ? { products: raw } : raw;
  if (typeof source !== "object" || source === null) {
    return { library: emptyLibrary(), dropped: 0 };
  }
  const record = source as Record<string, unknown>;
  const rawProducts = Array.isArray(record.products) ? record.products : [];
  const products: StoredProduct[] = [];
  let dropped = 0;
  for (const entry of rawProducts) {
    const product = migrateProduct(entry);
    if (product) products.push(product);
    else dropped += 1;
  }
  const rawSettings =
    typeof record.settings === "object" && record.settings !== null
      ? (record.settings as Record<string, unknown>)
      : {};
  return {
    library: {
      version: SCHEMA_VERSION,
      products,
      settings: {
        offsetXMm: asNumber(rawSettings.offsetXMm, DEFAULT_SETTINGS.offsetXMm),
        offsetYMm: asNumber(rawSettings.offsetYMm, DEFAULT_SETTINGS.offsetYMm),
        startIndex: Math.max(
          0,
          Math.trunc(asNumber(rawSettings.startIndex, DEFAULT_SETTINGS.startIndex)),
        ),
      },
    },
    dropped,
  };
}

export function loadLibrary(): MigrationResult {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { library: emptyLibrary(), dropped: 0 };
    return migrate(JSON.parse(raw));
  } catch {
    // Storage indisponible ou JSON corrompu : l'app reste utilisable sans
    // persistance plutôt que de planter au démarrage.
    return { library: emptyLibrary(), dropped: 0 };
  }
}

export function saveLibrary(library: Library): { ok: boolean; error?: string } {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? `Sauvegarde locale impossible : ${error.message}`
          : "Sauvegarde locale impossible.",
    };
  }
}

export function serializeLibrary(library: Library): string {
  return JSON.stringify(library, null, 2);
}

export function parseImport(
  json: string,
): { ok: true; result: MigrationResult } | { ok: false; error: string } {
  try {
    return { ok: true, result: migrate(JSON.parse(json)) };
  } catch {
    return { ok: false, error: "Fichier illisible : JSON invalide." };
  }
}
