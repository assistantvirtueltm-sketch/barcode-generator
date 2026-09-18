"use client";

import type { CodeResolution, SymbologyChoice } from "@/lib/symbology";
import { SYMBOLOGY_LABELS } from "@/lib/symbology";

const CHOICES: { value: SymbologyChoice; label: string }[] = [
  { value: "auto", label: "Détection automatique" },
  { value: "ean13", label: SYMBOLOGY_LABELS.ean13 },
  { value: "ean8", label: SYMBOLOGY_LABELS.ean8 },
  { value: "upca", label: SYMBOLOGY_LABELS.upca },
  { value: "code128", label: SYMBOLOGY_LABELS.code128 },
];

export interface ProductDraft {
  name: string;
  input: string;
  symbology: SymbologyChoice;
}

interface ProductFormProps {
  draft: ProductDraft;
  resolution: CodeResolution;
  editing: boolean;
  onChange: (draft: ProductDraft) => void;
  onSubmit: () => void;
  onCancelEdit: () => void;
}

export function ProductForm({
  draft,
  resolution,
  editing,
  onChange,
  onSubmit,
  onCancelEdit,
}: ProductFormProps) {
  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <div>
        <label
          className="block text-sm font-medium text-stone-700"
          htmlFor="product-name"
        >
          Libellé produit
        </label>
        <input
          id="product-name"
          type="text"
          value={draft.name}
          onChange={(event) =>
            onChange({ ...draft, name: event.target.value })
          }
          placeholder="Café moulu arabica 250 g"
          className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm shadow-xs outline-none focus:border-stone-500"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <label
            className="block text-sm font-medium text-stone-700"
            htmlFor="product-code"
          >
            Code
          </label>
          <input
            id="product-code"
            type="text"
            inputMode="text"
            autoComplete="off"
            value={draft.input}
            onChange={(event) =>
              onChange({ ...draft, input: event.target.value })
            }
            placeholder="5901234123457"
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 font-mono text-sm shadow-xs outline-none focus:border-stone-500"
          />
        </div>
        <div>
          <label
            className="block text-sm font-medium text-stone-700"
            htmlFor="product-symbology"
          >
            Type de code
          </label>
          <select
            id="product-symbology"
            value={draft.symbology}
            onChange={(event) =>
              onChange({
                ...draft,
                symbology: event.target.value as SymbologyChoice,
              })
            }
            className="mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm shadow-xs outline-none focus:border-stone-500"
          >
            {CHOICES.map((choice) => (
              <option key={choice.value} value={choice.value}>
                {choice.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div aria-live="polite" className="min-h-10 text-sm">
        {draft.input.trim().length === 0 ? (
          <p className="text-stone-500">
            EAN-13, EAN-8, UPC-A ou Code 128. Une clé de contrôle manquante est
            calculée automatiquement.
          </p>
        ) : resolution.ok ? (
          <p className="text-emerald-700">
            {SYMBOLOGY_LABELS[resolution.code.symbology]}
            {resolution.code.detected ? " (détecté)" : ""} ·{" "}
            <span className="font-mono">{resolution.code.value}</span>
            {resolution.code.checkDigitComputed
              ? " · clé de contrôle calculée"
              : ""}
          </p>
        ) : (
          <p className="text-red-700">{resolution.error}</p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={!resolution.ok}
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-stone-400"
        >
          {editing ? "Enregistrer" : "Ajouter à la bibliothèque"}
        </button>
        {editing ? (
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-md border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700"
          >
            Annuler
          </button>
        ) : null}
      </div>
    </form>
  );
}
