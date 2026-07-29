import { describe, it, expect } from 'vitest';
import { analyzeConversion } from '../convert-yoopta';

/** formatHTMLString-style skeleton a stored Yoopta doc actually has, with the
 *  pretty-printed newlines between block tags that broke the naive
 *  textContent comparison (regression: "Some text would not carry over" fired
 *  on plain multi-paragraph docs). */
const wrap = (inner: string) =>
    `<html>\n<head></head>\n<body>\n<div>\n${inner}\n</div>\n</body>\n</html>`;

describe('analyzeConversion — text-loss check', () => {
    it('does not flag a plain multi-paragraph doc (the false-positive case)', () => {
        const html = wrap('<p>Hello</p>\n<p>tell me this</p>\n<h2>Understanding</h2>');
        const result = analyzeConversion(html);
        expect(result.textChanged).toBe(false);
        expect(result.lostBlocks).toEqual([]);
        expect(result.safe).toBe(true);
    });

    it('does not flag inline formatting (bold / italic)', () => {
        const html = wrap('<p>this is <strong>bold</strong> and <em>italic</em> text</p>');
        const result = analyzeConversion(html);
        expect(result.textChanged).toBe(false);
        expect(result.safe).toBe(true);
    });

    it('does not flag content split by <br> line breaks', () => {
        const html = wrap('<p>line one<br>line two<br>line three</p>');
        const result = analyzeConversion(html);
        expect(result.textChanged).toBe(false);
    });

    it('round-trips a plain sentence with no reported loss', () => {
        const html = wrap('<p>keep this sentence intact please</p>');
        const result = analyzeConversion(html);
        expect(result.textChanged).toBe(false);
        expect(result.safe).toBe(true);
    });
});

/**
 * Legacy-Yoopta fidelity: the exact HTML Yoopta's serializer emits for each
 * content type must convert into the new editor without loss. These reproduce
 * the reported image / checkbox / callout drops and guard the rest.
 */
describe('analyzeConversion — legacy Yoopta content fidelity', () => {
    it('carries an image across (Yoopta div>img wrapper)', () => {
        const html = wrap(
            '<div style="margin-left: 0px; display: flex; width: 100%; justify-content: center;"><img data-meta-align="center" data-meta-depth="0" src="https://s3.example.com/photo.png" alt="a diagram" width="600" height="400" objectfit="contain"/></div>'
        );
        const r = analyzeConversion(html);
        expect(r.convertedHtml).toContain('https://s3.example.com/photo.png');
        expect(r.lostMedia).toEqual([]);
    });

    it('carries a callout across (Yoopta <dl data-theme>)', () => {
        const html = wrap(
            '<dl data-theme="info" data-meta-align="left" data-meta-depth="0" style="color:#08a2e7; border-left:4px solid #08a2e7; background-color:#e1f3fe">Remember this important note</dl>'
        );
        const r = analyzeConversion(html);
        expect(r.convertedHtml).toContain('data-yoopta-type="callout"');
        expect(r.convertedHtml).toContain('Remember this important note');
        expect(r.textChanged).toBe(false);
    });

    it('carries checkboxes across as a checklist (Yoopta [x]/[ ] text markers)', () => {
        const html = wrap(
            '<ul data-meta-depth="0" style=""><li>[x] first item done</li></ul>' +
                '<ul data-meta-depth="0" style=""><li>[ ] second item pending</li></ul>'
        );
        const r = analyzeConversion(html);
        // Checklist markup present, marker text stripped, item text kept.
        expect(r.convertedHtml.toLowerCase()).toContain('check');
        expect(r.convertedHtml).toContain('first item done');
        expect(r.convertedHtml).toContain('second item pending');
        expect(r.convertedHtml).not.toContain('[x]');
        expect(r.convertedHtml).not.toContain('[ ]');
        expect(r.textChanged).toBe(false);
    });

    it('carries a bulleted list across (Yoopta one <ul> per item)', () => {
        const html = wrap(
            '<ul data-meta-depth="0"><li>alpha</li></ul><ul data-meta-depth="0"><li>beta</li></ul>'
        );
        const r = analyzeConversion(html);
        expect(r.convertedHtml).toContain('alpha');
        expect(r.convertedHtml).toContain('beta');
        expect(r.textChanged).toBe(false);
    });

    it('carries a callout with an image and text together', () => {
        const html = wrap(
            '<h1 data-meta-depth="0">Title</h1>' +
                '<div style="display: flex; justify-content: center;"><img data-meta-depth="0" src="https://s3.example.com/x.jpg" alt="x" width="10" height="10"/></div>' +
                '<dl data-theme="warning">heads up</dl>' +
                '<ul><li>[x] done</li></ul>'
        );
        const r = analyzeConversion(html);
        expect(r.convertedHtml).toContain('https://s3.example.com/x.jpg');
        expect(r.convertedHtml).toContain('data-yoopta-type="callout"');
        expect(r.convertedHtml).toContain('heads up');
        expect(r.convertedHtml).toContain('done');
        expect(r.lostMedia).toEqual([]);
        expect(r.textChanged).toBe(false);
    });

    it('carries blockquote, divider and headings', () => {
        const html = wrap(
            '<h2 data-meta-depth="0">Section</h2>' +
                '<blockquote data-meta-depth="0" style="border-left: 3px solid;">a wise quote</blockquote>' +
                '<hr data-meta-theme="solid" style="background-color: #8383e0; height: 1.2px" />' +
                '<p>after the rule</p>'
        );
        const r = analyzeConversion(html);
        expect(r.convertedHtml).toContain('a wise quote');
        expect(r.convertedHtml).toContain('<hr');
        expect(r.convertedHtml).toContain('Section');
        expect(r.textChanged).toBe(false);
    });

    it('keeps an inline link and its href', () => {
        const html = wrap(
            '<p>see <a href="https://example.com/page" target="_blank" rel="noopener">this link</a> now</p>'
        );
        const r = analyzeConversion(html);
        expect(r.convertedHtml).toContain('https://example.com/page');
        expect(r.convertedHtml).toContain('this link');
        expect(r.lostMedia).toEqual([]);
        expect(r.textChanged).toBe(false);
    });

    it('carries a code block across (Yoopta <pre data-code> base64)', () => {
        const code = 'print("Hello, World!")';
        const b64 = btoa(unescape(encodeURIComponent(code)));
        const html = wrap(
            `<pre data-code="${b64}" data-theme="VSCode" data-language="python" data-meta-depth="0" style="white-space: pre;"><code>print("Hello, World!")</code></pre>`
        );
        const r = analyzeConversion(html);
        expect(r.convertedHtml).toContain('data-code=');
        expect(r.convertedHtml.toLowerCase()).toContain('python');
    });

    it('never silently drops a table (safety net; browsers import tables natively)', () => {
        // NOTE: happy-dom (this test env) does not populate table cell
        // colSpan/cellIndex, so Lexical's table importer can't rebuild the grid
        // here — which is precisely when the safety net must fire: the table is
        // reported as loss and the conversion is NOT auto-safe, never silently
        // dropped. Real browsers populate those props and import the table, so
        // there the conversion is clean. Either way: no silent data loss.
        const html = wrap(
            '<table data-meta-depth="0"><tbody><tr><td>Head</td></tr><tr><td>body cell</td></tr></tbody></table>'
        );
        const r = analyzeConversion(html);
        expect(r.lostBlocks).toContain('table');
        expect(r.safe).toBe(false);
    });

    it('carries a YouTube embed across (Yoopta div>iframe)', () => {
        const html = wrap(
            '<div style="display: flex; justify-content: center;"><iframe data-meta-depth="0" src="https://www.youtube.com/embed/abc123XYZ" width="560" height="315"></iframe></div>'
        );
        const r = analyzeConversion(html);
        expect(r.convertedHtml).toContain('youtube.com/embed/abc123XYZ');
        expect(r.lostMedia).toEqual([]);
    });
});
