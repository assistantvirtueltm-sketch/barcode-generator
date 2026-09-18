import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  acknowledgeLibraryNotice,
  getLibraryState,
  getServerLibraryState,
  resetLibraryStore,
  subscribeLibrary,
  updateLibrary,
} from "./library-store";
import { newProductId, STORAGE_KEY, type StoredProduct } from "./storage";

function product(name: string, input: string): StoredProduct {
  const now = new Date().toISOString();
  return {
    id: newProductId(),
    name,
    input,
    symbology: "auto",
    createdAt: now,
    updatedAt: now,
  };
}

function stubStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
      removeItem: (key: string) => void map.delete(key),
    },
  });
  return map;
}

beforeEach(() => {
  resetLibraryStore();
});

afterEach(() => {
  resetLibraryStore();
  vi.unstubAllGlobals();
});

describe("library store", () => {
  it("expose un instantané serveur vide et stable", () => {
    expect(getServerLibraryState().library.products).toEqual([]);
    expect(getServerLibraryState()).toBe(getServerLibraryState());
  });

  it("garde le même instantané entre deux lectures (pas de boucle de rendu)", () => {
    stubStorage();
    expect(getLibraryState()).toBe(getLibraryState());
  });

  it("charge la bibliothèque existante au premier accès", () => {
    stubStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: 1,
        products: [{ name: "Café", input: "5901234123457" }],
        settings: { offsetXMm: 0.3, offsetYMm: 0, startIndex: 4 },
      }),
    });
    const state = getLibraryState();
    expect(state.library.products).toHaveLength(1);
    expect(state.library.settings.startIndex).toBe(4);
  });

  it("persiste à l'écriture et notifie les abonnés", () => {
    const stored = stubStorage();
    const listener = vi.fn();
    const unsubscribe = subscribeLibrary(listener);

    const next = updateLibrary((current) => ({
      ...current,
      products: [product("Thé", "96385074")],
    }));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(next.library.products).toHaveLength(1);
    expect(getLibraryState()).toBe(next);
    expect(JSON.parse(stored.get(STORAGE_KEY)!).products).toHaveLength(1);

    unsubscribe();
    updateLibrary((current) => current);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("garde la mise à jour en mémoire et signale l'échec quand le storage refuse", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw new Error("storage plein");
        },
      },
    });
    const next = updateLibrary((current) => ({
      ...current,
      products: [product("Miel", "036000291452")],
    }));
    expect(next.error).toContain("storage plein");
    // L'app reste utilisable : la bibliothèque en mémoire a bien changé.
    expect(next.library.products).toHaveLength(1);
  });

  it("efface le bandeau d'information une fois lu", () => {
    stubStorage({
      [STORAGE_KEY]: JSON.stringify({ products: [{ name: "Cassé" }] }),
    });
    expect(getLibraryState().dropped).toBe(1);
    const listener = vi.fn();
    subscribeLibrary(listener);
    acknowledgeLibraryNotice();
    expect(getLibraryState().dropped).toBe(0);
    expect(listener).toHaveBeenCalledTimes(1);
    // Idempotent : pas de notification inutile.
    acknowledgeLibraryNotice();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
