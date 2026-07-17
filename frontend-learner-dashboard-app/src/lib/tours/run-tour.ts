import type { LearnerTour } from './tour-registry';

/**
 * Run a guided tour with driver.js (lazy-loaded so the library and its CSS
 * stay out of the main bundle until a learner actually starts a tutorial).
 *
 * The caller is responsible for navigating to tour.route first and waiting
 * for the page to settle.
 */
export async function runTour(tour: LearnerTour): Promise<void> {
  const [{ driver }] = await Promise.all([
    import('driver.js'),
    // Vite handles CSS side-effect imports from dynamic import()
    import('driver.js/dist/driver.css'),
  ]);

  const instance = driver({
    showProgress: true,
    progressText: '{{current}} of {{total}}',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Done',
    allowClose: true,
    overlayOpacity: 0.6,
    stagePadding: 6,
    stageRadius: 12,
    popoverClass: 'vacademy-tour-popover',
    steps: tour.steps.map((step) => ({
      // driver.js centers the popover when element is missing/not found,
      // which is exactly the fallback we want on layouts without the anchor.
      element: step.element,
      popover: {
        title: step.title,
        description: step.description,
      },
    })),
  });

  instance.drive();
}
