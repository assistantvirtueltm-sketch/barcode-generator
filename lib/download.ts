/**
 * Sortie des fichiers générés en mémoire.
 *
 * Un PDF est d'abord exposé comme URL d'objet, pour être affiché dans l'aperçu
 * de l'application ; le téléchargement réutilise cette même URL plutôt que de
 * régénérer le document. L'appelant est responsable de révoquer l'URL
 * (`revokeFileUrl`) quand l'aperçu se ferme.
 */

/** Expose des octets en mémoire comme URL consultable par le navigateur. */
export function createFileUrl(bytes: Uint8Array, type: string): string {
  return URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type }));
}

export function createPdfUrl(bytes: Uint8Array): string {
  return createFileUrl(bytes, "application/pdf");
}

export function revokeFileUrl(url: string): void {
  URL.revokeObjectURL(url);
}

/** Déclenche l'enregistrement du fichier déjà exposé à cette URL. */
export function triggerDownload(url: string, fileName: string): void {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
}

/** Déclenche le téléchargement d'un export JSON de la bibliothèque. */
export function downloadJson(content: string, fileName: string): void {
  const url = URL.createObjectURL(
    new Blob([content], { type: "application/json" }),
  );
  try {
    triggerDownload(url, fileName);
  } finally {
    // Laisse au navigateur le temps de démarrer le téléchargement.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
