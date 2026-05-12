import { simpleInteractionHeadline } from "@/lib/ddi-report-labels";
import type { ClinicalInteractionPdfPayload } from "@/lib/pdf-check-types";

export type CombinationExplanationBlock = {
  /** Optional short heading shown above the paragraph */
  heading?: string;
  body: string;
};

/**
 * Plain-language explanation of *why* the app shows this headline — used in
 * the dashboard modal and in the PDF "About this combination" section.
 */
export function buildCombinationExplanationBlocks(p: ClinicalInteractionPdfPayload): CombinationExplanationBlock[] {
  const blocks: CombinationExplanationBlock[] = [];

  if (p.identicalCompoundPair) {
    blocks.push({
      body: "Both entries resolved to the same medication. This tool compares two different drugs, so there is no separate interaction to score between a drug and itself.",
    });
    return blocks;
  }

  if (p.source === "structure_similarity") {
    blocks.push({
      heading: "Why you see this message",
      body: `The checker could not run the usual comparison for ${p.drug1.trim()} and ${p.drug2.trim()}. ${p.structureNote ?? "Similarity-only information was shown instead."}`,
    });
    return blocks;
  }

  if (p.structureNote && p.source === "structure_fp") {
    blocks.push({
      heading: "Incomplete check",
      body: `${p.structureNote} This result should not be read as proof that the medicines are safe or unsafe together.`,
    });
    return blocks;
  }

  if (p.clinicalReliefPair && p.pairExplanation) {
    blocks.push({
      heading: p.pairExplanation.title,
      body: p.pairExplanation.text,
    });
    blocks.push({
      heading: "How to read this",
      body: "For this pair, common references often describe co-use more calmly than a strict automated score might suggest. The app therefore shows a milder headline while keeping the note above for context. Always confirm with your clinician or pharmacist for your situation.",
    });
    return blocks;
  }

  if (p.pairExplanation) {
    blocks.push({
      heading: p.pairExplanation.title,
      body: p.pairExplanation.text,
    });
  }

  const headline = simpleInteractionHeadline({
    severity: p.severity,
    source: p.source,
    structureNote: p.structureNote,
    identicalCompoundPair: p.identicalCompoundPair,
  });

  const severityBody =
    p.severity === "severe"
      ? `The headline “${headline}” means the on-device model put the most weight on the highest concern bucket. That is a statistical hint from molecular comparison, not proof that you will have a problem, and not a replacement for a prescriber or pharmacist who can review doses, kidney and liver function, other drugs you take, and official interaction references.`
      : p.severity === "moderate"
        ? `The headline “${headline}” means the model leaned toward a middle level of concern—enough to discuss with a professional if both medicines are truly intended together. It does not predict your personal risk.`
        : `The headline “${headline}” means the model’s strongest signal was in the lower-concern range. That does not guarantee zero risk for every person.`;

  blocks.push({
    heading: "What the on-device score means",
    body: `ClinicalDDI compared the two structures privately on your device. ${severityBody}`,
  });

  if (!p.pairExplanation && !p.clinicalReliefPair) {
    blocks.push({
      heading: "Pair-specific mechanisms",
      body: "This app does not store a hand-written clinical paragraph for every possible pair. A pharmacist or prescriber can explain mechanisms that may matter for you—for example shared liver enzymes, QT effects on heart rhythm, bleeding risk, kidney handling, or additive side effects.",
    });
  }

  return blocks;
}
