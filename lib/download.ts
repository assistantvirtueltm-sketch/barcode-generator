/** Déclenche le téléchargement d'un PDF généré en mémoire. */
export function downloadPdf(bytes: Uint8Array, fileName: string): void {
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.rel = "noopener";
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    // Laisse au navigateur le temps de démarrer le téléchargement.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}

/** Déclenche le téléchargement d'un export JSON de la bibliothèque. */
export function downloadJson(content: string, fileName: string): void {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }
}
