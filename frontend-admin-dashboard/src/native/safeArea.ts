import { isNative } from './platform';

// Mirrors env(safe-area-inset-*) into JS-readable CSS custom properties so any
// component can read --safe-area-inset-top etc. without re-querying env() (which
// some browsers don't expose to getComputedStyle).
//
// We set these on :root for both web and native; on the web they degrade to 0
// where the device has no insets. The values come from a hidden probe element
// because env() inside a CSS variable resolves at use-site, not at definition.

const PROBE_ID = '__vim_safe_area_probe__';

function ensureProbe(): HTMLDivElement {
    let probe = document.getElementById(PROBE_ID) as HTMLDivElement | null;
    if (probe) return probe;
    probe = document.createElement('div');
    probe.id = PROBE_ID;
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = [
        'position:fixed',
        'inset:0',
        'pointer-events:none',
        'visibility:hidden',
        'padding-top:env(safe-area-inset-top)',
        'padding-right:env(safe-area-inset-right)',
        'padding-bottom:env(safe-area-inset-bottom)',
        'padding-left:env(safe-area-inset-left)',
    ].join(';');
    document.body.appendChild(probe);
    return probe;
}

function readInsets(probe: HTMLDivElement) {
    const cs = getComputedStyle(probe);
    return {
        top: parseFloat(cs.paddingTop) || 0,
        right: parseFloat(cs.paddingRight) || 0,
        bottom: parseFloat(cs.paddingBottom) || 0,
        left: parseFloat(cs.paddingLeft) || 0,
    };
}

function apply(insets: ReturnType<typeof readInsets>) {
    const root = document.documentElement;
    root.style.setProperty('--safe-area-inset-top', `${insets.top}px`);
    root.style.setProperty('--safe-area-inset-right', `${insets.right}px`);
    root.style.setProperty('--safe-area-inset-bottom', `${insets.bottom}px`);
    root.style.setProperty('--safe-area-inset-left', `${insets.left}px`);
}

export function initSafeArea(): void {
    // Initial defaults so first paint never reads undefined.
    const root = document.documentElement;
    root.style.setProperty('--safe-area-inset-top', '0px');
    root.style.setProperty('--safe-area-inset-right', '0px');
    root.style.setProperty('--safe-area-inset-bottom', '0px');
    root.style.setProperty('--safe-area-inset-left', '0px');

    if (typeof window === 'undefined') return;

    const probe = ensureProbe();
    const measure = () => apply(readInsets(probe));
    // Two rAFs: first lets the probe lay out, second reads finalized env() values.
    requestAnimationFrame(() => requestAnimationFrame(measure));

    // Insets change on orientation flip and on Android when system bars
    // appear/disappear (e.g. fullscreen video). visualViewport.resize is the
    // most reliable signal across both platforms.
    window.addEventListener('orientationchange', measure);
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
}

export { isNative };
