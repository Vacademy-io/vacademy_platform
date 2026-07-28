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
