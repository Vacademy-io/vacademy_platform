import { describe, it, expect } from 'vitest';
import { createEditor } from 'lexical';
import { editorNodes, editorTheme, onEditorError } from '../editor-config';
import { importDocHtml, exportDocHtml, diffStructuralLoss } from '../serialization';
import { normalizeYooptaHtml } from '../normalize-yoopta';

/**
 * Regression tests for FALSE "this will remove N …" save confirms.
 *
 * The backend's structural-loss guard (SlideService.describeStructuralLoss) counts
 * `data-yoopta-type` markers plus <table>/<img>/<video>/<iframe> in the HTML it is
 * asked to store. It is arithmetically right about its input — so whenever the
 * editor's own import→export drops one of those, the author gets a confirm box
 * about content they never touched (worse: the words usually survive, so there is
 * nothing on screen to explain it).
 *
 * Each case below was reproduced against the real import/export pipeline before
 * being fixed. Counts are asserted for EQUALITY, not "no loss" — a duplicated
 * table is as wrong as a dropped one.
 */

function roundTrip(html: string): string {
    const editor = createEditor({
        namespace: 'roundtrip-integrity',
        nodes: editorNodes,
        theme: editorTheme,
        onError: onEditorError,
    });
    importDocHtml(editor, html);
    return exportDocHtml(editor);
}

const wrap = (inner: string) =>
    `<html><head></head><body><div><div data-editor="lexical">${inner}</div></div></body></html>`;

/** Port of the backend's counting, so these tests fail for the same reason prod does. */
function serverCounts(html: string): Record<string, number> {
    const counts: Record<string, number> = {};
    const re = /data-yoopta-type="([a-zA-Z]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html))) counts[m[1]!] = (counts[m[1]!] ?? 0) + 1;
    const occ = (s: string, sub: string) => s.split(sub).length - 1;
    const t = occ(html, '<table');
    if (t > 0) counts['table'] = t;
    const v = occ(html, '<video') + occ(html, '<iframe');
    if (v > 0) counts['video/embed'] = v;
    return counts;
}

describe('callout: marker survives on any tag it was authored with', () => {
    // Hand-written and AI-generated lesson HTML puts the callout marker on <aside>
    // or <blockquote>. Matching only <div> imported those as a plain paragraph, so
    // the marker never came back → "This will remove 1 callout".
    it.each(['aside', 'blockquote', 'section', 'div'])('keeps the marker on <%s>', (tag) => {
        const src = wrap(
            `<${tag} data-yoopta-type="callout" data-theme="info">Remember this</${tag}>`
        );
        const out = roundTrip(src);
        expect(out).toContain('data-yoopta-type="callout"');
        expect(out).toContain('Remember this');
        expect(serverCounts(out)).toEqual(serverCounts(src));
    });

    it('keeps the theme when it is a known one, falls back to info otherwise', () => {
        expect(
            roundTrip(wrap('<aside data-yoopta-type="callout" data-theme="warning">w</aside>'))
        ).toContain('data-theme="warning"');
        expect(
            roundTrip(wrap('<div data-yoopta-type="callout" data-theme="chartreuse">w</div>'))
        ).toContain('data-theme="info"');
    });
});

describe('callout: nested content is not flattened', () => {
    // The callout used to store plaintext, so a table inside one was reduced to its
    // words: the <table> vanished from the saved HTML while every cell's text stayed
    // visible on screen → "This will remove 1 table" with nothing to point at.
    it('preserves a table nested in a callout (exactly once)', () => {
        const src = wrap(
            '<div data-yoopta-type="callout" data-theme="info">' +
                '<table><tbody><tr><td>Use less</td><td>reduce waste</td></tr></tbody></table>' +
                '</div>'
        );
        const out = roundTrip(src);
        expect(serverCounts(out)).toEqual(serverCounts(src));
        expect(out).toContain('reduce waste');
    });

    // A callout whose only element child is media used to be DELETED outright by
    // the Yoopta media-wrapper unwrapper (replaceWith on the block's own div), so
    // the block, its theme and its text vanished and the bare image was left.
    it('preserves an image nested in a callout', () => {
        const src = wrap(
            '<div data-yoopta-type="callout" data-theme="info">' +
                '<img src="https://s3.example.com/diagram.png" alt="d"/>' +
                '</div>'
        );
        const out = roundTrip(src);
        expect(out).toContain('https://s3.example.com/diagram.png');
        expect(out).toContain('data-yoopta-type="callout"');
        expect(diffStructuralLoss(src, out)).toEqual([]);
    });

    it('keeps a callout that holds text alongside an image', () => {
        const out = roundTrip(
            wrap(
                '<div data-yoopta-type="callout" data-theme="info">note <img src="https://s3.example.com/d.png" alt="d"/></div>'
            )
        );
        expect(out).toContain('data-yoopta-type="callout"');
        expect(out).toContain('note');
        expect(out).toContain('https://s3.example.com/d.png');
    });

    it('still unwraps a genuine Yoopta flex media wrapper', () => {
        // The behaviour the guard above must not regress: a plain wrapper div with
        // nothing but the image is still promoted so the image imports as a block.
        const normalized = normalizeYooptaHtml(
            '<div style="display: flex; justify-content: center;"><img src="https://s3.example.com/y.png" alt="y"/></div>'
        );
        expect(normalized.trim().startsWith('<img')).toBe(true);
    });

    it('preserves inline formatting in a callout', () => {
        const out = roundTrip(
            wrap(
                '<div data-yoopta-type="callout" data-theme="info"><strong>Stay safe</strong> — ask an adult</div>'
            )
        );
        expect(out).toContain('<strong>Stay safe</strong>');
    });

    it('round-trips a legacy plaintext callout unchanged on the second pass', () => {
        // The unsaved-changes baseline is an exact string compare, so a re-save of an
        // untouched slide must be byte-stable.
        const pass1 = roundTrip(
            wrap('<div data-yoopta-type="callout" data-theme="info">plain words</div>')
        );
        expect(roundTrip(pass1)).toBe(pass1);
    });
});

describe('blast radius: things the fixes must NOT change', () => {
    // unwrapMediaWrappers now leaves a text-carrying wrapper alone. The image inside
    // it must still import — Lexical claims <img> wherever it sits — or we'd have
    // traded a lost callout for a lost image.
    it('imports an image that is still inside a wrapper div', () => {
        const out = roundTrip(
            wrap(
                '<div style="display: flex;">caption text<img src="https://s3.example.com/w.png" alt="w"/></div>'
            )
        );
        expect(out).toContain('https://s3.example.com/w.png');
        expect(out).toContain('caption text');
    });

    it('leaves a plain blockquote as a quote, not a callout', () => {
        const out = roundTrip(wrap('<blockquote>a wise quote</blockquote>'));
        expect(out).toContain('a wise quote');
        expect(out).not.toContain('data-yoopta-type="callout"');
    });

    it.each(['aside', 'section'])('leaves a plain <%s> alone', (tag) => {
        const out = roundTrip(wrap(`<${tag}><p>ordinary content</p></${tag}>`));
        expect(out).toContain('ordinary content');
        expect(out).not.toContain('data-yoopta-type="callout"');
    });

    it('keeps other custom blocks intact (payload-driven, unaffected by the callout change)', () => {
        const src = wrap(
            '<div data-yoopta-type="quizBlock" data-quiz="eyJxdWVzdGlvbiI6IlEiLCJ0eXBlIjoibWNxIiwib3B0aW9ucyI6W3sidGV4dCI6IkEiLCJpc0NvcnJlY3QiOnRydWV9XSwiZXhwbGFuYXRpb24iOiIifQ==">Q</div>'
        );
        expect(serverCounts(roundTrip(src))).toEqual(serverCounts(src));
    });

    it('promotes a legacy multi-line callout to <br> exactly once', () => {
        const pass1 = roundTrip(
            wrap('<div data-yoopta-type="callout" data-theme="info">line one\nline two</div>')
        );
        expect(pass1).toContain('line one<br>line two');
        // Stable afterwards — no runaway <br> growth across save cycles.
        expect(roundTrip(pass1)).toBe(pass1);
    });
});

describe('placeholder images are not counted as content', () => {
    it('ignores a src-less img on both sides of the diff', () => {
        const withPlaceholder = wrap('<p>x</p><img src="" alt="pending upload"/>');
        const without = wrap('<p>x</p>');
        expect(diffStructuralLoss(withPlaceholder, without)).toEqual([]);
    });

    it('still reports a real image loss', () => {
        const src = wrap('<img src="https://s3.example.com/real.png" alt="r"/>');
        expect(diffStructuralLoss(src, wrap('<p>gone</p>'))).toContain('image');
    });
});

describe('legacy Yoopta callout conversion', () => {
    it('carries markup, not just words, out of a <dl> callout', () => {
        const normalized = normalizeYooptaHtml(
            '<dl data-theme="warning"><strong>Heads up</strong> read this</dl>'
        );
        expect(normalized).toContain('data-yoopta-type="callout"');
        expect(normalized).toContain('data-theme="warning"');
        expect(normalized).toContain('<strong>Heads up</strong>');
    });

    it('keeps a table that was sitting inside a legacy callout', () => {
        const normalized = normalizeYooptaHtml(
            '<dl data-theme="info"><table><tbody><tr><td>a</td></tr></tbody></table></dl>'
        );
        expect(normalized).toContain('<table');
    });
});
