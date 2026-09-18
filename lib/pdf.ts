/**
 * Génération des PDF (planche d'étiquettes et planche de calibration).
 *
 * pdf-lib construit le document en mémoire dans le navigateur : les barres sont
 * des rectangles vectoriels, les textes des polices standard. Aucune image, donc
 * aucune perte de netteté à l'impression.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";

import { barPattern } from "./barcode-modules";
import {
  A4_MM,
  APLI_118990,
  labelSlot,
  labelsPerSheet,
  mmToPt,
  NO_OFFSET,
  sheetMarginsMm,
  type PrintOffsetMm,
  type SheetSpec,
} from "./label-layout";
import { buildLabelContent, type MeasureText } from "./label-render";
import type { ResolvedCode } from "./symbology";

/**
 * Caractères représentables par les polices standard PDF (WinAnsi). Tout le
 * reste ferait échouer `drawText`, on le remplace donc en amont.
 */
const WIN_ANSI_SAFE =
  /^[ -~ -ÿ€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]*$/;

export function sanitizeForPdf(text: string): {
  text: string;
  changed: boolean;
} {
  if (WIN_ANSI_SAFE.test(text)) return { text, changed: false };
  const safe = [...text]
    .map((ch) => (WIN_ANSI_SAFE.test(ch) ? ch : "?"))
    .join("");
  return { text: safe, changed: true };
}

interface Fonts {
  regular: PDFFont;
  bold: PDFFont;
}

function measurerFor(fonts: Fonts): MeasureText {
  return (text, sizePt, bold) =>
    (bold ? fonts.bold : fonts.regular).widthOfTextAtSize(text, sizePt);
}

/**
 * Mesureur de texte partagé avec l'aperçu de l'UI : l'aperçu utilise les mêmes
 * métriques de police que le PDF, donc la même mise en page au dixième de mm.
 */
export async function createMeasurer(): Promise<MeasureText> {
  const doc = await PDFDocument.create();
  return measurerFor({
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  });
}

export interface SheetJob {
  code: ResolvedCode;
  /** Libellé produit imprimé au-dessus des barres. */
  name: string;
  spec?: SheetSpec;
  /** Index 0-based de la première étiquette utilisée (planche entamée). */
  startIndex?: number;
  /** Nombre d'étiquettes ; par défaut, jusqu'au bas de la planche. */
  count?: number;
  offset?: PrintOffsetMm;
}

export interface GeneratedPdf {
  bytes: Uint8Array;
  fileName: string;
  /** Nombre d'étiquettes réellement posées sur la planche. */
  labelCount: number;
  /** Index 0-based de la première étiquette utilisée, après bornage. */
  startIndex: number;
  warnings: readonly string[];
}

export async function buildSheetPdf(job: SheetJob): Promise<GeneratedPdf> {
  const spec = job.spec ?? APLI_118990;
  const perSheet = labelsPerSheet(spec);
  const startIndex = clampIndex(job.startIndex ?? 0, perSheet);
  const count = Math.max(
    1,
    Math.min(job.count ?? perSheet - startIndex, perSheet - startIndex),
  );
  const offset = job.offset ?? NO_OFFSET;

  const pattern = barPattern(job.code.symbology, job.code.value);
  const safeName = sanitizeForPdf(job.name);

  const doc = await PDFDocument.create();
  doc.setTitle(`Étiquettes ${job.code.value}`);
  doc.setSubject(`${spec.reference} — ${spec.name}`);
  doc.setCreator("barcode-generator");
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };

  const content = buildLabelContent({
    spec,
    pattern,
    name: safeName.text,
    humanReadable: job.code.humanReadable,
    measure: measurerFor(fonts),
  });

  const page = doc.addPage([mmToPt(A4_MM.widthMm), mmToPt(A4_MM.heightMm)]);
  const pageHeightPt = page.getHeight();
  const black = rgb(0, 0, 0);

  for (let i = 0; i < count; i++) {
    const slot = labelSlot(spec, startIndex + i, offset);

    for (const bar of content.bars) {
      page.drawRectangle({
        x: mmToPt(slot.xMm + bar.xMm),
        y: pageHeightPt - mmToPt(slot.yMm + bar.yMm + bar.heightMm),
        width: mmToPt(bar.widthMm),
        height: mmToPt(bar.heightMm),
        color: black,
      });
    }

    for (const text of content.texts) {
      page.drawText(text.text, {
        x: mmToPt(slot.xMm + text.xMm),
        y: pageHeightPt - mmToPt(slot.yMm + text.baselineYMm),
        size: text.sizePt,
        font: text.bold ? fonts.bold : fonts.regular,
        color: black,
      });
    }
  }

  const warnings = [...content.warnings];
  if (safeName.changed) {
    warnings.push(
      "Certains caractères du libellé ne sont pas imprimables et ont été remplacés par « ? ».",
    );
  }

  return {
    bytes: await doc.save(),
    fileName: sheetFileName(job.code, job.name),
    labelCount: count,
    startIndex,
    warnings,
  };
}

/**
 * Planche de calibration à imprimer sur papier ordinaire : contour de chaque
 * emplacement + numéro, pour vérifier l'alignement (et le décalage appliqué)
 * avant de consommer un support adhésif.
 */
export async function buildCalibrationPdf(
  spec: SheetSpec = APLI_118990,
  offset: PrintOffsetMm = NO_OFFSET,
): Promise<GeneratedPdf> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Calibration ${spec.reference}`);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([mmToPt(A4_MM.widthMm), mmToPt(A4_MM.heightMm)]);
  const pageHeightPt = page.getHeight();
  const ink = rgb(0.45, 0.45, 0.45);

  page.drawText(
    `Calibration ${spec.reference} — ${spec.name} — décalage X ${offset.xMm.toFixed(1)} mm / Y ${offset.yMm.toFixed(1)} mm`,
    {
      x: mmToPt(sheetMarginsMm(spec).leftMm),
      y: pageHeightPt - mmToPt(5),
      size: 7,
      font,
      color: ink,
    },
  );

  const perSheet = labelsPerSheet(spec);
  for (let i = 0; i < perSheet; i++) {
    const slot = labelSlot(spec, i, offset);
    page.drawRectangle({
      x: mmToPt(slot.xMm),
      y: pageHeightPt - mmToPt(slot.yMm + slot.heightMm),
      width: mmToPt(slot.widthMm),
      height: mmToPt(slot.heightMm),
      borderColor: ink,
      borderWidth: 0.25,
    });
    const labelNumber = String(i + 1);
    page.drawText(labelNumber, {
      x:
        mmToPt(slot.xMm + slot.widthMm / 2) -
        font.widthOfTextAtSize(labelNumber, 6) / 2,
      y: pageHeightPt - mmToPt(slot.yMm + slot.heightMm / 2) - 2,
      size: 6,
      font,
      color: ink,
    });
  }

  return {
    bytes: await doc.save(),
    fileName: `calibration-${spec.id}.pdf`,
    labelCount: perSheet,
    startIndex: 0,
    warnings: [],
  };
}

function clampIndex(index: number, perSheet: number): number {
  if (!Number.isFinite(index)) return 0;
  return Math.min(Math.max(Math.trunc(index), 0), perSheet - 1);
}

export function sheetFileName(code: ResolvedCode, name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const base = slug ? `${slug}-${code.value}` : code.value;
  return `etiquettes-${base}.pdf`;
}
