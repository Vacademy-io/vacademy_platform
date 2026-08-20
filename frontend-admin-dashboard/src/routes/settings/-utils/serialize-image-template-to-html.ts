import type { ImageTemplate, FieldMapping } from '@/types/certificate/certificate-types';

// Maps a system field's `name` (the id used in the wizard's AvailableField list)
// to the placeholder token the backend substitutes at issuance time. Anything
// not in this map is treated as a literal CSV/dynamic field name and rendered
// as `{{FIELD_NAME}}` (uppercase). The backend's named-placeholder pass in
// InstituteSettingService handles tokens it knows about and leaves the rest
// untouched, which is the correct behavior for unknown fields.
const FIELD_NAME_TO_TOKEN: Record<string, string> = {
    user_id: '{{USER_ID}}',
    enrollment_number: '{{ENROLLMENT_NUMBER}}',
    student_name: '{{STUDENT_NAME}}',
    full_name: '{{STUDENT_NAME}}',
    email: '{{EMAIL}}',
    mobile_number: '{{MOBILE_NUMBER}}',
    institute_name: '{{INSTITUTE_NAME}}',
    institute_logo: '{{INSTITUTE_LOGO}}',
    course_name: '{{COURSE_NAME}}',
    package_name: '{{PACKAGE_NAME}}',
    package_level: '{{PACKAGE_LEVEL}}',
    session_name: '{{SESSION_NAME}}',
    completion_date: '{{DATE_OF_COMPLETION}}',
    completion_percentage: '{{COMPLETION_PERCENTAGE}}',
    // `date_of_completion` is the new canonical field name (replaces the
    // legacy `issue_date`). Both still map to {{DATE_OF_COMPLETION}} so saved
    // templates from before the rename continue to resolve on the backend.
    date_of_completion: '{{DATE_OF_COMPLETION}}',
    issue_date: '{{DATE_OF_COMPLETION}}',
    certificate_id: '{{CERTIFICATE_ID}}',
    // Scannable forms of the certificate number. The backend substitutes a PNG
    // data URI for each, so these are image fields, not text.
    certificate_qr: '{{CERTIFICATE_QR}}',
    certificate_barcode: '{{CERTIFICATE_BARCODE}}',
    // The verification code in readable form. Worth placing next to a barcode:
    // a barcode that gets damaged, photocopied or cropped stops scanning, and
    // the printed code is then the only way left to verify the certificate.
    certificate_short_code: '{{CERTIFICATE_SHORT_CODE}}',
    theme_color: '{{INSTITUTE_THEME_COLOR}}',
};

/**
 * Prefix an admin-defined field's name carries on the canvas, and the namespace
 * its token lands in. Namespaced because admins choose these keys: without a
 * prefix, a field keyed `student_name` would shadow the real
 * `{{STUDENT_NAME}}` and silently print a constant on every certificate.
 */
export const CUSTOM_FIELD_PREFIX = 'custom_field:';

/**
 * Uppercase, `[A-Z0-9_]` only. Normalised identically on the backend
 * (CertificateCustomFieldService.normaliseKey), so a key saved with spaces or
 * lowercase still matches its token instead of rendering blank.
 */
export const normalizeCustomFieldKey = (raw: string): string =>
    raw
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

export function fieldNameToToken(fieldName: string): string {
    if (fieldName.startsWith(CUSTOM_FIELD_PREFIX)) {
        const key = normalizeCustomFieldKey(fieldName.slice(CUSTOM_FIELD_PREFIX.length));
        // A key that normalises to nothing has no token to emit. Returning an
        // empty string means the span renders blank rather than printing a
        // malformed `{{CF_}}` on the learner's certificate.
        return key ? `{{CF_${key}}}` : '';
    }
    return FIELD_NAME_TO_TOKEN[fieldName] ?? `{{${fieldName.toUpperCase()}}}`;
}

const PX_PER_MM = 96 / 25.4;

const escapeHtml = (s: string): string =>
    s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

/**
 * Text wrapping on the certificate.
 *
 * <p>Fields used to be emitted `white-space:nowrap; overflow:hidden`, so a value
 * longer than its box was silently sliced — and because the box centres its
 * content, the slice took characters off <em>both</em> ends. A learner called
 * "Bhuvaneshwari Ramachandran" printed as "uvaneshwari Ramachand". Long course
 * names did the same.
 *
 * <p>Values now wrap and can never exceed the box the admin drew — in either
 * direction. The line budget is the box's own height ({@link fieldContentHeightPx}),
 * not a fixed number: a box drawn tall enough for three lines gets three, and a
 * box only one line tall shrinks the font rather than spilling a second line
 * over the artwork underneath. {@link MAX_TEXT_LINES} remains the budget for
 * templates saved before the height was recorded.
 */
export const MAX_TEXT_LINES = 2;

/** Unitless, so `max-height` in `em` scales with any font size the fitter picks. */
export const TEXT_LINE_HEIGHT = 1.2;

/**
 * Width available to the text once the box's own padding and border are taken
 * off. This is the number the server-side fitter measures against, so it has to
 * be the real content width, not the box width.
 */
export const fieldContentWidthPx = (f: FieldMapping): number => {
    const padding = typeof f.style.padding === 'number' ? f.style.padding : 0;
    const border = f.style.borderColor ? 1 : 0;
    return Math.max(1, Math.round(f.position.width - 2 * padding - 2 * border));
};

/**
 * Height available to the text, the vertical twin of {@link fieldContentWidthPx}.
 *
 * <p>Emitted as `data-fit-height` so the server-side fitter can shrink a long
 * value until it fits the box's *height* too. Width alone was not enough: a
 * two-line clamp in a box one line tall clipped the second line, which is
 * exactly the "the long course name is not visible" report this closes.
 */
export const fieldContentHeightPx = (f: FieldMapping): number => {
    const padding = typeof f.style.padding === 'number' ? f.style.padding : 0;
    const border = f.style.borderColor ? 1 : 0;
    return Math.max(1, Math.round(f.position.height - 2 * padding - 2 * border));
};

/**
 * How many lines this box can show at a given font size — at least one, because
 * a box smaller than a single line still has to print something.
 */
export const linesThatFit = (contentHeightPx: number, fontSizePx: number): number => {
    if (!(contentHeightPx > 0) || !(fontSizePx > 0)) return MAX_TEXT_LINES;
    // The epsilon absorbs sub-pixel rounding: a box drawn at exactly two lines
    // must not be judged to hold 1.99.
    return Math.max(1, Math.floor(contentHeightPx / (fontSizePx * TEXT_LINE_HEIGHT) + 0.02));
};

/**
 * How much of the text is actually allowed to show.
 *
 * <p>Normally the box the admin drew — text stays inside its own field instead
 * of spilling over the artwork. But the fitter will only shrink so far (half the
 * chosen size; below that a name reads as a mistake rather than a design), so a
 * long value in a box one line tall bottoms out still needing two lines. Letting
 * *those* two lines show past the box is the lesser evil: overlapping is
 * recoverable by moving the box, whereas a certificate that prints half a name
 * is not recoverable at all by the learner holding it.
 */
export const fieldTextMaxHeightPx = (f: FieldMapping): number => {
    const floorFontSize = Math.max(MIN_FIT_FONT_PX, f.style.fontSize * MIN_FIT_FONT_SCALE);
    return Math.max(
        fieldContentHeightPx(f),
        Math.round(MAX_TEXT_LINES * TEXT_LINE_HEIGHT * floorFontSize)
    );
};

/** Mirrors MIN_SCALE / MIN_FONT_PX in CertificateTextFitService. */
const MIN_FIT_FONT_SCALE = 0.5;
const MIN_FIT_FONT_PX = 6;

/** The positioned box. Vertical centring and clipping live here. */
const buildFieldStyle = (f: FieldMapping): string => {
    const parts: string[] = [
        'position:absolute',
        `left:${f.position.x}px`,
        `top:${f.position.y}px`,
        `width:${f.position.width}px`,
        `height:${f.position.height}px`,
        // Deliberately visible. The inner element is what constrains the text:
        // it can never be wider than this box, and it is clamped to two lines.
        // Clipping here as well would slice the second line in half whenever a
        // box is shorter than two lines — the flex centring puts the overflow on
        // both edges, so you get slivers of two lines rather than one clean one.
        'overflow:visible',
        'box-sizing:border-box',
        'display:flex',
        `justify-content:${
            f.style.alignment === 'center'
                ? 'center'
                : f.style.alignment === 'right'
                  ? 'flex-end'
                  : 'flex-start'
        }`,
        'align-items:center',
    ];
    if (f.style.backgroundColor) parts.push(`background-color:${f.style.backgroundColor}`);
    if (f.style.borderColor) parts.push(`border:1px solid ${f.style.borderColor}`);
    if (typeof f.style.padding === 'number') parts.push(`padding:${f.style.padding}px`);
    return parts.join(';');
};

/**
 * The text itself. Given an explicit `width:100%` rather than left as an
 * anonymous flex item, so wrapping is well-defined in the PDF renderer instead
 * of depending on how it sizes anonymous items.
 */
const buildFieldTextStyle = (f: FieldMapping): string =>
    [
        'width:100%',
        `font-family:${f.style.fontFamily}`,
        `font-size:${f.style.fontSize}px`,
        `font-weight:${f.style.fontWeight}`,
        `color:${f.style.fontColor}`,
        `text-align:${f.style.alignment}`,
        `line-height:${TEXT_LINE_HEIGHT}`,
        // The box the admin drew is the clamp — see fieldTextMaxHeightPx for
        // the one case that is allowed past it. In px rather than `em` because
        // the fitter changes the font size and the *box* must not change with
        // it; an `em` clamp shrank the visible area in lockstep with the font,
        // so shrinking never bought the text any more room.
        `max-height:${fieldTextMaxHeightPx(f)}px`,
        'overflow:hidden',
        // A single unbroken token — a long email, a hyphen-free course code —
        // has no space to wrap at, and would otherwise run past the box edge.
        'overflow-wrap:break-word',
        'word-wrap:break-word',
    ].join(';');

const buildLogoImgStyle = (f: FieldMapping): string =>
    [
        'position:absolute',
        `left:${f.position.x}px`,
        `top:${f.position.y}px`,
        `width:${f.position.width}px`,
        `height:${f.position.height}px`,
        'object-fit:contain',
    ].join(';');

/**
 * Serializes the visual editor's (image template + field mappings) state into
 * a complete HTML document the backend's OpenHTML2PDF renderer can consume.
 *
 * The rendered document is a single fixed-size canvas (in image-natural pixels)
 * with absolutely-positioned spans for each field. Tokens like {{STUDENT_NAME}}
 * are emitted verbatim so the backend's existing placeholder substitution
 * fills them in at issuance time.
 *
 * Image fields:
 * - System image fields (institute_logo, signature) emit <img src="{{TOKEN}}">.
 *   Backend processImagesForPdf substitutes the token to a real URL.
 * - Custom uploaded images (fieldName starts with "custom_image:<id>") emit
 *   <img src="<dataUrl>"> directly using the URL from the customImages map,
 *   so admin-uploaded artwork is embedded in the PDF without backend support.
 */
export function serializeImageTemplateToHtml(
    template: ImageTemplate,
    fields: FieldMapping[],
    customImages?: Array<{ id: string; dataUrl: string }>
): string {
    const widthMm = (template.width / PX_PER_MM).toFixed(2);
    const heightMm = (template.height / PX_PER_MM).toFixed(2);

    const imageFieldNames = new Set([
        'institute_logo',
        'signature',
        // Emitted as <img src="{{CERTIFICATE_QR}}"> — the backend replaces the
        // token with a base64 PNG. Rendering these as text would print a raw
        // data URI across the certificate.
        'certificate_qr',
        'certificate_barcode',
    ]);
    const customImagesById = new Map((customImages || []).map((c) => [c.id, c.dataUrl]));

    const fieldHtml = fields
        .map((f) => {
            if (imageFieldNames.has(f.fieldName)) {
                const token = fieldNameToToken(f.fieldName);
                return `<img src="${escapeHtml(token)}" style="${escapeHtml(buildLogoImgStyle(f))}" alt="" />`;
            }
            if (f.fieldName.startsWith('custom_image:')) {
                const id = f.fieldName.split(':')[1] || '';
                const dataUrl = customImagesById.get(id) || '';
                return `<img src="${escapeHtml(dataUrl)}" style="${escapeHtml(buildLogoImgStyle(f))}" alt="" />`;
            }
            const token = fieldNameToToken(f.fieldName);
            // data-fit-* is read server-side after substitution: the renderer
            // knows the box, but only the server knows the value, so the two
            // have to meet somewhere. See CertificateTextFitService.
            return (
                `<div style="${escapeHtml(buildFieldStyle(f))}">` +
                `<div style="${escapeHtml(buildFieldTextStyle(f))}"` +
                ` data-fit-width="${fieldContentWidthPx(f)}"` +
                ` data-fit-height="${fieldContentHeightPx(f)}"` +
                ` data-fit-size="${f.style.fontSize}"` +
                `>${escapeHtml(token)}</div>` +
                `</div>`
            );
        })
        .join('\n        ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
  html, body { margin: 0; padding: 0; }
  .certificate-canvas {
    position: relative;
    width: ${template.width}px;
    height: ${template.height}px;
    overflow: hidden;
  }
  .certificate-canvas > img.bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
</style>
</head>
<body>
  <div class="certificate-canvas">
    <img class="bg" src="${escapeHtml(template.imageDataUrl)}" alt="" />
        ${fieldHtml}
  </div>
</body>
</html>`;
}
