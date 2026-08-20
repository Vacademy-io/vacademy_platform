import { describe, expect, it } from 'vitest';
import {
    applyTextFitToHtml,
    fitFontSize,
    linesAllowed,
    linesNeeded,
    MAX_FIT_LINES,
    textFitWarning,
} from '../certificate-text-fit';
import {
    fieldContentHeightPx,
    fieldContentWidthPx,
    serializeImageTemplateToHtml,
    TEXT_LINE_HEIGHT,
} from '../serialize-image-template-to-html';
import type { FieldMapping, ImageTemplate } from '@/types/certificate/certificate-types';

/**
 * Long values on a fixed-size certificate.
 *
 * A field is sized against "Alex Sample" and filled at issuance with
 * "Bhuvaneshwari Ramachandran". The old output was `white-space:nowrap;
 * overflow:hidden`, so the long name was sliced at *both* ends — the box centres
 * its content — and the admin never saw it happen.
 */

const template: ImageTemplate = {
    id: 't1',
    fileName: 'bg.png',
    originalFileName: 'bg.png',
    imageDataUrl: 'data:image/png;base64,AAA',
    width: 1123,
    height: 794,
    format: 'png',
    createdAt: '2026-01-01',
    sourceType: 'image',
};

const field = (over: Partial<FieldMapping> = {}): FieldMapping => ({
    id: 'f1',
    fieldName: 'student_name',
    displayName: 'Student Name',
    type: 'text',
    position: { x: 100, y: 200, width: 400, height: 60 },
    style: {
        fontSize: 32,
        fontColor: '#000000',
        fontFamily: 'Arial, sans-serif',
        alignment: 'center',
        fontWeight: 'normal',
    },
    ...over,
});

describe('serialized field markup', () => {
    const html = serializeImageTemplateToHtml(template, [field()]);

    /** The regression itself: nowrap is what sliced long names. */
    it('no longer forces text onto a single line', () => {
        expect(html).not.toContain('white-space:nowrap');
    });

    /**
     * The clamp is the box the admin drew, not a fixed number of lines. An `em`
     * clamp shrank with the font, so shrinking never bought the text any room.
     */
    it('clamps text to the height of the box and hides the rest', () => {
        expect(html).toContain('max-height:60px');
        expect(html).toContain('overflow:hidden');
    });

    /** A long email or hyphen-free code has no space to break at. */
    it('breaks unbreakable words rather than letting them escape the box', () => {
        expect(html).toContain('overflow-wrap:break-word');
    });

    it('carries the box the server-side fitter measures against', () => {
        expect(html).toContain('data-fit-width="400"');
        expect(html).toContain('data-fit-height="60"');
        expect(html).toContain('data-fit-size="32"');
    });

    /** Padding and border eat into the space text actually gets. */
    it('reports content size, not box size', () => {
        expect(fieldContentWidthPx(field())).toBe(400);
        expect(fieldContentHeightPx(field())).toBe(60);
        const padded = field({
            style: { ...field().style, padding: 8, borderColor: '#000000' },
        });
        expect(fieldContentWidthPx(padded)).toBe(400 - 16 - 2);
        expect(fieldContentHeightPx(padded)).toBe(60 - 16 - 2);
    });

    /**
     * The visual-mode marker the settings page keys off to decide which editor
     * a saved template belongs to. Restructuring the fields must not disturb it.
     */
    it('keeps the certificate-canvas marker intact', () => {
        expect(html).toContain('class="certificate-canvas"');
    });

    it('still emits the substitution token for the backend', () => {
        expect(html).toContain('{{STUDENT_NAME}}');
    });

    /** Codes and logos are images — wrapping must not be applied to them. */
    it('leaves image fields as plain positioned images', () => {
        const imageHtml = serializeImageTemplateToHtml(template, [
            field({ fieldName: 'certificate_qr' }),
        ]);
        expect(imageHtml).toContain('<img src="{{CERTIFICATE_QR}}"');
        expect(imageHtml).not.toContain('data-fit-width');
    });
});

describe('fitting long values', () => {
    it('leaves a value that already fits at the chosen size', () => {
        expect(fitFontSize('Alex Sample', 400, 32)).toBe(32);
    });

    it('shrinks a long name until it fits two lines', () => {
        const fitted = fitFontSize('Bhuvaneshwari Ramachandran', 200, 32);
        expect(fitted).toBeLessThan(32);
        expect(linesNeeded('Bhuvaneshwari Ramachandran', 200, fitted)).toBeLessThanOrEqual(
            MAX_FIT_LINES
        );
    });

    it('shrinks a long course name until it fits two lines', () => {
        const name = 'Advanced Certificate in Data Science and Machine Learning';
        const fitted = fitFontSize(name, 400, 32);
        expect(linesNeeded(name, 400, fitted)).toBeLessThanOrEqual(MAX_FIT_LINES);
    });

    /** A name printed at 3px reads as a fault, not a design. */
    it('stops shrinking at half the chosen size', () => {
        const fitted = fitFontSize(
            'Advanced Certificate in Data Science and Machine Learning for Working Professionals',
            60,
            32
        );
        expect(fitted).toBeGreaterThanOrEqual(16);
    });

    it('counts an unbreakable word as the lines it will really take', () => {
        expect(
            linesNeeded('bhuvaneshwari.ramachandran@institute-example.ac.in', 120, 32)
        ).toBeGreaterThan(1);
    });
});

describe('fitting to the box height', () => {
    /**
     * The reported bug: a long course name in a box one line tall printed its
     * first line and had the second sliced off, so the value was unreadable.
     */
    it('shrinks a long value to one line when the box only holds one', () => {
        const name = 'Advanced Certificate in Data Science and Machine Learning';
        const oneLineTall = 32 * TEXT_LINE_HEIGHT;
        const fitted = fitFontSize(name, 400, 32, false, oneLineTall);
        expect(fitted).toBeLessThan(32);
        expect(linesNeeded(name, 400, fitted)).toBeLessThanOrEqual(
            linesAllowed(oneLineTall, fitted)
        );
    });

    /** A box drawn tall enough for three lines gets three, rather than clipping at two. */
    it('lets a tall box use the lines it has room for', () => {
        const name = 'Advanced Certificate in Data Science and Machine Learning';
        const threeLinesTall = 3 * 32 * TEXT_LINE_HEIGHT;
        expect(linesNeeded(name, 400, 32)).toBe(3);
        expect(fitFontSize(name, 400, 32, false, threeLinesTall)).toBe(32);
        // The same value in the same width, with no height recorded, still has
        // to shrink — that is the pre-existing two-line budget.
        expect(fitFontSize(name, 400, 32)).toBeLessThan(32);
    });

    it('never reports a budget below one line', () => {
        expect(linesAllowed(4, 32)).toBe(1);
    });

    /** Templates saved before the height existed keep the old flat budget. */
    it('falls back to two lines when the box height is unknown', () => {
        expect(linesAllowed(0, 32)).toBe(MAX_FIT_LINES);
    });

    it('counts a box drawn at exactly two lines as holding two', () => {
        expect(linesAllowed(2 * 32 * TEXT_LINE_HEIGHT, 32)).toBe(2);
    });
});

describe('preview fitting', () => {
    /**
     * The preview used to substitute values and stop, while the issued PDF went
     * on to shrink them — so the one place an admin could check their design was
     * the one place that did not behave like the certificate.
     */
    it('shrinks a long value in already-substituted preview HTML', () => {
        const substituted = serializeImageTemplateToHtml(template, [
            field({ position: { x: 0, y: 0, width: 200, height: 40 } }),
        ]).replace('{{STUDENT_NAME}}', 'Bhuvaneshwari Ramachandran');

        const out = applyTextFitToHtml(substituted);
        expect(out).toContain('data-fit-width="200"');
        // Shrunk, and shrunk to exactly what the shared arithmetic says — the
        // preview and the server have to land on the same number.
        expect(out).not.toContain('font-size:32px');
        const expected = fitFontSize('Bhuvaneshwari Ramachandran', 200, 32, false, 40);
        expect(out).toContain(`font-size:${expected.toFixed(2)}px`);
    });

    it('leaves a value that already fits alone', () => {
        const substituted = serializeImageTemplateToHtml(template, [field()]).replace(
            '{{STUDENT_NAME}}',
            'Alex Sample'
        );
        expect(applyTextFitToHtml(substituted)).toContain('font-size:32px');
    });

    /** Hand-authored HTML carries no fit attributes and must pass through. */
    it('returns HTML with no fitted fields untouched', () => {
        const plain = '<html><body><p>hello</p></body></html>';
        expect(applyTextFitToHtml(plain)).toBe(plain);
    });
});

describe('editor warning', () => {
    /** A comfortable box should not nag. */
    it('says nothing when a long value fits', () => {
        expect(
            textFitWarning({ fieldName: 'student_name', widthPx: 700, fontSizePx: 20 })
        ).toBeNull();
    });

    it('warns that a long name will shrink in a tight box', () => {
        const message = textFitWarning({
            fieldName: 'student_name',
            widthPx: 220,
            fontSizePx: 32,
        });
        expect(message).toContain('shrink');
    });

    it('warns that a very tight box will cut a long value off', () => {
        const message = textFitWarning({
            fieldName: 'course_name',
            widthPx: 90,
            fontSizePx: 32,
        });
        expect(message).toContain('cut off');
    });

    /** Only fields that actually receive long free text have a sample. */
    it('says nothing for fields with no realistic long value', () => {
        expect(
            textFitWarning({ fieldName: 'certificate_id', widthPx: 20, fontSizePx: 32 })
        ).toBeNull();
        expect(
            textFitWarning({ fieldName: 'student_name', widthPx: 0, fontSizePx: 32 })
        ).toBeNull();
    });
});
