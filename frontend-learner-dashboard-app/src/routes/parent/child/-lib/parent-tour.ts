// A gentle guided tour for parents, using driver.js (lazy-loaded so the library
// and its CSS stay out of the main bundle until a parent starts the walkthrough).
// Mirrors the learner run-tour; reuses the same popover styling.

export interface ParentTourStep {
  /** CSS selector to highlight; omit for a centered explainer step. */
  element?: string;
  title: string;
  description: string;
}

export async function runParentTour(steps: ParentTourStep[]): Promise<void> {
  const [{ driver }] = await Promise.all([
    import("driver.js"),
    import("driver.js/dist/driver.css"),
  ]);

  driver({
    showProgress: true,
    progressText: "{{current}} of {{total}}",
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Got it",
    allowClose: true,
    overlayOpacity: 0.6,
    stagePadding: 6,
    stageRadius: 12,
    popoverClass: "vacademy-tour-popover",
    steps: steps.map((s) => ({
      element: s.element,
      popover: { title: s.title, description: s.description },
    })),
  }).drive();
}
