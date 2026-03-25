import type { ComponentStyle } from '../-types/editor-types';

const SHADOW_MAP: Record<string, string> = {
    none: 'none',
    sm: '0 1px 2px 0 rgba(0,0,0,0.05)',
    md: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1)',
    lg: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
    xl: '0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)',
    '2xl': '0 25px 50px -12px rgba(0,0,0,0.25)',
};

/**
 * Converts a ComponentStyle object to React.CSSProperties.
 * Used by both admin canvas previews and learner renderer.
 */
export function buildComponentStyle(style?: ComponentStyle): React.CSSProperties {
    if (!style) return {};

    const css: React.CSSProperties = {};

    // Spacing
    if (style.paddingTop) css.paddingTop = style.paddingTop;
    if (style.paddingBottom) css.paddingBottom = style.paddingBottom;
    if (style.paddingLeft) css.paddingLeft = style.paddingLeft;
    if (style.paddingRight) css.paddingRight = style.paddingRight;
    if (style.marginTop) css.marginTop = style.marginTop;
    if (style.marginBottom) css.marginBottom = style.marginBottom;

    // Background
    if (style.backgroundColor) css.backgroundColor = style.backgroundColor;
    if (style.backgroundImage && !style.gradient) {
        css.backgroundImage = `url(${style.backgroundImage})`;
        css.backgroundSize = style.backgroundSize || 'cover';
        css.backgroundPosition = style.backgroundPosition || 'center center';
        css.backgroundRepeat = 'no-repeat';
    }

    // Gradient (overrides background image)
    if (style.gradient && style.gradient.stops.length >= 2) {
        const { type, angle, stops } = style.gradient;
        const stopsStr = stops.map((s) => `${s.color} ${s.position}%`).join(', ');
        css.backgroundImage =
            type === 'linear'
                ? `linear-gradient(${angle ?? 180}deg, ${stopsStr})`
                : `radial-gradient(circle, ${stopsStr})`;
    }

    // Border
    if (style.borderWidth && style.borderWidth !== '0') {
        css.borderWidth = style.borderWidth;
        css.borderColor = style.borderColor || '#E5E7EB';
        css.borderStyle = style.borderStyle || 'solid';
    }
    if (style.borderRadius) css.borderRadius = style.borderRadius;

    // Shadow
    if (style.boxShadow) {
        css.boxShadow = SHADOW_MAP[style.boxShadow] ?? style.boxShadow;
    }

    // Effects
    if (style.opacity !== undefined && style.opacity !== 1) css.opacity = style.opacity;
    if (style.maxWidth) css.maxWidth = style.maxWidth;
    if (style.minHeight) css.minHeight = style.minHeight;

    // Typography
    if (style.typography) {
        const t = style.typography;
        if (t.fontFamily) css.fontFamily = t.fontFamily;
        if (t.fontSize) css.fontSize = t.fontSize;
        if (t.fontWeight) css.fontWeight = t.fontWeight;
        if (t.lineHeight) css.lineHeight = t.lineHeight;
        if (t.letterSpacing) css.letterSpacing = t.letterSpacing;
        if (t.textColor) css.color = t.textColor;
        if (t.textAlign) css.textAlign = t.textAlign;
        if (t.textTransform) css.textTransform = t.textTransform;
    }

    return css;
}

/**
 * Merges base style with responsive overrides for a given viewport.
 */
export function mergeResponsiveStyle(
    style: ComponentStyle | undefined,
    viewport: 'desktop' | 'tablet' | 'mobile',
): ComponentStyle | undefined {
    if (!style) return undefined;
    if (viewport === 'desktop') return style;
    const overrides = viewport === 'tablet' ? style.responsive?.tablet : style.responsive?.mobile;
    if (!overrides) return style;
    return { ...style, ...overrides };
}

/**
 * Checks if a component is visible at the given viewport.
 */
export function isVisibleAtViewport(
    style: ComponentStyle | undefined,
    viewport: 'desktop' | 'tablet' | 'mobile',
): boolean {
    if (!style?.visibility) return true;
    return style.visibility[viewport] !== false;
}

/**
 * Generates a CSS string for responsive media queries (used in learner renderer).
 */
export function buildResponsiveCSS(componentId: string, style?: ComponentStyle): string {
    if (!style?.responsive) return '';

    const lines: string[] = [];
    const selector = `[data-cid="${componentId}"]`;

    if (style.responsive.tablet) {
        const tabletCSS = buildComponentStyle(style.responsive.tablet as ComponentStyle);
        const tabletStr = cssPropertiesToString(tabletCSS);
        if (tabletStr) {
            lines.push(`@media (max-width: 768px) { ${selector} { ${tabletStr} } }`);
        }
    }

    if (style.responsive.mobile) {
        const mobileCSS = buildComponentStyle(style.responsive.mobile as ComponentStyle);
        const mobileStr = cssPropertiesToString(mobileCSS);
        if (mobileStr) {
            lines.push(`@media (max-width: 480px) { ${selector} { ${mobileStr} } }`);
        }
    }

    // Visibility
    if (style.visibility) {
        if (style.visibility.tablet === false) {
            lines.push(`@media (max-width: 768px) { ${selector} { display: none !important; } }`);
        }
        if (style.visibility.mobile === false) {
            lines.push(`@media (max-width: 480px) { ${selector} { display: none !important; } }`);
        }
        if (style.visibility.desktop === false) {
            lines.push(`@media (min-width: 769px) { ${selector} { display: none !important; } }`);
        }
    }

    return lines.join('\n');
}

function cssPropertiesToString(css: React.CSSProperties): string {
    return Object.entries(css)
        .map(([key, value]) => {
            const kebab = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
            return `${kebab}: ${value}`;
        })
        .join('; ');
}
