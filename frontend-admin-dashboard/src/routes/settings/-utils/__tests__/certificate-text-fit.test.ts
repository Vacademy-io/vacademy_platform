import { describe, expect, it } from 'vitest';
import {
    fitFontSize,
    linesNeeded,
    MAX_FIT_LINES,
    textFitWarning,
} from '../certificate-text-fit';
import {
    fieldContentWidthPx,
    MAX_TEXT_LINES,
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

    it('clamps text to two lines and hides the rest', () => {
        expect(html).toContain(
            `max-height:${(MAX_TEXT_LINES * TEXT_LINE_HEIGHT).toFixed(2)}em`
        );
        expect(html).toContain('overflow:hidden');
    });

    /** A long email or hyphen-free code has no space to break at. */
    it('breaks unbreakable words rather than letting them escape the box', () => {
        expect(html).toContain('overflow-wrap:break-word');
    });

    it('carries the box width the server-side fitter measures against', () => {
        expect(html).toContain('data-fit-width="400"');
        expect(html).toContain('data-fit-size="32"');
    });

    /** Padding and border eat into the width text actually gets. */
    it('reports content width, not box width', () => {
        expect(fieldContentWidthPx(field())).toBe(400);
        expect(
            fieldContentWidthPx(
                field({
                    style: { ...field().style, padding: 8, borderColor: '#000000' },
                })
            )
        ).toBe(400 - 16 - 2);
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
