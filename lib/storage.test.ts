import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DEFAULT_SETTINGS,
  emptyLibrary,
  loadLibrary,
  migrate,
  parseImport,
  saveLibrary,
  serializeLibrary,
  STORAGE_KEY,
} from "./storage";

function stubStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  const storage = {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
  };
  vi.stubGlobal("window", { localStorage: storage });
  return map;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("migrate", () => {
  it("accepte le schéma courant", () => {
    const library = emptyLibrary();
    library.products.push({
      id: "a",
      name: "Café",
      input: "5901234123457",
      symbology: "auto",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const { library: migrated, dropped } = migrate(
      JSON.parse(serializeLibrary(library)),
    );
    expect(dropped).toBe(0);
    expect(migrated.products).toEqual(library.products);
  });

  it("récupère un simple tableau de produits", () => {
    const { library, dropped } = migrate([
      { label: "Thé", code: "96385074" },
      { description: "Miel", value: "036000291452", symbology: "upca" },
    ]);
    expect(dropped).toBe(0);
    expect(library.products.map((p) => [p.name, p.input, p.symbology])).toEqual([
      ["Thé", "96385074", "auto"],
      ["Miel", "036000291452", "upca"],
    ]);
    expect(library.products[0].id).toBeTruthy();
  });

  it("écarte les entrées illisibles sans perdre les autres", () => {
    const { library, dropped } = migrate({
      products: [
        null,
        { name: "Sans code" },
        { name: "Bon", input: "5901234123457" },
        "n'importe quoi",
      ],
    });
    expect(dropped).toBe(3);
    expect(library.products).toHaveLength(1);
    expect(library.products[0].name).toBe("Bon");
  });

  it("normalise les réglages et rejette les valeurs aberrantes", () => {
    const { library } = migrate({
      products: [],
      settings: { offsetXMm: -0.6, offsetYMm: "nope", startIndex: 12.9 },
    });
    expect(library.settings.offsetXMm).toBe(-0.6);
    expect(library.settings.offsetYMm).toBe(DEFAULT_SETTINGS.offsetYMm);
    expect(library.settings.startIndex).toBe(12);
  });

  it("ne lève jamais sur une entrée absurde", () => {
    expect(migrate(null).library).toEqual(emptyLibrary());
    expect(migrate("texte").library).toEqual(emptyLibrary());
    expect(migrate(42).library.products).toEqual([]);
  });

  it("conserve les produits d'une version future du schéma", () => {
    const { library } = migrate({
      version: 99,
      products: [{ name: "Futur", input: "5901234123457" }],
    });
    expect(library.products).toHaveLength(1);
  });
});

describe("loadLibrary / saveLibrary", () => {
  it("fait un aller-retour par le localStorage", () => {
    stubStorage();
    const library = emptyLibrary();
    library.settings.offsetXMm = 0.4;
    expect(saveLibrary(library).ok).toBe(true);
    expect(loadLibrary().library.settings.offsetXMm).toBe(0.4);
  });

  it("repart d'une bibliothèque vide si le contenu est corrompu", () => {
    stubStorage({ [STORAGE_KEY]: "{ pas du json" });
    expect(loadLibrary().library).toEqual(emptyLibrary());
  });

  it("reste utilisable quand le storage est indisponible", () => {
    vi.stubGlobal("window", {
      get localStorage(): never {
        throw new Error("storage bloqué");
      },
    });
    expect(loadLibrary().library).toEqual(emptyLibrary());
    const result = saveLibrary(emptyLibrary());
    expect(result.ok).toBe(false);
    expect(result.error).toContain("storage bloqué");
  });

  it("signale un quota dépassé au lieu de planter", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new DOMException("quota", "QuotaExceededError");
        },
      },
    });
    expect(saveLibrary(emptyLibrary()).ok).toBe(false);
  });
});

describe("parseImport", () => {
  it("importe un export précédent", () => {
    const library = emptyLibrary();
    library.products.push({
      id: "x",
      name: "Miel",
      input: "036000291452",
      symbology: "upca",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const parsed = parseImport(serializeLibrary(library));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.result.library.products).toHaveLength(1);
  });

  it("refuse un fichier illisible", () => {
    const parsed = parseImport("<html>");
    expect(parsed.ok).toBe(false);
  });
});
