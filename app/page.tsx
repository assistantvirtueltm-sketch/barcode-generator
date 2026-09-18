"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { LabelPreview } from "@/components/LabelPreview";
import { ProductForm, type ProductDraft } from "@/components/ProductForm";
import { ProductList } from "@/components/ProductList";
import { SheetMap } from "@/components/SheetMap";
import { barPattern } from "@/lib/barcode-modules";
import { downloadJson, downloadPdf } from "@/lib/download";
import {
  APLI_118990,
  labelsPerSheet,
  sheetGapsMm,
  sheetMarginsMm,
} from "@/lib/label-layout";
import { buildLabelContent, type MeasureText } from "@/lib/label-render";
import {
  acknowledgeLibraryNotice,
  getLibraryState,
  getServerLibraryState,
  subscribeLibrary,
  updateLibrary,
} from "@/lib/library-store";
import { buildCalibrationPdf, buildSheetPdf, createMeasurer } from "@/lib/pdf";
import {
  newProductId,
  parseImport,
  serializeLibrary,
  type LibrarySettings,
  type StoredProduct,
} from "@/lib/storage";
import { resolveCode, type ResolvedCode } from "@/lib/symbology";

const SPEC = APLI_118990;
const PER_SHEET = labelsPerSheet(SPEC);
const EMPTY_DRAFT: ProductDraft = { name: "", input: "", symbology: "auto" };

type Status = { kind: "info" | "error"; text: string } | null;

export default function Page() {
  const { library, dropped, error: storeError } = useSyncExternalStore(
    subscribeLibrary,
    getLibraryState,
    getServerLibraryState,
  );
  const [measure, setMeasure] = useState<MeasureText | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [requestedCount, setRequestedCount] = useState(PER_SHEET);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);

  // Les métriques de police servent à la fois au PDF et à l'aperçu.
  useEffect(() => {
    createMeasurer().then((fn) => setMeasure(() => fn));
  }, []);

  const settings: LibrarySettings = library.settings;
  const startIndex = Math.min(Math.max(settings.startIndex, 0), PER_SHEET - 1);
  const maxCount = PER_SHEET - startIndex;
  const count = Math.min(Math.max(requestedCount, 1), maxCount);

  const resolution = useMemo(
    () => resolveCode(draft.input, draft.symbology),
    [draft.input, draft.symbology],
  );

  const preview = useMemo(() => {
    if (!resolution.ok || !measure) return null;
    try {
      return buildLabelContent({
        spec: SPEC,
        pattern: barPattern(resolution.code.symbology, resolution.code.value),
        name: draft.name,
        humanReadable: resolution.code.humanReadable,
        measure,
      });
    } catch {
      return null;
    }
  }, [resolution, draft.name, measure]);

  function updateSettings(patch: Partial<LibrarySettings>) {
    updateLibrary((current) => ({
      ...current,
      settings: { ...current.settings, ...patch },
    }));
  }

  function submitDraft() {
    if (!resolution.ok) return;
    const now = new Date().toISOString();
    updateLibrary((current) => {
      if (editingId) {
        return {
          ...current,
          products: current.products.map((product) =>
            product.id === editingId
              ? { ...product, ...draft, updatedAt: now }
              : product,
          ),
        };
      }
      const product: StoredProduct = {
        id: newProductId(),
        ...draft,
        createdAt: now,
        updatedAt: now,
      };
      return { ...current, products: [product, ...current.products] };
    });
    setStatus({
      kind: "info",
      text: editingId ? "Produit mis à jour." : "Produit ajouté.",
    });
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  }

  async function printSheet(code: ResolvedCode, name: string) {
    setBusy(true);
    try {
      const pdf = await buildSheetPdf({
        code,
        name,
        spec: SPEC,
        startIndex,
        count,
        offset: { xMm: settings.offsetXMm, yMm: settings.offsetYMm },
      });
      downloadPdf(pdf.bytes, pdf.fileName);
      setStatus({
        kind: pdf.warnings.length > 0 ? "error" : "info",
        text: [
          `${pdf.fileName} — ${pdf.labelCount} étiquette(s) à partir de la n° ${pdf.startIndex + 1}.`,
          ...pdf.warnings,
        ].join(" "),
      });
    } catch (error) {
      setStatus({
        kind: "error",
        text:
          error instanceof Error
            ? `Génération impossible : ${error.message}`
            : "Génération impossible.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function printCalibration() {
    setBusy(true);
    try {
      const pdf = await buildCalibrationPdf(SPEC, {
        xMm: settings.offsetXMm,
        yMm: settings.offsetYMm,
      });
      downloadPdf(pdf.bytes, pdf.fileName);
      setStatus({
        kind: "info",
        text: "Planche de calibration téléchargée : imprimer sur papier ordinaire et superposer au support.",
      });
    } finally {
      setBusy(false);
    }
  }

  function printProduct(product: StoredProduct) {
    const productResolution = resolveCode(product.input, product.symbology);
    if (!productResolution.ok) {
      setStatus({ kind: "error", text: productResolution.error });
      return;
    }
    void printSheet(productResolution.code, product.name);
  }

  function removeProduct(product: StoredProduct) {
    if (
      !window.confirm(
        `Supprimer « ${product.name || product.input} » de la bibliothèque ?`,
      )
    ) {
      return;
    }
    updateLibrary((current) => ({
      ...current,
      products: current.products.filter((item) => item.id !== product.id),
    }));
    if (editingId === product.id) {
      setEditingId(null);
      setDraft(EMPTY_DRAFT);
    }
  }

  function handleImport(file: File) {
    void file.text().then((text) => {
      const parsed = parseImport(text);
      if (!parsed.ok) {
        setStatus({ kind: "error", text: parsed.error });
        return;
      }
      const imported = parsed.result.library.products;
      updateLibrary((current) => {
        const known = new Set(
          current.products.map((product) => `${product.input}|${product.name}`),
        );
        const added = imported.filter(
          (product) => !known.has(`${product.input}|${product.name}`),
        );
        return { ...current, products: [...added, ...current.products] };
      });
      setStatus({
        kind: "info",
        text: `${imported.length} produit(s) lu(s) dans le fichier, doublons ignorés.`,
      });
    });
  }

  const margins = sheetMarginsMm(SPEC);
  const gaps = sheetGapsMm(SPEC);
  const products = library.products;
  const notice =
    storeError ??
    (dropped > 0
      ? `${dropped} entrée(s) illisible(s) ont été écartées au chargement.`
      : null);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-stone-900">
          Planches d&apos;étiquettes codes-barres
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          {SPEC.reference} — {SPEC.name} · pas {SPEC.columnPitchMm} ×{" "}
          {SPEC.rowPitchMm} mm · marges {margins.leftMm.toFixed(1)} /{" "}
          {margins.topMm.toFixed(1)} mm · gouttières{" "}
          {gaps.columnGapMm.toFixed(1)} / {gaps.rowGapMm.toFixed(1)} mm
        </p>
      </header>

      {notice ? (
        <p
          role="alert"
          className="mb-6 flex items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          <span>{notice}</span>
          <button
            type="button"
            onClick={acknowledgeLibraryNotice}
            className="shrink-0 underline"
          >
            Masquer
          </button>
        </p>
      ) : null}

      {status ? (
        <p
          aria-live="polite"
          className={`mb-6 rounded-md border px-3 py-2 text-sm ${
            status.kind === "error"
              ? "border-red-200 bg-red-50 text-red-800"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {status.text}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-xs">
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-stone-500 uppercase">
              {editingId ? "Modifier le produit" : "Nouveau produit"}
            </h2>
            <ProductForm
              draft={draft}
              resolution={resolution}
              editing={editingId !== null}
              onChange={setDraft}
              onSubmit={submitDraft}
              onCancelEdit={() => {
                setEditingId(null);
                setDraft(EMPTY_DRAFT);
              }}
            />
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-xs">
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-stone-500 uppercase">
              Aperçu à l&apos;échelle
            </h2>
            {preview ? (
              <div className="flex flex-wrap items-start gap-6">
                <LabelPreview spec={SPEC} content={preview} />
                <dl className="text-xs text-stone-600">
                  <div className="flex gap-2">
                    <dt>Étiquette</dt>
                    <dd className="font-mono">
                      {SPEC.labelWidthMm} × {SPEC.labelHeightMm} mm
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt>X-dimension</dt>
                    <dd className="font-mono">
                      {preview.moduleMm.toFixed(3)} mm (
                      {Math.round(preview.magnification * 100)} %)
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt>Barres</dt>
                    <dd className="font-mono">{preview.bars.length}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <p className="text-sm text-stone-500">
                Saisir un code valide pour voir l&apos;étiquette.
              </p>
            )}
            {preview?.warnings.map((warning) => (
              <p key={warning} className="mt-3 text-sm text-amber-700">
                {warning}
              </p>
            ))}
            {resolution.ok ? (
              <button
                type="button"
                disabled={busy || !preview}
                onClick={() => void printSheet(resolution.code, draft.name)}
                className="mt-4 rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:bg-stone-400"
              >
                Télécharger la planche PDF
              </button>
            ) : null}
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-xs">
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-stone-500 uppercase">
              Bibliothèque ({products.length})
            </h2>
            <ProductList
              products={products}
              selectedId={editingId}
              onSelect={(product) =>
                setDraft({
                  name: product.name,
                  input: product.input,
                  symbology: product.symbology,
                })
              }
              onEdit={(product) => {
                setEditingId(product.id);
                setDraft({
                  name: product.name,
                  input: product.input,
                  symbology: product.symbology,
                });
              }}
              onRemove={removeProduct}
              onPrint={printProduct}
            />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-xs">
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-stone-500 uppercase">
              Planche
            </h2>
            <SheetMap
              spec={SPEC}
              startIndex={startIndex}
              count={count}
              onSelectStart={(index) => updateSettings({ startIndex: index })}
            />
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-xs text-stone-600">
                Première étiquette
                <input
                  type="number"
                  min={1}
                  max={PER_SHEET}
                  value={startIndex + 1}
                  onChange={(event) =>
                    updateSettings({
                      startIndex: Number(event.target.value) - 1,
                    })
                  }
                  className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-stone-600">
                Nombre ({maxCount} max)
                <input
                  type="number"
                  min={1}
                  max={maxCount}
                  value={count}
                  onChange={(event) =>
                    setRequestedCount(Number(event.target.value))
                  }
                  className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-stone-500">
              Cliquer sur le plan pour reprendre une planche entamée.
            </p>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-xs">
            <h2 className="mb-1 text-sm font-semibold tracking-wide text-stone-500 uppercase">
              Calibration
            </h2>
            <p className="mb-3 text-xs text-stone-500">
              Décalage appliqué à toute la planche, pour compenser la dérive de
              l&apos;imprimante.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-stone-600">
                Décalage X (mm)
                <input
                  type="number"
                  step={0.1}
                  value={settings.offsetXMm}
                  onChange={(event) =>
                    updateSettings({ offsetXMm: Number(event.target.value) })
                  }
                  className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-stone-600">
                Décalage Y (mm)
                <input
                  type="number"
                  step={0.1}
                  value={settings.offsetYMm}
                  onChange={(event) =>
                    updateSettings({ offsetYMm: Number(event.target.value) })
                  }
                  className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1.5 text-sm"
                />
              </label>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void printCalibration()}
              className="mt-3 w-full rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 disabled:text-stone-400"
            >
              Planche de calibration
            </button>
            <p className="mt-2 text-xs text-stone-500">
              À imprimer à 100 % (« taille réelle », sans ajustement à la page).
            </p>
          </section>

          <section className="rounded-lg border border-stone-200 bg-white p-5 shadow-xs">
            <h2 className="mb-1 text-sm font-semibold tracking-wide text-stone-500 uppercase">
              Données
            </h2>
            <p className="mb-3 text-xs text-stone-500">
              La bibliothèque vit dans ce navigateur uniquement. L&apos;export
              JSON est la seule sauvegarde possible.
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() =>
                  downloadJson(
                    serializeLibrary(library),
                    "etiquettes-bibliotheque.json",
                  )
                }
                className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700"
              >
                Exporter en JSON
              </button>
              <button
                type="button"
                onClick={() => importInput.current?.click()}
                className="rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700"
              >
                Importer un JSON
              </button>
              <input
                ref={importInput}
                type="file"
                accept="application/json,.json"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleImport(file);
                  event.target.value = "";
                }}
              />
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
