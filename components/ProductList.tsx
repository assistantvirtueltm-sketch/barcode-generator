"use client";

import { resolveCode, SYMBOLOGY_LABELS } from "@/lib/symbology";
import type { StoredProduct } from "@/lib/storage";

interface ProductListProps {
  products: readonly StoredProduct[];
  selectedId: string | null;
  onSelect: (product: StoredProduct) => void;
  onEdit: (product: StoredProduct) => void;
  onRemove: (product: StoredProduct) => void;
  onPrint: (product: StoredProduct) => void;
}

export function ProductList({
  products,
  selectedId,
  onSelect,
  onEdit,
  onRemove,
  onPrint,
}: ProductListProps) {
  if (products.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        Aucun produit enregistré. Les produits ajoutés restent dans ce
        navigateur (aucun compte, aucun serveur).
      </p>
    );
  }

  return (
    <ul className="divide-y divide-stone-200">
      {products.map((product) => {
        const resolution = resolveCode(product.input, product.symbology);
        return (
          <li
            key={product.id}
            className={`flex flex-wrap items-center gap-3 py-3 ${
              product.id === selectedId ? "bg-stone-50" : ""
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(product)}
              className="min-w-0 flex-1 text-left"
            >
              <span className="block truncate text-sm font-medium text-stone-900">
                {product.name || "(sans libellé)"}
              </span>
              <span className="block font-mono text-xs text-stone-600">
                {resolution.ok
                  ? `${resolution.code.value} · ${SYMBOLOGY_LABELS[resolution.code.symbology]}`
                  : `${product.input} · ${resolution.error}`}
              </span>
            </button>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onPrint(product)}
                disabled={!resolution.ok}
                className="rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-white disabled:bg-stone-400"
              >
                Planche PDF
              </button>
              <button
                type="button"
                onClick={() => onEdit(product)}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700"
              >
                Modifier
              </button>
              <button
                type="button"
                onClick={() => onRemove(product)}
                className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-red-700"
              >
                Supprimer
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
