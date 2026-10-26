"use client";

import { useEffect, useRef } from "react";

export interface PdfPreview {
  /** URL d'objet du PDF, révoquée à la fermeture par l'appelant. */
  url: string;
  fileName: string;
  title: string;
  /** Résumé affiché sous l'aperçu (nombre d'étiquettes, départ…). */
  summary: string;
  warnings: readonly string[];
}

interface PdfPreviewDialogProps {
  preview: PdfPreview | null;
  onClose: () => void;
  onDownload: () => void;
}

/**
 * Aperçu du PDF dans l'application : le document s'ouvre dans la visionneuse du
 * navigateur, sans passer par le dossier de téléchargements. Le téléchargement
 * reste à un clic, et un lien de repli couvre les navigateurs qui refusent
 * d'afficher un PDF dans un cadre (Safari iOS, notamment).
 */
export function PdfPreviewDialog({
  preview,
  onClose,
  onDownload,
}: PdfPreviewDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);

  // Pilotage de la balise <dialog> : `showModal` donne le fond assombri, le
  // piégeage du focus et la fermeture par Échap sans code supplémentaire.
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (preview && !node.open) node.showModal();
    if (!preview && node.open) node.close();
  }, [preview]);

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-label="Aperçu de la planche"
      className="m-auto w-[min(56rem,92vw)] rounded-lg p-0 backdrop:bg-stone-900/50"
    >
      {preview ? (
        <div className="flex max-h-[90vh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-stone-900">
                {preview.title}
              </h2>
              <p className="truncate text-xs text-stone-500">
                {preview.summary}
              </p>
            </div>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              aria-label="Fermer l'aperçu"
              className="shrink-0 rounded-md px-2 py-1 text-sm text-stone-500 hover:bg-stone-100"
            >
              ✕
            </button>
          </header>

          <iframe
            src={preview.url}
            title={`Aperçu de ${preview.fileName}`}
            // Pas de `flex-1` ici : sa base nulle l'emporterait sur la hauteur
            // et écraserait la visionneuse.
            className="h-[70vh] w-full bg-stone-100"
          />

          <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 px-5 py-3">
            <p className="text-xs text-stone-500">
              Imprimer à 100 % (« taille réelle »), sans ajustement à la page.
            </p>
            <div className="flex gap-2">
              <a
                href={preview.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50"
              >
                Ouvrir dans un onglet
              </a>
              <button
                type="button"
                onClick={onDownload}
                className="rounded-md bg-stone-900 px-3 py-1.5 text-xs font-medium text-white"
              >
                Télécharger
              </button>
            </div>
          </footer>

          {preview.warnings.length > 0 ? (
            <div className="border-t border-amber-200 bg-amber-50 px-5 py-2">
              {preview.warnings.map((warning) => (
                <p key={warning} className="text-xs text-amber-900">
                  {warning}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </dialog>
  );
}
