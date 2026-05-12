import jsPDF from "jspdf";
import type { CheckHistory } from "@/lib/db";
import { lookupDrugMonograph } from "@/lib/drug-lookup";
import { lookupPairExplanation } from "@/lib/pair-explanation-lookup";
import { simpleInteractionHeadline } from "@/lib/ddi-report-labels";
import type { ClinicalInteractionPdfPayload } from "@/lib/pdf-check-types";
import { buildCombinationExplanationBlocks } from "@/lib/combination-explanation";

const M = 14;
const PAGE_W = 210;
const PAGE_H = 297;
const MAX_W = PAGE_W - 2 * M;
const FOOTER_Y = PAGE_H - 12;
const HEADER_H = 28;

type Rgb = [number, number, number];

const BRAND: Rgb = [79, 70, 229];
const NAVY: Rgb = [15, 23, 42];
const MUTED: Rgb = [100, 116, 139];

function severityHeroPalette(check: ClinicalInteractionPdfPayload): {
  bg: Rgb;
  accent: Rgb;
  text: Rgb;
} {
  const neutral =
    check.identicalCompoundPair ||
    check.source === "structure_similarity" ||
    !!(check.structureNote && check.source === "structure_fp");
  if (neutral) {
    return { bg: [241, 245, 249], accent: [100, 116, 139], text: [51, 65, 85] };
  }
  switch (check.severity) {
    case "none":
      return { bg: [236, 253, 245], accent: [34, 197, 94], text: [20, 83, 45] };
    case "moderate":
      return { bg: [255, 251, 235], accent: [245, 158, 11], text: [120, 53, 15] };
    case "severe":
      return { bg: [255, 241, 242], accent: [244, 63, 94], text: [136, 19, 55] };
  }
}

function nextY(doc: jsPDF, y: number, step: number): number {
  if (y + step > FOOTER_Y - 14) {
    doc.addPage();
    drawContinuationHeader(doc);
    return 22;
  }
  return y + step;
}

/** Slim brand strip on pages after the first (full header drawn separately). */
function drawContinuationHeader(doc: jsPDF) {
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, PAGE_W, 5, "F");
}

function drawDocumentHeader(doc: jsPDF, mainTitle: string, tagline: string) {
  doc.setFillColor(...BRAND);
  doc.rect(0, 0, PAGE_W, HEADER_H, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text(mainTitle, M, 12);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(199, 210, 254);
  doc.text(tagline, M, 21);
}

function drawResultHero(doc: jsPDF, y: number, check: ClinicalInteractionPdfPayload): number {
  const headline = simpleInteractionHeadline({
    severity: check.severity,
    source: check.source,
    structureNote: check.structureNote,
    identicalCompoundPair: check.identicalCompoundPair,
  });
  const { bg, accent, text } = severityHeroPalette(check);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  const lines = doc.splitTextToSize(headline, MAX_W - 20);
  const lh = 15 * 0.45 + 4;
  const innerH = Math.max(16, lines.length * lh + 10);
  const cardH = innerH + 6;
  const cardW = MAX_W;
  const rx = 4;

  doc.setFillColor(...bg);
  doc.roundedRect(M, y, cardW, cardH, rx, rx, "F");
  doc.setFillColor(...accent);
  doc.rect(M, y, 4.2, cardH, "F");

  doc.setTextColor(...text);
  let ty = y + 8;
  for (const line of lines) {
    doc.text(line, M + 11, ty);
    ty += lh;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  const checked = new Date(check.checkedAtIso).toLocaleString();
  let baseline = y + cardH + 6;
  if (baseline + 8 > FOOTER_Y - 14) {
    doc.addPage();
    drawContinuationHeader(doc);
    baseline = 22;
  }
  doc.text(`Checked: ${checked}`, M, baseline);

  return baseline + 6;
}

function writeStyledSectionHeading(doc: jsPDF, y: number, title: string): number {
  y = nextY(doc, y, 14);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...NAVY);
  doc.text(title, M, y);
  const w = doc.getTextWidth(title);
  doc.setDrawColor(...BRAND);
  doc.setLineWidth(0.5);
  doc.line(M, y + 1.5, M + Math.min(w, MAX_W), y + 1.5);
  doc.setFont("helvetica", "normal");
  return y + 10;
}

function drawDrugPairCard(doc: jsPDF, y: number, drug1: string, drug2: string): number {
  const label = `${drug1.trim()}  +  ${drug2.trim()}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const lines = doc.splitTextToSize(label, MAX_W - 10);
  const lh = 13 * 0.45 + 3.5;
  const h = lines.length * lh + 12;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(M, y, MAX_W, h, 3, 3, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(M, y, MAX_W, h, 3, 3, "S");

  doc.setTextColor(...NAVY);
  let ty = y + 9;
  for (const line of lines) {
    doc.text(line, M + 5, ty);
    ty += lh;
  }
  doc.setFont("helvetica", "normal");
  return y + h + 8;
}

function writeParagraphBlock(doc: jsPDF, y: number, text: string, fontSize = 10): number {
  const t = (text ?? "").trim();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(51, 65, 85);
  const lh = fontSize * 0.45 + 3.2;
  if (!t) {
    y = nextY(doc, y, lh);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...MUTED);
    doc.text("—", M, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(51, 65, 85);
    return y + 6;
  }
  const wrapped = doc.splitTextToSize(t, MAX_W);
  for (const line of wrapped) {
    y = nextY(doc, y, lh);
    doc.text(line, M, y);
  }
  return y + 6;
}

function writeCombinationExplanation(doc: jsPDF, y: number, check: ClinicalInteractionPdfPayload): number {
  for (const block of buildCombinationExplanationBlocks(check)) {
    if (block.heading) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...NAVY);
      const titleLines = doc.splitTextToSize(block.heading, MAX_W);
      const lhT = 11 * 0.45 + 3.2;
      for (const line of titleLines) {
        y = nextY(doc, y, lhT);
        doc.text(line, M, y);
      }
      y += 3;
      doc.setFont("helvetica", "normal");
    }
    y = writeParagraphBlock(doc, y, block.body);
  }
  return y;
}

function footerOnAllPages(doc: jsPDF) {
  const disclaimer =
    "Educational support only — not a substitute for your clinician, pharmacist, or official prescribing information.";
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(M, FOOTER_Y - 4, PAGE_W - M, FOOTER_Y - 4);
    doc.setFontSize(8);
    doc.setTextColor(120, 125, 140);
    doc.setFont("helvetica", "italic");
    const lines = doc.splitTextToSize(disclaimer, MAX_W);
    const lh = 8 * 0.4 + 1.5;
    const fy = FOOTER_Y - (lines.length - 1) * lh;
    doc.text(lines, M, fy);
    doc.setFont("helvetica", "normal");
  }
}

function writeEducationalSections(doc: jsPDF, y: number, check: ClinicalInteractionPdfPayload): number {
  y = writeStyledSectionHeading(doc, y, "About this combination");
  y = writeCombinationExplanation(doc, y, check);

  y = writeStyledSectionHeading(doc, y, "About each medication");
  const monoLabels = check.identicalCompoundPair
    ? [check.drug1]
    : ([check.drug1, check.drug2] as const);
  for (const label of monoLabels) {
    const m = lookupDrugMonograph(label);
    if (m) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...NAVY);
      y = nextY(doc, y, 12);
      doc.text(`${m.displayName} — ${m.drugClass}`, M, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      y = writeParagraphBlock(doc, y, m.description);
    } else {
      y = writeParagraphBlock(doc, y, `${label.trim()}: no offline description for this spelling in the app.`);
    }
  }
  return y;
}

function historyRowToPdfPayload(h: CheckHistory): ClinicalInteractionPdfPayload {
  const source: ClinicalInteractionPdfPayload["source"] = h.source ?? "structure_fp";
  return {
    drug1: h.drug1,
    drug2: h.drug2,
    severity: h.severity,
    confidence: h.confidence,
    classProbs: h.classProbs,
    source,
    latencyMs: h.latencyMs,
    checkedAtIso: new Date(h.timestamp).toISOString(),
    pairExplanation: lookupPairExplanation(h.drug1.trim(), h.drug2.trim()),
    tanimoto: h.tanimoto,
    structureNote: h.notes,
  };
}

/** PDF for the single check shown on the dashboard (not full history). */
export function generateCurrentInteractionPdf(check: ClinicalInteractionPdfPayload): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawDocumentHeader(doc, "ClinicalDDI", "Interaction report");

  let y = HEADER_H + 10;
  y = drawResultHero(doc, y, check);
  y = writeStyledSectionHeading(doc, y, "Medications checked");
  y = drawDrugPairCard(doc, y, check.drug1, check.drug2);
  writeEducationalSections(doc, y, check);

  footerOnAllPages(doc);

  const safe = (s: string) =>
    s
      .replace(/[^\w\-]+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 40);
  doc.save(`ClinicalDDI_Check_${safe(check.drug1)}_${safe(check.drug2)}_${check.checkedAtIso.slice(0, 10)}.pdf`);
}

/** Append all IndexedDB history rows into one downloadable PDF (newest-first order preserved). */
export function generateHistoryPdf(rows: CheckHistory[]): void {
  if (rows.length === 0) return;

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  drawDocumentHeader(doc, "ClinicalDDI", "Saved interaction history");

  let y = HEADER_H + 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  y = nextY(doc, y, 12);
  doc.text(`Export date: ${new Date().toLocaleString()}`, M, y);
  y += 6;
  y = nextY(doc, y, 10);
  doc.text(`Checks in this file: ${rows.length}`, M, y);
  y += 12;

  for (let i = 0; i < rows.length; i++) {
    const payload = historyRowToPdfPayload(rows[i]!);
    y = writeStyledSectionHeading(doc, y, `Saved check ${i + 1} of ${rows.length}`);
    y = drawResultHero(doc, y, payload);
    y = writeStyledSectionHeading(doc, y, "Medications checked");
    y = drawDrugPairCard(doc, y, payload.drug1, payload.drug2);
    y = writeEducationalSections(doc, y, payload);
    y += 6;
  }

  footerOnAllPages(doc);

  const exportedIso = new Date().toISOString();
  doc.save(`ClinicalDDI_History_${exportedIso.slice(0, 10)}.pdf`);
}
