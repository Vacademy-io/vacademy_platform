import { describe, it, expect } from 'vitest';
import { detectSerializeLoss } from '../reload';

/**
 * Save-side structural loss detection (the legacy Yoopta editor's save path).
 *
 * Why this exists: authors reported "This will remove 1 table from the slide"
 * mid-session on slides where they had added or removed nothing. The editor's
 * existing save-side checks only fire when MORE THAN HALF the blocks vanish or
 * when a serializer THROWS, so a serialize that quietly drops a single table
 * reached the backend, whose structural guard is the first thing to notice — and
 * all it can say is "you are removing a table", which the author knows is false.
 *
 * The invariant that makes this safe: it compares the editor value against its
 * OWN serialization. A genuine deletion removes the block from both sides at
 * once, so it is invisible here — only a serializer that lost something fires.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const block = (id: string, type: string, props: any = {}) => ({
    id,
    type,
    meta: { order: 0, depth: 0 },
    value: [
        { id: `e-${id}`, type, children: [{ text: '' }], props: { nodeType: 'block', ...props } },
    ],
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const value = (...blocks: any[]) => Object.fromEntries(blocks.map((b) => [b.id, b]));

const TABLE_HTML = '<table><tbody><tr><td>a</td></tr></tbody></table>';

describe('detectSerializeLoss', () => {
    it('reports a table the editor still holds but the HTML lost', () => {
        const lost = detectSerializeLoss(value(block('b1', 'Table')), '<p>only text survived</p>');
        expect(lost).toEqual(['1 table']);
    });

    it('says nothing when the table survived', () => {
        expect(detectSerializeLoss(value(block('b1', 'Table')), TABLE_HTML)).toEqual([]);
    });

    it('counts multiples and pluralises', () => {
        const lost = detectSerializeLoss(
            value(block('b1', 'Table'), block('b2', 'Table'), block('b3', 'Table')),
            TABLE_HTML
        );
        expect(lost).toEqual(['2 tables']);
    });

    // The safety invariant: a user deleting a block removes it from the editor
    // value too, so both sides drop together and this must stay silent.
    it('never fires on a real deletion (block gone from the value as well)', () => {
        expect(detectSerializeLoss(value(block('b1', 'Paragraph')), '<p>text</p>')).toEqual([]);
        expect(detectSerializeLoss(value(), '<p>everything deleted</p>')).toEqual([]);
    });

    it('ignores blocks with no structural marker (text, headings, code)', () => {
        const v = value(
            block('b1', 'Paragraph'),
            block('b2', 'HeadingOne'),
            block('b3', 'Blockquote'),
            block('b4', 'Code'),
            block('b5', 'Divider')
        );
        expect(detectSerializeLoss(v, '')).toEqual([]);
    });

    it('ignores placeholder media with no src (stripped by formatHTMLString by design)', () => {
        expect(detectSerializeLoss(value(block('b1', 'Image', { src: '' })), '<p>x</p>')).toEqual(
            []
        );
        expect(
            detectSerializeLoss(value(block('b1', 'Image', { src: 'null' })), '<p>x</p>')
        ).toEqual([]);
        expect(detectSerializeLoss(value(block('b1', 'Video', { src: '' })), '<p>x</p>')).toEqual(
            []
        );
    });

    it('still reports a real image that was dropped', () => {
        const v = value(block('b1', 'Image', { src: 'https://s3.example.com/a.png' }));
        expect(detectSerializeLoss(v, '<p>x</p>')).toEqual(['1 image']);
    });

    it('does not count a src-less <img> in the HTML as surviving content', () => {
        const v = value(block('b1', 'Image', { src: 'https://s3.example.com/a.png' }));
        expect(detectSerializeLoss(v, '<img src="" alt="placeholder"/>')).toEqual(['1 image']);
    });

    it('detects a dropped custom block by its marker', () => {
        const v = value(block('b1', 'quizBlock'), block('b2', 'flashcard'));
        const html = '<div data-yoopta-type="flashcard" data-front="a"></div>';
        expect(detectSerializeLoss(v, html)).toEqual(['1 quizBlock']);
    });

    it('handles the two blocks that emit no data-yoopta-type marker', () => {
        // mermaid is recognised by its class; Code is not structural at all.
        expect(
            detectSerializeLoss(value(block('b1', 'mermaid')), '<div class="mermaid">g</div>')
        ).toEqual([]);
        expect(detectSerializeLoss(value(block('b1', 'mermaid')), '<p>gone</p>')).toEqual([
            '1 mermaid',
        ]);
        expect(detectSerializeLoss(value(block('b1', 'Code')), '<p>whatever</p>')).toEqual([]);
    });

    it('treats video and embed as one bucket', () => {
        const v = value(
            block('b1', 'Video', { src: 'https://x/v.mp4' }),
            block('b2', 'Embed', { src: 'https://youtube.com/embed/x' })
        );
        expect(
            detectSerializeLoss(v, '<iframe src="https://youtube.com/embed/x"></iframe>')
        ).toEqual(['1 video/embed']);
        expect(
            detectSerializeLoss(v, '<video src="https://x/v.mp4"></video><iframe src="y"></iframe>')
        ).toEqual([]);
    });

    it('never throws on malformed input', () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(detectSerializeLoss(null as any, null as any)).toEqual([]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        expect(detectSerializeLoss({ x: null } as any, '')).toEqual([]);
    });
});
