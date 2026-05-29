import { jsPDF } from 'jspdf';
import type { ImageTemplate, FieldMapping } from '@/types/certificate/certificate-types';

/**
 * Sample values used when generating the downloadable template preview PDF.
 * Mirrors the iframe preview's sample set so what admins see on screen and
 * what they download match.
 */
const SAMPLE_VALUES: Record<string, string> = {
    student_name: 'Alex Sample',
    full_name: 'Alex Sample',
    institute_name: 'Vacademy Institute',
    course_name: 'Intro to Sample Course',
    package_name: 'Foundation Package',
    package_level: 'Beginner',
    session_name: '2025-26',
    completion_date: new Date().toLocaleDateString(),
    date_of_completion: new Date().toLocaleDateString(),
    completion_percentage: '92',
    certificate_id: 'PREVIEW-0000-2026',
    enrollment_number: 'ENR2024001',
    email: 'student@example.com',
    mobile_number: '+1 555 0100',
    user_id: 'PREVIEW_USER',
    theme_color: '#1e4fa1',
    institute_logo: '',
    signature: '',
};

const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = src;
    });

const drawField = (
    ctx: CanvasRenderingContext2D,
    value: string,
    f: FieldMapping
) => {
    const { x, y, width, height } = f.position;
    const { fontSize, fontColor, fontFamily, alignment, fontWeight, backgroundColor, borderColor, padding = 0 } =
        f.style;

    if (backgroundColor) {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(x, y, width, height);
    }
    if (borderColor) {
        ctx.strokeStyle = borderColor;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);
    }

    ctx.fillStyle = fontColor || '#000000';
    ctx.font = `${fontWeight === 'bold' ? 'bold ' : ''}${fontSize}px ${fontFamily}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = alignment === 'center' ? 'center' : alignment === 'right' ? 'right' : 'left';

    const textY = y + height / 2;
    let textX = x + padding;
    if (alignment === 'center') textX = x + width / 2;
    if (alignment === 'right') textX = x + width - padding;

    ctx.fillText(value, textX, textY, width - padding * 2);
};

/**
 * Stamps the unique certificate ID at the bottom-right of the canvas. Mirrors
 * the server-side `appendCertificateIdBadge` in InstituteSettingService so the
 * admin's downloaded preview is byte-equivalent to what learners receive.
 */
const drawCertificateIdBadge = (
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    certificateId: string
) => {
    const fontSize = Math.max(11, Math.round(canvasHeight * 0.014));
    const padX = Math.round(fontSize * 0.9);
    const padY = Math.round(fontSize * 0.5);
    const margin = Math.round(canvasHeight * 0.025);
    const text = `Certificate ID: ${certificateId}`;

    ctx.save();
    ctx.font = `600 ${fontSize}px Arial, sans-serif`;
    const textWidth = ctx.measureText(text).width;
    const boxWidth = textWidth + padX * 2;
    const boxHeight = fontSize + padY * 2;
    const x = canvasWidth - boxWidth - margin;
    const y = canvasHeight - boxHeight - margin;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.fillRect(x, y, boxWidth, boxHeight);
    ctx.fillStyle = '#ffffff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, x + padX, y + boxHeight / 2);
    ctx.restore();
};

interface DownloadOptions {
    customImages?: Array<{ id: string; dataUrl: string }>;
    instituteLogoUrl?: string;
    signatureUrl?: string;
}

const SYSTEM_IMAGE_FIELDS = new Set(['institute_logo', 'signature']);

/**
 * Renders the current visual editor state into a PDF blob using sample values
 * for every placeholder, then triggers a browser download. Useful for admins
 * who want to share the certificate design or save a reference copy before
 * any learner has earned the real thing.
 */
export async function downloadCertificateTemplatePreview(
    template: ImageTemplate,
    fieldMappings: FieldMapping[],
    fileName = 'certificate-template-preview.pdf',
    opts: DownloadOptions = {}
): Promise<void> {
    const canvas = document.createElement('canvas');
    canvas.width = template.width;
    canvas.height = template.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    const bg = await loadImage(template.imageDataUrl);
    ctx.drawImage(bg, 0, 0, template.width, template.height);

    const customById = new Map((opts.customImages || []).map((c) => [c.id, c.dataUrl]));

    for (const f of fieldMappings) {
        // Image fields → draw the actual image at the field's box.
        if (SYSTEM_IMAGE_FIELDS.has(f.fieldName)) {
            const url =
                f.fieldName === 'institute_logo'
                    ? opts.instituteLogoUrl
                    : opts.signatureUrl;
            if (url) {
                try {
                    const img = await loadImage(url);
                    ctx.drawImage(img, f.position.x, f.position.y, f.position.width, f.position.height);
                    continue;
                } catch {
                    // fall through to placeholder text
                }
            }
            drawField(ctx, f.displayName, f);
            continue;
        }
        if (f.fieldName.startsWith('custom_image:')) {
            const id = f.fieldName.split(':')[1] || '';
            const dataUrl = customById.get(id);
            if (dataUrl) {
                try {
                    const img = await loadImage(dataUrl);
                    ctx.drawImage(img, f.position.x, f.position.y, f.position.width, f.position.height);
                    continue;
                } catch {
                    // fall through
                }
            }
            drawField(ctx, f.displayName, f);
            continue;
        }
        // Normalize legacy field names: the old HTML editor stored fields as
        // `{{PACKAGE_LEVEL}}` (already a token). Strip braces and lowercase so
        // the SAMPLE_VALUES lookup hits for both old and new templates.
        const normalized = f.fieldName
            .replace(/^\{\{/, '')
            .replace(/\}\}$/, '')
            .toLowerCase();
        const sample =
            SAMPLE_VALUES[f.fieldName] ??
            SAMPLE_VALUES[normalized] ??
            f.displayName ??
            f.fieldName;
        drawField(ctx, sample, f);
    }

    // Bottom-right certificate ID badge — mirrors the server's
    // appendCertificateIdBadge so the admin preview matches the issued PDF.
    drawCertificateIdBadge(
        ctx,
        template.width,
        template.height,
        SAMPLE_VALUES.certificate_id ?? 'PREVIEW-0000-2026'
    );

    const pdf = new jsPDF({
        orientation: template.width > template.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [template.width, template.height],
    });
    pdf.addImage(canvas.toDataURL('image/png', 1.0), 'PNG', 0, 0, template.width, template.height);

    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
