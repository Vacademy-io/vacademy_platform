/**
 * Shot-level transitions.
 *
 * Two code paths share the same animation definitions:
 *   - Editor preview: `computePreviewStyle()` interpolates in JS at the
 *     current scrub time so scrubbing stays frame-accurate (CSS animations
 *     are tied to element mount, not to a clock).
 *   - Render export:  `buildTransitionCss()` emits CSS keyframes + an
 *     `animation` shorthand that a headless browser plays continuously.
 *
 * Both paths produce identical visuals; they just arrive at them differently.
 */

export type TransitionType =
    | 'fade'
    | 'slide-l'
    | 'slide-r'
    | 'slide-u'
    | 'slide-d'
    | 'zoom-in'
    | 'zoom-out';

export interface Transition {
    type: TransitionType;
    /** Seconds — clamped by caller so the pair can't exceed the shot length. */
    duration: number;
    /** CSS timing function. Default `ease`. */
    easing?: string;
}

export interface TransitionPair {
    in?: Transition;
    out?: Transition;
}

export const TRANSITION_OPTIONS: Array<{ value: TransitionType; label: string }> = [
    { value: 'fade', label: 'Fade' },
    { value: 'slide-l', label: 'Slide ←' },
    { value: 'slide-r', label: 'Slide →' },
    { value: 'slide-u', label: 'Slide ↑' },
    { value: 'slide-d', label: 'Slide ↓' },
    { value: 'zoom-in', label: 'Zoom in' },
    { value: 'zoom-out', label: 'Zoom out' },
];

/**
 * Curated easing presets surfaced as the primary picker in the Motion tab.
 * Non-coders see a friendly label; the underlying value is a standard CSS
 * timing function (or `cubic-bezier(...)`). The `id` is what we match
 * against existing `transition.easing` strings to highlight the current
 * preset; anything not in the list is "Custom" and falls into the
 * Advanced text input.
 */
export interface EasingPreset {
    id: string;
    label: string;
    /** The exact CSS value written to `transition.easing`. */
    css: string;
    /** Short hint for tooltips — describes the visual feel. */
    description: string;
}

export const EASING_PRESETS: EasingPreset[] = [
    {
        id: 'smooth',
        label: 'Smooth',
        css: 'ease',
        description: 'Default — eases in and out gently.',
    },
    {
        id: 'fast',
        label: 'Fast',
        css: 'ease-out',
        description: 'Starts fast, slows to a stop.',
    },
    {
        id: 'slow',
        label: 'Slow',
        css: 'ease-in',
        description: 'Starts slow, ends fast.',
    },
    {
        id: 'linear',
        label: 'Linear',
        css: 'linear',
        description: 'Constant speed throughout.',
    },
    {
        id: 'bouncy',
        label: 'Bouncy',
        css: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        description: 'Overshoots slightly, settles back. Adds energy.',
    },
];

/** Match a CSS easing string to one of our presets, falling back to
 *  null when the value is a custom timing function. */
export function easingPresetFor(css: string | undefined): EasingPreset | null {
    if (!css) return EASING_PRESETS[0]!; // default 'Smooth' when nothing set
    return EASING_PRESETS.find((p) => p.css === css) ?? null;
}

const DEFAULT_EASING = 'ease';

// ── Preview interpolation (JS, for the editor canvas) ──────────────────────

/**
 * Given shot-local time `t` (seconds, 0 = shot start) and shot duration,
 * return an inline-style object to apply to the shot wrapper. Returns an
 * empty object when no transition is active at this moment.
 */
export function computePreviewStyle(
    t: number,
    shotDuration: number,
    pair: TransitionPair | undefined
): React.CSSProperties {
    if (!pair || (!pair.in && !pair.out)) return {};
    if (t < 0) t = 0;
    if (shotDuration <= 0) return {};

    // Inbound transition — plays from t=0 to t=in.duration.
    if (pair.in && t < pair.in.duration) {
        const p = Math.max(0, Math.min(1, t / pair.in.duration));
        return frameStyle(pair.in.type, 'in', p);
    }

    // Outbound — plays from t=shotDur-out.duration to t=shotDur.
    if (pair.out) {
        const outStart = shotDuration - pair.out.duration;
        if (t >= outStart) {
            const p = Math.max(0, Math.min(1, (t - outStart) / pair.out.duration));
            return frameStyle(pair.out.type, 'out', p);
        }
    }

    return {};
}

/**
 * Shape of the wrapper at progress `p` (0 = start of transition, 1 = end).
 * For `in` transitions the shot starts invisible/offscreen and resolves to
 * identity at p=1. For `out` it's the reverse.
 */
function frameStyle(type: TransitionType, direction: 'in' | 'out', p: number): React.CSSProperties {
    // For outgoing animations, the progress runs 0→1 but visually we need
    // identity→hidden. Invert by using (1-p) for any interpolation below.
    const e = direction === 'in' ? p : 1 - p;

    switch (type) {
        case 'fade':
            return { opacity: e };
        case 'slide-l':
            return { transform: `translateX(${(e - 1) * 100}%)`, opacity: e };
        case 'slide-r':
            return { transform: `translateX(${(1 - e) * 100}%)`, opacity: e };
        case 'slide-u':
            return { transform: `translateY(${(e - 1) * 100}%)`, opacity: e };
        case 'slide-d':
            return { transform: `translateY(${(1 - e) * 100}%)`, opacity: e };
        case 'zoom-in':
            // Start small, grow to identity.
            return { transform: `scale(${0.6 + 0.4 * e})`, opacity: e };
        case 'zoom-out':
            // Start large, shrink to identity.
            return { transform: `scale(${1.4 - 0.4 * e})`, opacity: e };
    }
}

// ── CSS emission (for the saved HTML consumed by the render pipeline) ──────

/**
 * Build the CSS pieces needed to animate a shot wrapper: a list of
 * `animation` shorthand values and the `<style>` body that declares the
 * required keyframes. Returned keyframe names are prefixed with `vx-` and
 * are safe to inline into a per-shot `<style>` block (each shot renders in
 * its own iframe, so collisions across shots don't matter).
 */
export function buildTransitionCss(
    pair: TransitionPair | undefined,
    shotDuration: number
): { animation: string; keyframes: string } | null {
    if (!pair || (!pair.in && !pair.out)) return null;

    const animations: string[] = [];
    const keyframes: string[] = [];
    const seen = new Set<string>();

    const add = (t: Transition, direction: 'in' | 'out', delay: number) => {
        const name = `vx-${t.type}-${direction}`;
        const dur = Math.max(0.01, t.duration);
        const easing = t.easing ?? DEFAULT_EASING;
        animations.push(`${name} ${dur}s ${easing} ${delay}s both`);
        if (!seen.has(name)) {
            seen.add(name);
            keyframes.push(keyframeBlock(name, t.type, direction));
        }
    };

    if (pair.in) add(pair.in, 'in', 0);
    if (pair.out) {
        const delay = Math.max(0, shotDuration - pair.out.duration);
        add(pair.out, 'out', delay);
    }

    return { animation: animations.join(', '), keyframes: keyframes.join('\n') };
}

function keyframeBlock(name: string, type: TransitionType, direction: 'in' | 'out'): string {
    // Encode the same endpoints as frameStyle(); CSS runs them continuously.
    const from = direction === 'in' ? stateAt(type, 0) : stateAt(type, 1);
    const to = direction === 'in' ? stateAt(type, 1) : stateAt(type, 0);
    return `@keyframes ${name}{from{${from}}to{${to}}}`;
}

function stateAt(type: TransitionType, unit: 0 | 1): string {
    // unit=1 is the identity (fully visible, no transform). unit=0 is the "hidden/offscreen" endpoint.
    if (unit === 1) return 'opacity:1;transform:none';
    switch (type) {
        case 'fade':
            return 'opacity:0';
        case 'slide-l':
            return 'opacity:0;transform:translateX(-100%)';
        case 'slide-r':
            return 'opacity:0;transform:translateX(100%)';
        case 'slide-u':
            return 'opacity:0;transform:translateY(-100%)';
        case 'slide-d':
            return 'opacity:0;transform:translateY(100%)';
        case 'zoom-in':
            return 'opacity:0;transform:scale(0.6)';
        case 'zoom-out':
            return 'opacity:0;transform:scale(1.4)';
    }
}
