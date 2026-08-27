import confetti from 'canvas-confetti';

/**
 * A burst when the basket crosses into a better price.
 *
 * Fired only when the saving actually GROWS — adding a subject for a second
 * child does not deepen the discount under per-class pricing, and celebrating
 * it would be congratulating the parent for nothing. Colours come from the
 * institute's own page, so the moment belongs to their brand rather than ours.
 */

const FALLBACK_ACCENT = '#4F46E5'; // design-lint-ignore: confetti fallback when no theme colour resolves

/**
 * canvas-confetti parses hex only. The product page hands us a hex string
 * directly; the catalogue themes through CSS custom properties holding bare
 * HSL triplets, so anything else is resolved through the browser first.
 */
function toHex(color: string | undefined): string {
    if (!color) return FALLBACK_ACCENT;
    if (/^#[0-9a-f]{3,8}$/i.test(color.trim())) return color.trim();
    if (typeof document === 'undefined') return FALLBACK_ACCENT;
    try {
        const probe = document.createElement('span');
        probe.style.color = color;
        probe.style.display = 'none';
        document.body.appendChild(probe);
        const resolved = getComputedStyle(probe).color;
        probe.remove();
        const parts = resolved.match(/\d+/g);
        if (!parts || parts.length < 3) return FALLBACK_ACCENT;
        return (
            '#' +
            parts
                .slice(0, 3)
                .map((n) => Number(n).toString(16).padStart(2, '0'))
                .join('')
        );
    } catch {
        return FALLBACK_ACCENT;
    }
}

/**
 * Reads the catalogue theme's own primary colour off an element.
 *
 * The catalogue stores it as a bare HSL triplet ("220 90% 56%") for use inside
 * hsl(), which is not a colour on its own — hence the wrap.
 */
export function accentFromTheme(el: HTMLElement | null | undefined): string | undefined {
    if (!el || typeof getComputedStyle === 'undefined') return undefined;
    const triplet = getComputedStyle(el).getPropertyValue('--primary-500').trim();
    if (!triplet) return undefined;
    return triplet.startsWith('#') || triplet.startsWith('rgb') ? triplet : `hsl(${triplet})`;
}

export function celebrateSaving(accent?: string): void {
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
        colors: [toHex(accent), '#16A34A', '#FACC15', '#FFFFFF'], // design-lint-ignore: confetti particle colours
        disableForReducedMotion: true,
    });
}
