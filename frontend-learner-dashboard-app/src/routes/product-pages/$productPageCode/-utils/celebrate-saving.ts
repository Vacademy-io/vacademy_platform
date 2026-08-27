import confetti from 'canvas-confetti';

/**
 * A burst when the basket crosses into a better price.
 *
 * Fired only when the saving actually GROWS — adding a subject for a second
 * child does not deepen the discount under per-class pricing, and celebrating
 * it would be congratulating the parent for nothing. Colours come from the
 * institute's own page, so the moment belongs to their brand rather than ours.
 */
export function celebrateSaving(accent: string): void {
    if (
        typeof window === 'undefined' ||
        window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
        return;
    }
    confetti({
        particleCount: 70,
        spread: 62,
        startVelocity: 32,
        // Low, so it rises out of the basket bar rather than the page middle.
        origin: { y: 0.92 },
        scalar: 0.85,
        ticks: 140,
        colors: [accent, '#16A34A', '#FACC15', '#FFFFFF'], // design-lint-ignore: confetti particle colours
        disableForReducedMotion: true,
    });
}
