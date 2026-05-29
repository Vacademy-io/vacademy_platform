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
    theme_color: '{{INSTITUTE_THEME_COLOR}}',
};

export function fieldNameToToken(fieldName: string): string {
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

const buildFieldStyle = (f: FieldMapping): string => {
    const parts: string[] = [
        'position:absolute',
        `left:${f.position.x}px`,
        `top:${f.position.y}px`,
        `width:${f.position.width}px`,
        `height:${f.position.height}px`,
        `font-family:${f.style.fontFamily}`,
        `font-size:${f.style.fontSize}px`,
        `font-weight:${f.style.fontWeight}`,
        `color:${f.style.fontColor}`,
        `text-align:${f.style.alignment}`,
        'line-height:1.2',
        'white-space:nowrap',
        'overflow:hidden',
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

    const imageFieldNames = new Set(['institute_logo', 'signature']);
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
            return `<span style="${escapeHtml(buildFieldStyle(f))}">${escapeHtml(token)}</span>`;
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
