import { nanoid } from 'nanoid';
import type { FieldMapping, ImageTemplate } from '@/types/certificate/certificate-types';

// Canvas dimensions for built-in templates. A4 landscape at ~96dpi gives crisp
// previews without ballooning the rasterized PNG that gets uploaded to S3.
const TEMPLATE_WIDTH = 1123;
const TEMPLATE_HEIGHT = 794;

export const BUILTIN_TEMPLATE_ID_PREFIX = 'builtin:';
const DEFAULT_THEME = '#1e4fa1';

/**
 * Visual customizations the admin can edit per built-in template. Each
 * template renders these into its SVG in its own way — some templates may
 * ignore fields that don't fit their layout (e.g. Modern Minimal has no
 * decorative subtitle banner). Keeping the schema uniform lets the UI
 * present one panel of controls regardless of which template is active.
 */
export interface TemplateCustomizations {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    titleText: string;
    subtitleText: string;
    presentedText: string;
    forCompletionText: string;
    borderWidth: number;
}

export interface BuiltinCertificateTemplate {
    id: string;
    name: string;
    description: string;
    isDefault?: boolean;
    /**
     * Render the decorative background to an SVG string. The substituted
     * customizations include any text the admin has tweaked; the function
     * is responsible for XML-escaping anything it pulls from the object.
     */
    svg: (customizations: TemplateCustomizations) => string;
    /**
     * Default values for the customization controls. Used as the "Reset"
     * baseline and as the seed when a template is first applied. The
     * primary color is overridden with the institute theme at runtime so
     * brand alignment is automatic.
     */
    defaultCustomizations: (themeColor: string) => TemplateCustomizations;
    /**
     * Default field placements that match the template's layout.
     */
    defaultFields: (customizations: TemplateCustomizations) => Omit<FieldMapping, 'id'>[];
    /**
     * Subset of customization fields the panel should hide for this
     * template (e.g. Modern Minimal has no decorative subtitle). Treated as
     * a hint — the underlying customization is still stored, just not
     * editable.
     */
    hiddenCustomizationKeys?: (keyof TemplateCustomizations)[];
}

const escapeXml = (s: string): string =>
    String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');

const baseField = (
    fieldName: string,
    displayName: string,
    type: FieldMapping['type'],
    x: number,
    y: number,
    width: number,
    height: number,
    style: Partial<FieldMapping['style']> = {}
): Omit<FieldMapping, 'id'> => ({
    fieldName,
    displayName,
    type,
    position: { x, y, width, height },
    style: {
        fontSize: 28,
        fontColor: '#1f2937',
        fontFamily: 'Times New Roman, serif',
        alignment: 'center',
        fontWeight: 'normal',
        backgroundColor: 'rgba(255,255,255,0.0)',
        padding: 4,
        ...style,
    },
});

// ──────────────────────────────────────────────────────────────────────────
// Template 1 — Classic Blue (default)
// Double border, decorative corner triangles, formal serif title.
// ──────────────────────────────────────────────────────────────────────────
const classicBlueSvg = (c: TemplateCustomizations): string => `<svg xmlns="http://www.w3.org/2000/svg" width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}" viewBox="0 0 ${TEMPLATE_WIDTH} ${TEMPLATE_HEIGHT}">
  <rect width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}" fill="${c.backgroundColor}"/>
  <rect x="30" y="30" width="1063" height="734" fill="none" stroke="${c.primaryColor}" stroke-width="${c.borderWidth}"/>
  <rect x="52" y="52" width="1019" height="690" fill="none" stroke="${c.primaryColor}" stroke-width="1.5" opacity="0.6"/>
  <path d="M 52 52 L 220 52 L 52 220 Z" fill="${c.primaryColor}" opacity="0.12"/>
  <path d="M 1071 52 L 903 52 L 1071 220 Z" fill="${c.primaryColor}" opacity="0.12"/>
  <path d="M 52 742 L 220 742 L 52 574 Z" fill="${c.primaryColor}" opacity="0.12"/>
  <path d="M 1071 742 L 903 742 L 1071 574 Z" fill="${c.primaryColor}" opacity="0.12"/>
  <text x="561.5" y="200" text-anchor="middle" font-family="Times New Roman, serif" font-size="60" font-weight="bold" fill="${c.primaryColor}" letter-spacing="6">${escapeXml(c.titleText)}</text>
  <text x="561.5" y="248" text-anchor="middle" font-family="Times New Roman, serif" font-size="26" fill="#555" letter-spacing="4">${escapeXml(c.subtitleText)}</text>
  <text x="561.5" y="310" text-anchor="middle" font-family="Times New Roman, serif" font-size="20" font-style="italic" fill="#666">${escapeXml(c.presentedText)}</text>
  <line x1="380" y1="455" x2="743" y2="455" stroke="#bbb" stroke-width="1"/>
  <text x="561.5" y="565" text-anchor="middle" font-family="Times New Roman, serif" font-size="18" font-style="italic" fill="#666">${escapeXml(c.forCompletionText)}</text>
  <line x1="380" y1="685" x2="743" y2="685" stroke="#bbb" stroke-width="1"/>
  <line x1="780" y1="685" x2="1020" y2="685" stroke="#bbb" stroke-width="1"/>
  <text x="280" y="710" text-anchor="middle" font-family="Times New Roman, serif" font-size="14" fill="#888">Date of Completion</text>
  <text x="900" y="710" text-anchor="middle" font-family="Times New Roman, serif" font-size="14" fill="#888">Authorized Signature</text>
</svg>`;

// ──────────────────────────────────────────────────────────────────────────
// Template 2 — Modern Minimal
// Single accent band on left side, clean sans-serif feel.
// ──────────────────────────────────────────────────────────────────────────
const modernMinimalSvg = (c: TemplateCustomizations): string => `<svg xmlns="http://www.w3.org/2000/svg" width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}" viewBox="0 0 ${TEMPLATE_WIDTH} ${TEMPLATE_HEIGHT}">
  <rect width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}" fill="${c.backgroundColor}"/>
  <rect x="0" y="0" width="${c.borderWidth}" height="${TEMPLATE_HEIGHT}" fill="${c.primaryColor}"/>
  <rect x="${TEMPLATE_WIDTH - c.borderWidth}" y="0" width="${c.borderWidth}" height="${TEMPLATE_HEIGHT}" fill="${c.primaryColor}" opacity="0.4"/>
  <rect x="80" y="100" width="60" height="4" fill="${c.primaryColor}"/>
  <text x="80" y="160" font-family="Helvetica, Arial, sans-serif" font-size="18" fill="#888" letter-spacing="6">${escapeXml(c.presentedText)}</text>
  <text x="80" y="220" font-family="Helvetica, Arial, sans-serif" font-size="48" font-weight="300" fill="#222">${escapeXml(c.titleText)}</text>
  <text x="80" y="280" font-family="Helvetica, Arial, sans-serif" font-size="48" font-weight="600" fill="${c.primaryColor}">${escapeXml(c.subtitleText)}</text>
  <text x="80" y="540" font-family="Helvetica, Arial, sans-serif" font-size="16" fill="#888">${escapeXml(c.forCompletionText)}</text>
  <line x1="80" y1="710" x2="380" y2="710" stroke="#ddd" stroke-width="1"/>
  <line x1="743" y1="710" x2="1043" y2="710" stroke="#ddd" stroke-width="1"/>
  <text x="80" y="735" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#aaa" letter-spacing="2">DATE</text>
  <text x="743" y="735" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#aaa" letter-spacing="2">CERTIFICATE ID</text>
</svg>`;

// ──────────────────────────────────────────────────────────────────────────
// Template 3 — Elegant Gold
// Ornate corners, formal serif, cream background, seal in primary color.
// ──────────────────────────────────────────────────────────────────────────
const elegantGoldSvg = (c: TemplateCustomizations): string => {
    const gold = c.secondaryColor;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}" viewBox="0 0 ${TEMPLATE_WIDTH} ${TEMPLATE_HEIGHT}">
  <rect width="${TEMPLATE_WIDTH}" height="${TEMPLATE_HEIGHT}" fill="${c.backgroundColor}"/>
  <rect x="45" y="45" width="1033" height="704" fill="none" stroke="${gold}" stroke-width="${c.borderWidth}"/>
  <rect x="60" y="60" width="1003" height="674" fill="none" stroke="${gold}" stroke-width="1" opacity="0.5"/>
  <g stroke="${gold}" stroke-width="2" fill="none">
    <path d="M 80 110 Q 110 80 150 80"/>
    <circle cx="80" cy="80" r="6" fill="${gold}"/>
    <path d="M 1043 110 Q 1013 80 973 80"/>
    <circle cx="1043" cy="80" r="6" fill="${gold}"/>
    <path d="M 80 684 Q 110 714 150 714"/>
    <circle cx="80" cy="714" r="6" fill="${gold}"/>
    <path d="M 1043 684 Q 1013 714 973 714"/>
    <circle cx="1043" cy="714" r="6" fill="${gold}"/>
  </g>
  <text x="561.5" y="175" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="22" fill="${gold}" letter-spacing="10">${escapeXml(c.presentedText)}</text>
  <text x="561.5" y="245" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="64" font-style="italic" fill="#3a2c10">${escapeXml(c.titleText)}</text>
  <text x="561.5" y="295" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="22" fill="#7a5a25" letter-spacing="8">${escapeXml(c.subtitleText)}</text>
  <line x1="430" y1="335" x2="540" y2="335" stroke="${gold}" stroke-width="1"/>
  <circle cx="561.5" cy="335" r="4" fill="${gold}"/>
  <line x1="583" y1="335" x2="693" y2="335" stroke="${gold}" stroke-width="1"/>
  <text x="561.5" y="565" text-anchor="middle" font-family="Georgia, Times New Roman, serif" font-size="18" font-style="italic" fill="#7a5a25">${escapeXml(c.forCompletionText)}</text>
  <circle cx="950" cy="640" r="55" fill="none" stroke="${c.primaryColor}" stroke-width="2" opacity="0.7"/>
  <circle cx="950" cy="640" r="45" fill="none" stroke="${c.primaryColor}" stroke-width="1" opacity="0.5"/>
  <text x="950" y="635" text-anchor="middle" font-family="Georgia, serif" font-size="11" fill="${c.primaryColor}" opacity="0.8">AWARD</text>
  <text x="950" y="655" text-anchor="middle" font-family="Georgia, serif" font-size="11" fill="${c.primaryColor}" opacity="0.8">OF MERIT</text>
</svg>`;
};

export const BUILTIN_TEMPLATES: BuiltinCertificateTemplate[] = [
    {
        id: `${BUILTIN_TEMPLATE_ID_PREFIX}classic-blue`,
        name: 'Classic Blue',
        description: 'Traditional double-border layout with corner accents',
        isDefault: true,
        svg: classicBlueSvg,
        defaultCustomizations: (themeColor) => ({
            primaryColor: themeColor || DEFAULT_THEME,
            secondaryColor: '#bbbbbb',
            backgroundColor: '#fdfcf7',
            titleText: 'CERTIFICATE',
            subtitleText: 'OF COMPLETION',
            presentedText: 'This certificate is proudly presented to',
            forCompletionText: 'for successfully completing the course',
            borderWidth: 6,
        }),
        defaultFields: () => [
            baseField('institute_logo', 'Institute Logo', 'text', 511, 60, 100, 90, {
                alignment: 'center',
            }),
            baseField('institute_name', 'Institute Name', 'text', 261, 88, 600, 28, {
                fontSize: 18,
                fontColor: '#555',
                fontFamily: 'Times New Roman, serif',
            }),
            baseField('student_name', 'Student Name', 'text', 261, 390, 600, 60, {
                fontSize: 40,
                fontWeight: 'bold',
                fontFamily: 'Times New Roman, serif',
                fontColor: '#1f2937',
            }),
            baseField('course_name', 'Course Name', 'text', 261, 595, 600, 50, {
                fontSize: 28,
                fontWeight: 'bold',
                fontFamily: 'Times New Roman, serif',
                fontColor: '#1f2937',
            }),
            baseField('completion_date', 'Date of Completion', 'date', 165, 655, 240, 28, {
                fontSize: 18,
                fontColor: '#444',
            }),
            baseField('certificate_id', 'Certificate ID', 'text', 285, 738, 553, 22, {
                fontSize: 12,
                fontColor: '#888',
            }),
        ],
    },
    {
        id: `${BUILTIN_TEMPLATE_ID_PREFIX}modern-minimal`,
        name: 'Modern Minimal',
        description: 'Clean sans-serif layout with a single accent stripe',
        svg: modernMinimalSvg,
        hiddenCustomizationKeys: ['secondaryColor'],
        defaultCustomizations: (themeColor) => ({
            primaryColor: themeColor || DEFAULT_THEME,
            secondaryColor: themeColor || DEFAULT_THEME,
            backgroundColor: '#ffffff',
            titleText: 'Certificate of',
            subtitleText: 'Achievement',
            presentedText: 'PRESENTED TO',
            forCompletionText: 'FOR COMPLETING',
            borderWidth: 14,
        }),
        defaultFields: () => [
            baseField('institute_logo', 'Institute Logo', 'text', 943, 80, 100, 70, {
                alignment: 'right',
            }),
            baseField('institute_name', 'Institute Name', 'text', 780, 155, 263, 20, {
                fontSize: 13,
                fontColor: '#888',
                fontFamily: 'Helvetica, Arial, sans-serif',
                alignment: 'right',
            }),
            baseField('student_name', 'Student Name', 'text', 80, 410, 963, 70, {
                fontSize: 56,
                fontWeight: 'bold',
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontColor: '#222',
                alignment: 'left',
            }),
            baseField('course_name', 'Course Name', 'text', 80, 575, 963, 50, {
                fontSize: 32,
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontColor: '#444',
                alignment: 'left',
            }),
            baseField('completion_date', 'Completion Date', 'date', 80, 680, 300, 28, {
                fontSize: 18,
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontColor: '#444',
                alignment: 'left',
            }),
            baseField('certificate_id', 'Certificate ID', 'text', 743, 680, 300, 28, {
                fontSize: 18,
                fontFamily: 'Helvetica, Arial, sans-serif',
                fontColor: '#444',
                alignment: 'left',
            }),
        ],
    },
    {
        id: `${BUILTIN_TEMPLATE_ID_PREFIX}elegant-gold`,
        name: 'Elegant Gold',
        description: 'Formal serif design with gold ornaments and award seal',
        svg: elegantGoldSvg,
        defaultCustomizations: (themeColor) => ({
            primaryColor: themeColor || DEFAULT_THEME,
            secondaryColor: '#b8954d',
            backgroundColor: '#fbf6ea',
            titleText: 'Certificate',
            subtitleText: 'OF EXCELLENCE',
            presentedText: '~ AWARDED TO ~',
            forCompletionText: 'has successfully completed',
            borderWidth: 3,
        }),
        defaultFields: () => [
            baseField('institute_logo', 'Institute Logo', 'text', 156, 590, 90, 80, {
                alignment: 'center',
            }),
            baseField('institute_name', 'Institute Name', 'text', 261, 110, 600, 24, {
                fontSize: 16,
                fontColor: '#7a5a25',
                fontFamily: 'Georgia, Times New Roman, serif',
            }),
            baseField('student_name', 'Student Name', 'text', 261, 410, 600, 70, {
                fontSize: 48,
                fontFamily: 'Georgia, Times New Roman, serif',
                fontColor: '#3a2c10',
                fontWeight: 'bold',
            }),
            baseField('course_name', 'Course Name', 'text', 261, 600, 600, 45, {
                fontSize: 26,
                fontWeight: 'bold',
                fontFamily: 'Georgia, Times New Roman, serif',
                fontColor: '#5a4216',
            }),
            baseField('completion_date', 'Completion Date', 'date', 261, 668, 250, 26, {
                fontSize: 16,
                fontFamily: 'Georgia, Times New Roman, serif',
                fontColor: '#7a5a25',
                alignment: 'center',
            }),
            baseField('certificate_id', 'Certificate ID', 'text', 261, 715, 600, 20, {
                fontSize: 11,
                fontFamily: 'Georgia, Times New Roman, serif',
                fontColor: '#aaa',
            }),
        ],
    },
];

export const DEFAULT_BUILTIN_TEMPLATE: BuiltinCertificateTemplate =
    BUILTIN_TEMPLATES.find((t) => t.isDefault) ?? (BUILTIN_TEMPLATES[0] as BuiltinCertificateTemplate);

export const isBuiltinTemplateId = (id?: string): boolean =>
    !!id && id.startsWith(BUILTIN_TEMPLATE_ID_PREFIX);

export const getBuiltinTemplateById = (
    id?: string
): BuiltinCertificateTemplate | undefined =>
    BUILTIN_TEMPLATES.find((t) => t.id === id);

/**
 * Returns an SVG data URL for a built-in template with the supplied
 * customizations applied. Used both as the visual editor canvas background
 * (live updates as the admin edits) and as the source for canvas
 * rasterization at save time.
 */
export const getBuiltinTemplateSvgDataUrl = (
    template: BuiltinCertificateTemplate,
    customizations: TemplateCustomizations
): string => {
    const svg = template.svg(customizations);
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

/**
 * Rasterize a built-in template's SVG (with current customizations) to a
 * PNG data URL. Called at save time so the backend's PDF renderer receives
 * a flat raster instead of an SVG that may render inconsistently across
 * environments.
 */
export const rasterizeBuiltinTemplate = async (
    template: BuiltinCertificateTemplate,
    customizations: TemplateCustomizations
): Promise<string> => {
    const svgUrl = getBuiltinTemplateSvgDataUrl(template, customizations);
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = TEMPLATE_WIDTH;
            canvas.height = TEMPLATE_HEIGHT;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Canvas 2D context unavailable'));
                return;
            }
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, TEMPLATE_WIDTH, TEMPLATE_HEIGHT);
            ctx.drawImage(img, 0, 0, TEMPLATE_WIDTH, TEMPLATE_HEIGHT);
            resolve(canvas.toDataURL('image/png', 1.0));
        };
        img.onerror = () => reject(new Error('Failed to rasterize built-in template SVG'));
        img.src = svgUrl;
    });
};

/**
 * Build an ImageTemplate from a built-in design + customizations, using an
 * SVG data URL as the image source. The save flow rasterizes this to PNG
 * and uploads to S3 before persisting — but for the editor canvas, the SVG
 * data URL is cheap to update on every keystroke.
 */
export const buildImageTemplateFromBuiltin = (
    template: BuiltinCertificateTemplate,
    customizations: TemplateCustomizations
): { imageTemplate: ImageTemplate; fieldMappings: FieldMapping[] } => {
    const dataUrl = getBuiltinTemplateSvgDataUrl(template, customizations);
    const imageTemplate: ImageTemplate = {
        id: template.id,
        fileName: `${template.id}.svg`,
        originalFileName: `${template.name}.png`,
        imageDataUrl: dataUrl,
        width: TEMPLATE_WIDTH,
        height: TEMPLATE_HEIGHT,
        format: 'png',
        createdAt: new Date().toISOString(),
        sourceType: 'image',
    };
    const fieldMappings: FieldMapping[] = template
        .defaultFields(customizations)
        .map((f) => ({ ...f, id: nanoid() }));
    return { imageTemplate, fieldMappings };
};

export const TEMPLATE_CANVAS_DIMENSIONS = {
    width: TEMPLATE_WIDTH,
    height: TEMPLATE_HEIGHT,
};
