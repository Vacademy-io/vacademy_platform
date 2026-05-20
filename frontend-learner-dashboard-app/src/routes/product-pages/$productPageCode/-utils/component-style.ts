import type React from 'react';
import type { ComponentStyleLite } from '../-types/product-page-types';

const SHADOW_MAP: Record<string, string> = {
    sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
    md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
    xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
};

export function buildComponentStyle(style?: ComponentStyleLite): React.CSSProperties {
    if (!style) return {};
    const css: React.CSSProperties = {};

    if (style.paddingTop) css.paddingTop = style.paddingTop;
    if (style.paddingBottom) css.paddingBottom = style.paddingBottom;
    if (style.paddingLeft) css.paddingLeft = style.paddingLeft;
    if (style.paddingRight) css.paddingRight = style.paddingRight;
    if (style.marginTop) css.marginTop = style.marginTop;
    if (style.marginBottom) css.marginBottom = style.marginBottom;

    if (style.backgroundColor) css.backgroundColor = style.backgroundColor;

    if (style.borderStyle && style.borderStyle !== 'none') {
        css.borderStyle = style.borderStyle;
        if (style.borderWidth) css.borderWidth = style.borderWidth;
        if (style.borderColor) css.borderColor = style.borderColor;
    }
    if (style.borderRadius) css.borderRadius = style.borderRadius;

    if (style.opacity !== undefined && style.opacity < 1) css.opacity = style.opacity;

    if (style.boxShadow && style.boxShadow !== 'none') {
        css.boxShadow = SHADOW_MAP[style.boxShadow] ?? style.boxShadow;
    }

    if (style.maxWidth) css.maxWidth = style.maxWidth;
    if (style.minHeight) css.minHeight = style.minHeight;

    if (style.typography) {
        const t = style.typography;
        if (t.fontSize) css.fontSize = t.fontSize;
        if (t.fontWeight) css.fontWeight = t.fontWeight as React.CSSProperties['fontWeight'];
        if (t.lineHeight) css.lineHeight = t.lineHeight;
        if (t.letterSpacing) css.letterSpacing = t.letterSpacing;
        if (t.textColor) css.color = t.textColor;
        if (t.textAlign) css.textAlign = t.textAlign;
    }

    return css;
}

const KEYFRAMES = `
@keyframes _dp_fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes _dp_fadeInUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes _dp_fadeInDown { from { opacity: 0; transform: translateY(-24px); } to { opacity: 1; transform: translateY(0); } }
@keyframes _dp_fadeInLeft { from { opacity: 0; transform: translateX(-24px); } to { opacity: 1; transform: translateX(0); } }
@keyframes _dp_fadeInRight { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }
@keyframes _dp_scaleUp { from { opacity: 0; transform: scale(0.92); } to { opacity: 1; transform: scale(1); } }
@keyframes _dp_slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
`;

let keyframesInjected = false;
function ensureAnimationKeyframes() {
    if (keyframesInjected || typeof document === 'undefined') return;
    keyframesInjected = true;
    const tag = document.createElement('style');
    tag.id = 'dp-keyframes';
    tag.textContent = KEYFRAMES;
    document.head.appendChild(tag);
}

export function getAnimationStyle(style?: ComponentStyleLite): React.CSSProperties {
    const entrance = style?.animation?.entrance;
    if (!entrance || entrance.type === 'none') return {};
    ensureAnimationKeyframes();
    const map: Record<string, string> = {
        fadeIn: '_dp_fadeIn',
        fadeInUp: '_dp_fadeInUp',
        fadeInDown: '_dp_fadeInDown',
        fadeInLeft: '_dp_fadeInLeft',
        fadeInRight: '_dp_fadeInRight',
        scaleUp: '_dp_scaleUp',
        slideUp: '_dp_slideUp',
    };
    const name = map[entrance.type];
    if (!name) return {};
    const duration = entrance.duration ?? 600;
    const delay = entrance.delay ?? 0;
    const easing = entrance.easing ?? 'ease-out';
    return { animation: `${name} ${duration}ms ${easing} ${delay}ms both` };
}
