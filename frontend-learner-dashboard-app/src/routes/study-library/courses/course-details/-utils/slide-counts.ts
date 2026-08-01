import type { SlideCountType } from "./course-details-types";

export type ProcessedSlideCount = {
  source_type: string;
  slide_count: number;
  display_name: string;
};

const DISPLAY_NAMES: Record<string, string> = {
  VIDEO: "Video slides",
  CODE: "Code slides",
  PDF: "PDF slides",
  DOCUMENT: "DOC slides",
  QUESTION: "Question slides",
  ASSIGNMENT: "Assignment slides",
  PRESENTATION: "Presentation slides",
  JUPYTER_NOTEBOOK: "Jupyter Notebook slides",
  JUPYTER: "Jupyter Notebook slides",
  SCRATCH_PROJECT: "Scratch Project slides",
  SCRATCH: "Scratch Project slides",
  QUIZ: "Quiz slides",
  CODE_EDITOR: "Code Editor slides",
};

// Collapses the raw per-source counts into display rows. DOCUMENT is a
// catch-all bucket on the backend, so it is suppressed whenever specific
// document types (Jupyter, code editor, presentation, Scratch) are present —
// otherwise the same slides would be counted twice.
export function processSlideCounts(
  counts: SlideCountType[] | null | undefined,
): ProcessedSlideCount[] {
  if (!counts) return [];

  const typeCounts: { [key: string]: number } = {};

  const hasSpecificDocumentTypes = counts.some(
    (count) =>
      count.source_type === "JUPYTER_NOTEBOOK" ||
      count.source_type === "CODE_EDITOR" ||
      count.source_type === "PRESENTATION" ||
      count.source_type === "SCRATCH_PROJECT",
  );

  counts.forEach((count) => {
    let canonicalType = count.source_type;
    if (canonicalType === "JUPYTER") canonicalType = "JUPYTER_NOTEBOOK";
    if (canonicalType === "SCRATCH") canonicalType = "SCRATCH_PROJECT";
    if (canonicalType === "DOCUMENT") {
      if (!hasSpecificDocumentTypes) {
        typeCounts["DOCUMENT"] =
          (typeCounts["DOCUMENT"] || 0) + count.slide_count;
      }
    } else {
      typeCounts[canonicalType] =
        (typeCounts[canonicalType] || 0) + count.slide_count;
    }
  });

  return Object.entries(typeCounts).map(([sourceType, slideCount]) => ({
    source_type: sourceType,
    slide_count: slideCount,
    display_name: DISPLAY_NAMES[sourceType] ?? `${sourceType} slides`,
  }));
}
