/**
 * Will a real value fit the box the admin drew?
 *
 * <p>A certificate field is sized at design time but filled at issuance. "Alex
 * Sample" and "Bhuvaneshwari Ramachandran" go in the same box, and the admin
 * only ever sees the short one. Fields used to be emitted `white-space:nowrap;
 * overflow:hidden`, so the long name was sliced — off both ends, because the box
 * centres its content.
 *
 * <p>The certificate now wraps inside the box the admin drew and the server
 * shrinks the font to fit (CertificateTextFitService). This module is the
 * editor's half: the same arithmetic, so an admin can be told a box is too tight
 * *before* issuing, and so the preview shrinks exactly where the PDF will.
 *
 * <p>Every constant here mirrors CertificateTextFitService. They have to agree —
 * a warning that disagrees with what the server does is worse than no warning.
 */

/**
 * The line budget for a field whose box height was never recorded — templates
 * saved before `data-fit-height` existed. Matches MAX_LINES in
 * CertificateTextFitService.
 */
export const MAX_FIT_LINES = 2;

/** Matches TEXT_LINE_HEIGHT in serialize-image-template-to-html.ts. */
export const LINE_HEIGHT = 1.2;
export const MIN_FONT_SCALE = 0.5;
export const MIN_FONT_PX = 6;
export const FONT_STEP = 0.94;
const SAFETY_MARGIN = 1.02;
const BOLD_WIDTH_FACTOR = 1.05;

/**
 * Advance width as a fraction of the font size, for a proportional sans face.
 * Grouped rather than per-glyph: 'a' versus 'e' never decides whether a name
 * needs a third line, but 'i' versus 'W' routinely does.
 */
const charWidthEm = (c: string): number => {
    if ("ijlI.,:;'`|![](){}".includes(c)) return 0.28;
    if ('frt -'.includes(c)) return 0.33;
    if ('mwMW@'.includes(c)) return 0.85;
    if (c >= 'A' && c <= 'Z') return 0.67;
    if (c >= '0' && c <= '9') return 0.56;
    if (c >= 'a' && c <= 'z') return 0.55;
    // Accented Latin, CJK, anything unlisted. Over-estimating is the safe
    // direction: it shrinks a little early rather than overflowing.
    return 1.0;
};

/** Estimated rendered width in px. */
export const estimateTextWidth = (text: string, fontSizePx: number, bold = false): number => {
    let ems = 0;
    for (const char of text) ems += charWidthEm(char);
    return ems * fontSizePx * SAFETY_MARGIN * (bold ? BOLD_WIDTH_FACTOR : 1);
};

/**
 * Lines a greedy word-wrap produces. A word wider than the line is broken across
 * lines rather than counted as one, matching the `overflow-wrap:break-word` the
 * serializer emits — without that an unbroken 40-character token would look like
 * it fits on one line and never trigger a shrink.
 */
export const linesNeeded = (
    text: string,
    widthPx: number,
    fontSizePx: number,
    bold = false
): number => {
    if (!text?.trim() || widthPx <= 0) return 1;
    const spaceWidth = estimateTextWidth(' ', fontSizePx, bold);
    let lines = 1;
    let used = 0;

    for (const word of text.trim().split(/\s+/)) {
        if (!word) continue;
        const wordWidth = estimateTextWidth(word, fontSizePx, bold);

        if (wordWidth > widthPx) {
            if (used > 0) {
                lines++;
                used = 0;
            }
            const fullLines = Math.floor(wordWidth / widthPx);
            lines += fullLines;
            used = wordWidth - fullLines * widthPx;
            continue;
        }

        const needed = used > 0 ? used + spaceWidth + wordWidth : wordWidth;
        if (needed <= widthPx) {
            used = needed;
        } else {
            lines++;
            used = wordWidth;
        }
    }
    return lines;
};

/**
 * Lines the box can show at this size — the vertical budget. Mirrors
 * `linesThatFit` in serialize-image-template-to-html.ts and
 * `linesAllowed` in CertificateTextFitService.
 *
 * A height of 0 means "not recorded" (a template saved before the height was
 * emitted), and falls back to the historical flat two-line budget.
 */
export const linesAllowed = (heightPx: number, fontSizePx: number): number => {
    if (!(heightPx > 0) || !(fontSizePx > 0)) return MAX_FIT_LINES;
    return Math.max(1, Math.floor(heightPx / (fontSizePx * LINE_HEIGHT) + 0.02));
};

/**
 * Largest size at or below `fontSizePx` whose wrapped text fits the box.
 *
 * `heightPx` is the box's content height. Pass 0 for a template that never
 * recorded one, which keeps the old width-only, two-line behaviour.
 */
export const fitFontSize = (
    text: string,
    widthPx: number,
    fontSizePx: number,
    bold = false,
    heightPx = 0
): number => {
    const floor = Math.max(MIN_FONT_PX, fontSizePx * MIN_FONT_SCALE);
    let size = fontSizePx;
    while (size > floor) {
        if (linesNeeded(text, widthPx, size, bold) <= linesAllowed(heightPx, size)) return size;
        size *= FONT_STEP;
    }
    return Math.min(fontSizePx, floor);
};

/**
 * A realistically long value for each field, used to tell an admin whether the
 * box they drew survives contact with real data. These are the values that
 * actually cause trouble in production — long South Asian names and the kind of
 * course title institutes really use — not worst-case synthetic strings.
 */
export const LONG_SAMPLES: Record<string, string> = {
    student_name: 'Bhuvaneshwari Ramachandran',
    full_name: 'Bhuvaneshwari Ramachandran',
    course_name: 'Advanced Certificate in Data Science and Machine Learning',
    package_name: 'Advanced Certificate in Data Science and Machine Learning',
    institute_name: 'Shri Shikshayatan Institute of Higher Education',
    package_level: 'Intermediate Foundation Level',
    session_name: '2025-2026 Academic Session',
    email: 'bhuvaneshwari.ramachandran@institute-example.ac.in',
    enrollment_number: 'ENR-2026-00001234',
};

/**
 * How a long value would be handled in this box, or null when there is nothing
 * to say. Warned about rather than enforced — the admin owns the design.
 */
export const textFitWarning = ({
    fieldName,
    widthPx,
    fontSizePx,
    bold = false,
    heightPx = 0,
}: {
    fieldName: string;
    /** Content width, i.e. box width minus padding and border. */
    widthPx: number;
    fontSizePx: number;
    bold?: boolean;
    /** Content height. 0 keeps the old width-only, two-line judgement. */
    heightPx?: number;
}): string | null => {
    const sample = LONG_SAMPLES[fieldName];
    if (!sample || widthPx <= 0 || fontSizePx <= 0) return null;

    const budget = linesAllowed(heightPx, fontSizePx);
    if (linesNeeded(sample, widthPx, fontSizePx, bold) <= budget) return null;

    const fitted = fitFontSize(sample, widthPx, fontSizePx, bold, heightPx);
    const fittedBudget = linesAllowed(heightPx, fitted);
    const stillTooLong = linesNeeded(sample, widthPx, fitted, bold) > fittedBudget;

    if (stillTooLong) {
        return `A long value like "${sample}" cannot fit this box even at the smallest size, so it will be cut off. Make the field wider or taller.`;
    }
    return `A long value like "${sample}" will shrink to about ${Math.round(fitted)}px here to fit ${fittedBudget} line${fittedBudget === 1 ? '' : 's'}. Widen or heighten the field to keep your chosen size.`;
};

/**
 * Apply the same shrink the server applies, to already-substituted preview HTML.
 *
 * <p>The preview used to substitute sample values and stop there, while the
 * issued PDF went on to shrink long values through CertificateTextFitService.
 * So the one place an admin could check their design was the one place that did
 * not behave like the certificate: a long course name looked clipped in the
 * preview and printed shrunk, or looked fine and printed clipped. This closes
 * that gap by reading back the same `data-fit-*` attributes the server reads.
 *
 * <p>Returns the HTML untouched if it carries no fitted fields, or if parsing
 * fails — a preview refinement must never blank the preview.
 */
export const applyTextFitToHtml = (html: string): string => {
    if (!html || !html.includes('data-fit-width')) return html;
    try {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelectorAll<HTMLElement>('[data-fit-width]').forEach((el) => {
            const text = el.textContent || '';
            if (!text.trim()) return;
            const width = Number(el.getAttribute('data-fit-width'));
            const size = Number(el.getAttribute('data-fit-size'));
            const height = Number(el.getAttribute('data-fit-height')) || 0;
            if (!(width > 0) || !(size > 0)) return;

            const bold = /font-weight\s*:\s*(bold|[6-9]00)/i.test(el.getAttribute('style') || '');
            const fitted = fitFontSize(text, width, size, bold, height);
            if (fitted >= size) return;
            el.setAttribute('style', replaceFontSize(el.getAttribute('style') || '', fitted));
        });
        return `<!DOCTYPE html>${doc.documentElement.outerHTML}`;
    } catch {
        return html;
    }
};

/** Swap the font-size declaration in an inline style. Mirrors the server's own. */
export const replaceFontSize = (style: string, fontSizePx: number): string => {
    const size = `font-size:${fontSizePx.toFixed(2)}px`;
    if (!style) return size;
    if (/font-size\s*:/.test(style)) return style.replace(/font-size\s*:\s*[^;]*/, size);
    return style.endsWith(';') ? style + size : `${style};${size}`;
};
