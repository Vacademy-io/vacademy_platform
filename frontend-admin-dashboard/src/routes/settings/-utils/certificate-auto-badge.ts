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
 *
 * It is also switchable per institute (autoStampCode / autoStampNumber). Until
 * it was, removing the QR or the number from a design just brought the stamped
 * one back bottom-right, which made a certificate without them impossible.
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
 * What the Barcode field encodes. Mirrors `barcodeContent` in the institute's
 * certificate setting; see BarcodeContent in setting-services.ts.
 */
export type BarcodeContent = 'NUMBER' | 'VERIFICATION_CODE';

/**
 * Smallest bar width that still scans off a printed page. Below roughly this,
 * consumer scanners start failing — the barcode looks fine on screen and is
 * unreadable in the recipient's hand, which is the worst possible failure for a
 * verification code.
 */
const MIN_BARCODE_MODULE_MM = 0.19;

/**
 * Code 128 module counts. Each character costs 11 modules; start, checksum and
 * stop add 11 + 11 + 13. Certificate numbers run ~11 characters; a verification
 * payload is that plus a separator plus a 10-character code.
 */
const barcodeModules = (characters: number): number => characters * 11 + 35;

/** Minimum width at which a Code 128 barcode of this payload still scans. */
export const minBarcodeWidthMm = (content: BarcodeContent): number =>
    Math.ceil(barcodeModules(content === 'VERIFICATION_CODE' ? 22 : 11) * MIN_BARCODE_MODULE_MM);

/**
 * A 1D barcode needs a wide, short box; a QR needs a square one — sizing both
 * the same squashes the barcode until it stops scanning.
 *
 * A verifying barcode carries roughly twice the payload, so it needs roughly
 * twice the width. Sizing it like a number-only barcode produces a code that
 * looks right in the editor and cannot be scanned off the printed certificate.
 */
export const codeSizeMm = (
    codeType: BadgeCodeType,
    barcodeContent: BarcodeContent = 'NUMBER'
): { widthMm: number; heightMm: number } => {
    if (codeType !== 'BARCODE') return { widthMm: 16, heightMm: 16 };
    return barcodeContent === 'VERIFICATION_CODE'
        ? { widthMm: 60, heightMm: 14 }
        : { widthMm: 34, heightMm: 11 };
};

/** Same box in canvas pixels, which is what the editor positions fields in. */
export const codeSizePx = (
    codeType: BadgeCodeType,
    barcodeContent: BarcodeContent = 'NUMBER'
): { width: number; height: number } => {
    const { widthMm, heightMm } = codeSizeMm(codeType, barcodeContent);
    return {
        width: Math.round(widthMm * PX_PER_MM),
        height: Math.round(heightMm * PX_PER_MM),
    };
};

/** Field names that render as a machine-readable code rather than text. */
export const CODE_FIELD_NAMES = ['certificate_qr', 'certificate_barcode'] as const;

export const isCodeFieldName = (fieldName: string): boolean =>
    (CODE_FIELD_NAMES as readonly string[]).includes(fieldName);

/**
 * The aspect a code field must keep. A QR is square by construction — stretching
 * it makes the modules non-square and consumer scanners reject it. A barcode's
 * ratio is looser (only bar *width* carries data), but squashing it vertically
 * past a point stops it scanning too.
 */
export const codeAspectRatio = (
    fieldName: string,
    barcodeContent: BarcodeContent = 'NUMBER'
): number => {
    if (fieldName !== 'certificate_barcode') return 1;
    const { widthMm, heightMm } = codeSizeMm('BARCODE', barcodeContent);
    return widthMm / heightMm;
};

/**
 * Why a placed code field would not scan off the printed page, or null when it
 * is fine. Warned about rather than prevented: the admin owns the design, and a
 * hard constraint on a box they are dragging is worse than a clear explanation.
 */
export const codeScanWarning = ({
    fieldName,
    widthPx,
    heightPx,
    canvasWidthPx,
    canvasWidthMm,
    barcodeContent = 'NUMBER',
}: {
    fieldName: string;
    widthPx: number;
    heightPx: number;
    /** Canvas dimensions, to convert the field's pixel box into printed mm. */
    canvasWidthPx: number;
    canvasWidthMm: number;
    barcodeContent?: BarcodeContent;
}): string | null => {
    if (!isCodeFieldName(fieldName) || canvasWidthPx <= 0 || canvasWidthMm <= 0) return null;
    const mmPerPx = canvasWidthMm / canvasWidthPx;
    const widthMm = widthPx * mmPerPx;
    const heightMm = heightPx * mmPerPx;

    if (fieldName === 'certificate_barcode') {
        const needed = minBarcodeWidthMm(barcodeContent);
        if (widthMm < needed) {
            return `This barcode is about ${Math.round(widthMm)}mm wide. Below ${needed}mm the bars get too thin to scan off a printed certificate — widen it${
                barcodeContent === 'VERIFICATION_CODE'
                    ? ', or switch the barcode back to the number only'
                    : ''
            }.`;
        }
        if (heightMm < 8) {
            return `This barcode is only about ${Math.round(heightMm)}mm tall. Scanners need roughly 8mm to find it reliably.`;
        }
        return null;
    }

    if (widthMm < 12 || heightMm < 12) {
        return `This QR is about ${Math.round(Math.min(widthMm, heightMm))}mm across. Below 12mm phone cameras struggle with it in print.`;
    }
    const ratio = widthPx / Math.max(1, heightPx);
    if (ratio < 0.9 || ratio > 1.1) {
        return 'This QR is stretched. QR codes have to stay square — scanners reject distorted ones.';
    }
    return null;
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

/**
 * Whether the institute lets the platform stamp each part at all.
 *
 * <p>Both default to true, which is what the badge always did. They exist
 * because it used to be unconditional: deleting the QR or the certificate
 * number from a design simply brought the stamped one back, so a certificate
 * without a code or without a visible number could not be produced.
 */
export interface AutoStampSettings {
    code?: boolean;
    number?: boolean;
}

/** Plan from what the visual editor has placed on the canvas. */
export const planFromFieldNames = (
    fieldNames: Iterable<string>,
    stamp: AutoStampSettings = {}
): AutoBadgePlan => {
    const placed = new Set(fieldNames);
    const placesCode = placed.has('certificate_qr') || placed.has('certificate_barcode');
    return plan(
        !placesCode && stamp.code !== false,
        !placed.has('certificate_id') && stamp.number !== false
    );
};

/**
 * Plan from raw template HTML, matched the tolerant way the backend does —
 * templates pasted out of Word arrive as `{{ certificate_id }}`, and a strict
 * match would miss those and preview a badge that never prints.
 */
const hasToken = (html: string, token: string): boolean =>
    new RegExp(`\\{\\{\\s*${token}\\s*\\}\\}`, 'i').test(html || '');

export const planFromHtml = (html: string, stamp: AutoStampSettings = {}): AutoBadgePlan => {
    const placesCode = hasToken(html, 'CERTIFICATE_QR') || hasToken(html, 'CERTIFICATE_BARCODE');
    return plan(
        !placesCode && stamp.code !== false,
        !hasToken(html, 'CERTIFICATE_ID') && stamp.number !== false
    );
};

const escapeAttr = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The badge markup, byte-for-byte equivalent to what the backend appends. */
export const buildAutoBadgeHtml = ({
    badgePlan,
    codeType,
    certificateId,
    codeDataUri,
    barcodeContent = 'NUMBER',
}: {
    badgePlan: AutoBadgePlan;
    codeType: BadgeCodeType;
    certificateId: string;
    /** Defaults to the schematic placeholder — the real code needs a number. */
    codeDataUri?: string;
    /** Widens the stamped barcode when it carries a verification code. */
    barcodeContent?: BarcodeContent;
}): string => {
    if (!badgePlan.any) return '';
    const { widthMm, heightMm } = codeSizeMm(codeType, barcodeContent);
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
