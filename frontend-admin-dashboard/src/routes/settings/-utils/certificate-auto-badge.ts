/**
 * The badge the backend stamps bottom-right on every issued certificate.
 *
 * `appendCertificateIdBadge` in InstituteSettingService is the authority; every
 * number and colour here mirrors it so the editor can show admins exactly where
 * the code and number will print, and both previews can render the same thing.
 * Change one side and change the other.
 *
 * The badge is a fallback, not a fixture: it only stamps the parts the template
 * does not position itself. Placing a QR/barcode field replaces the automatic
 * code; placing a Certificate ID field replaces the automatic number. Place
 * both and no badge is stamped at all.
 */
import {
    CERTIFICATE_BARCODE_PLACEHOLDER,
    CERTIFICATE_QR_PLACEHOLDER,
} from './certificate-code-placeholders';

export type BadgeCodeType = 'QR' | 'BARCODE';

/**
 * CSS px per millimetre at 96dpi. The serialized template sets `@page` from its
 * own pixel size at this ratio, so a mm offset in the badge lands on an exact
 * pixel of the editor canvas.
 */
export const PX_PER_MM = 96 / 25.4;

/** Geometry of the stamped badge, in the same units the backend writes. */
export const AUTO_BADGE = {
    rightMm: 10,
    bottomMm: 8,
    paddingXPx: 8,
    paddingYPx: 3,
    borderPx: 1,
    borderRadiusPx: 4,
    idFontSizePx: 10,
    idMarginTopPx: 2,
    letterSpacing: '0.5px',
    fontFamily: 'Arial, sans-serif',
    borderColor: '#d0d7de', // design-lint-ignore — mirrors the server-rendered PDF
    textColor: '#444444', // design-lint-ignore — mirrors the server-rendered PDF
    background: 'rgba(255,255,255,0.85)',
} as const;

/**
 * A 1D barcode needs a wide, short box; a QR needs a square one — sizing both
 * the same squashes the barcode until it stops scanning.
 */
export const codeSizeMm = (codeType: BadgeCodeType): { widthMm: number; heightMm: number } =>
    codeType === 'BARCODE' ? { widthMm: 34, heightMm: 11 } : { widthMm: 16, heightMm: 16 };

/** Same box in canvas pixels, which is what the editor positions fields in. */
export const codeSizePx = (codeType: BadgeCodeType): { width: number; height: number } => {
    const { widthMm, heightMm } = codeSizeMm(codeType);
    return {
        width: Math.round(widthMm * PX_PER_MM),
        height: Math.round(heightMm * PX_PER_MM),
    };
};

export const codeFieldName = (codeType: BadgeCodeType): string =>
    codeType === 'BARCODE' ? 'certificate_barcode' : 'certificate_qr';

export const codeDisplayName = (codeType: BadgeCodeType): string =>
    codeType === 'BARCODE' ? 'Barcode' : 'QR Code';

/** Schematic stand-in to draw where the real code will go. */
export const codePlaceholder = (codeType: BadgeCodeType): string =>
    codeType === 'BARCODE' ? CERTIFICATE_BARCODE_PLACEHOLDER : CERTIFICATE_QR_PLACEHOLDER;

/** Which parts of the badge the backend will still stamp. */
export interface AutoBadgePlan {
    code: boolean;
    id: boolean;
    /** False when the design places both and nothing is stamped. */
    any: boolean;
}

const plan = (code: boolean, id: boolean): AutoBadgePlan => ({ code, id, any: code || id });

/** Plan from what the visual editor has placed on the canvas. */
export const planFromFieldNames = (fieldNames: Iterable<string>): AutoBadgePlan => {
    const placed = new Set(fieldNames);
    const placesCode = placed.has('certificate_qr') || placed.has('certificate_barcode');
    return plan(!placesCode, !placed.has('certificate_id'));
};

/**
 * Plan from raw template HTML, matched the tolerant way the backend does —
 * templates pasted out of Word arrive as `{{ certificate_id }}`, and a strict
 * match would miss those and preview a badge that never prints.
 */
const hasToken = (html: string, token: string): boolean =>
    new RegExp(`\\{\\{\\s*${token}\\s*\\}\\}`, 'i').test(html || '');

export const planFromHtml = (html: string): AutoBadgePlan => {
    const placesCode = hasToken(html, 'CERTIFICATE_QR') || hasToken(html, 'CERTIFICATE_BARCODE');
    return plan(!placesCode, !hasToken(html, 'CERTIFICATE_ID'));
};

const escapeAttr = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The badge markup, byte-for-byte equivalent to what the backend appends. */
export const buildAutoBadgeHtml = ({
    badgePlan,
    codeType,
    certificateId,
    codeDataUri,
}: {
    badgePlan: AutoBadgePlan;
    codeType: BadgeCodeType;
    certificateId: string;
    /** Defaults to the schematic placeholder — the real code needs a number. */
    codeDataUri?: string;
}): string => {
    if (!badgePlan.any) return '';
    const { widthMm, heightMm } = codeSizeMm(codeType);
    const codeImg = badgePlan.code
        ? `<img src="${escapeAttr(codeDataUri ?? codePlaceholder(codeType))}" alt="" ` +
          `style="width:${widthMm}mm;height:${heightMm}mm;display:block;" />`
        : '';
    const idSpan = badgePlan.id
        ? `<span style="display:block;margin-top:${AUTO_BADGE.idMarginTopPx}px;">` +
          `${escapeAttr(certificateId)}</span>`
        : '';
    return (
        `<div style="position:fixed;bottom:${AUTO_BADGE.bottomMm}mm;right:${AUTO_BADGE.rightMm}mm;` +
        `font-family:${AUTO_BADGE.fontFamily};font-size:${AUTO_BADGE.idFontSizePx}px;` +
        `color:${AUTO_BADGE.textColor};background:${AUTO_BADGE.background};` +
        `padding:${AUTO_BADGE.paddingYPx}px ${AUTO_BADGE.paddingXPx}px;` +
        `border:${AUTO_BADGE.borderPx}px solid ${AUTO_BADGE.borderColor};` +
        `border-radius:${AUTO_BADGE.borderRadiusPx}px;letter-spacing:${AUTO_BADGE.letterSpacing};` +
        `text-align:center;">${codeImg}${idSpan}</div>`
    );
};

/** Inject the badge just before `</body>`, exactly as the backend does. */
export const injectAutoBadge = (html: string, badge: string): string => {
    if (!badge) return html;
    const closing = html.lastIndexOf('</body>');
    return closing >= 0 ? html.slice(0, closing) + badge + html.slice(closing) : html + badge;
};
