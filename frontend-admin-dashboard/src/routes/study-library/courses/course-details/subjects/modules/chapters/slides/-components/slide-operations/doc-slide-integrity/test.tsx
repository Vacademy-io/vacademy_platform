/**
 * DOC-slide data-integrity regression suite.
 *
 * Context: docs slides repeatedly "lost content on slide switch" and flipped to
 * UNSYNC. This suite drives the REAL app pipeline headlessly:
 *   build block values -> html.serialize (what the DB stores) -> formatHTMLString
 *   -> app reload preprocessing (appReloadPreprocess) -> html.deserialize
 *   -> serialize again (the auto-save that fires on slide switch).
 *
 * Part 1 proves every reachable block type survives that round-trip intact.
 * Part 2 pins the ONE loss mechanism: when a block's serializer THROWS, the
 * app's per-block fallback drops it — so the save must be flagged "degraded" and
 * the silent auto-save-on-switch must refuse to persist it (see
 * slide-material.tsx getCurrentEditorHTMLContent + autoPublishDocSlide).
 */
import { describe, it, expect } from 'vitest';
import { createYooptaEditor } from '@yoopta/editor';
import { html } from '@yoopta/exports';
import { plugins } from '@/constants/study-library/yoopta-editor-plugins-tools';
import { formatHTMLString } from '../formatHtmlString';
import { appReloadPreprocess } from './reload';

// Register the app's real plugins onto a bare editor, mirroring
// slide-material.tsx applyDocContentToEditor() so serialize/deserialize
// recognise every block type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeEditor(): any {
    const editor = createYooptaEditor();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pluginDefs = plugins.map((p: any) => (typeof p.getPlugin === 'object' ? p.getPlugin : p));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pluginsMap: Record<string, any> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const inlineElements: Record<string, any> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pluginDefs.forEach((p: any) => {
        if (!p?.type) return;
        if (p.elements) {
            Object.keys(p.elements).forEach((key: string) => {
                const el = p.elements[key];
                const nt = el?.props?.nodeType;
                if (nt === 'inline' || nt === 'inlineVoid') inlineElements[key] = { ...el, rootPlugin: p.type };
            });
        }
        pluginsMap[p.type] = p;
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pluginDefs.forEach((p: any) => {
        if (p?.elements) pluginsMap[p.type] = { ...p, elements: { ...p.elements, ...inlineElements } };
    });
    editor.plugins = pluginsMap;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const blocksMap: Record<string, any> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pluginDefs.forEach((p: any) => {
        if (!p?.type || !p.elements) return;
        const rootKey = Object.keys(p.elements)[0];
        const rootEl = rootKey ? p.elements[rootKey] : undefined;
        const nodeType = rootEl?.props?.nodeType;
        if (nodeType === 'inline' || nodeType === 'inlineVoid') return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const elements: Record<string, any> = {};
        Object.keys(p.elements).forEach((key: string) => {
            const { render: _r, ...rest } = p.elements[key] || {};
            elements[key] = rest;
        });
        blocksMap[p.type] = { type: p.type, elements, hasCustomEditor: !!p.customEditor, options: p.options || {} };
    });
    editor.blocks = blocksMap;
    return editor;
}

// Mirror slide-material.tsx getCurrentEditorHTMLContent(): whole-doc serialize
// with a per-block fallback that drops a throwing block, and a `degraded` flag.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function appSaveSerialize(editor: any): { out: string; degraded: boolean } {
    const data = editor.getEditorValue();
    let htmlString = '';
    let degraded = false;
    try {
        htmlString = html.serialize(editor, data);
    } catch {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blocks = Object.values((data || {}) as Record<string, any>)
            .filter((b) => b && b.id)
            .sort((a, b) => (a?.meta?.order ?? 0) - (b?.meta?.order ?? 0));
        htmlString = blocks
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((b: any) => {
                try {
                    return html.serialize(editor, { [b.id]: b });
                } catch {
                    degraded = true; // a block was dropped
                    return '';
                }
            })
            .join('');
    }
    return { out: formatHTMLString(htmlString), degraded };
}

const decodeDataAttrs = (h: string): string => {
    let extra = '';
    const re = /data-(?:quiz|tabs|steps|columns)="([^"]*)"/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(h)) !== null) {
        try {
            extra += ' ' + atob(m[1] as string);
        } catch {
            /* not base64 */
        }
    }
    return extra;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function blk(order: number, type: string, elType: string, text: string, props: any = {}) {
    return { id: `b${order}`, type, meta: { order, depth: 0 }, value: [{ id: `e${order}`, type: elType, children: [{ text }], props: { nodeType: 'block', ...props } }] };
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function custom(order: number, type: string, props: any) {
    return { id: `b${order}`, type, meta: { order, depth: 0 }, value: [{ id: `e${order}`, type, children: [{ text: '' }], props }] };
}

describe('DOC slide: every block type survives store -> reload -> resave', () => {
    it('does not lose any block content on the switch auto-save round-trip', () => {
        const editor = makeEditor();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const value: Record<string, any> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const add = (b: any) => (value[b.id] = b);
        add(blk(0, 'Paragraph', 'paragraph', 'SIG_PARAGRAPH'));
        add(blk(1, 'HeadingOne', 'heading-one', 'SIG_HEADING'));
        add(blk(2, 'Blockquote', 'blockquote', 'SIG_QUOTE'));
        add(blk(3, 'Callout', 'callout', 'SIG_CALLOUT', { theme: 'info' }));
        add(blk(4, 'NumberedList', 'numbered-list', 'SIG_LISTITEM'));
        add(blk(5, 'Code', 'code', 'SIG_CODE', { language: 'javascript' }));
        add(custom(6, 'flashcard', { front: 'SIG_FC_FRONT', back: 'SIG_FC_BACK', editorType: 'flashcardEditor' }));
        add(custom(7, 'fillBlanks', { sentence: 'SIG_FB {blank:x}', editorType: 'fillBlanksEditor' }));
        add(custom(8, 'quizBlock', { quizData: { question: 'SIG_QUIZ_Q', type: 'mcq', explanation: 'SIG_QUIZ_EXP', options: [{ id: 'o1', text: 'SIG_QUIZ_OPT', isCorrect: true }] } }));
        add(custom(9, 'tabbedContent', { tabs: [{ label: 'SIG_TAB_LABEL', content: '<p>SIG_TAB_CONTENT</p>' }] }));
        add(custom(10, 'timeline', { steps: [{ title: 'SIG_TL_TITLE', description: 'SIG_TL_DESC', color: '#007acc' }] }));
        add(custom(11, 'columnsLayout', { gap: 16, columns: [{ content: '<p>SIG_COL_ONE</p>' }, { content: '<p>SIG_COL_TWO</p>' }] }));
        add(custom(12, 'mathBlock', { latex: 'SIG_MATH', displayMode: true }));
        add(custom(13, 'mermaid', { code: 'graph TD; A-->B; %% SIG_MERMAID' }));
        editor.setEditorValue(value as any);

        const stored = formatHTMLString(html.serialize(editor, value as any));
        const reloaded = makeEditor();
        reloaded.setEditorValue(html.deserialize(reloaded, appReloadPreprocess(stored)));
        const { out, degraded } = appSaveSerialize(reloaded);
        const searchable = out + decodeDataAttrs(out);

        const signatures = [
            'SIG_PARAGRAPH', 'SIG_HEADING', 'SIG_QUOTE', 'SIG_CALLOUT', 'SIG_LISTITEM', 'SIG_CODE',
            'SIG_FC_FRONT', 'SIG_FC_BACK', 'SIG_FB', 'SIG_QUIZ_Q', 'SIG_QUIZ_OPT', 'SIG_QUIZ_EXP',
            'SIG_TAB_LABEL', 'SIG_TAB_CONTENT', 'SIG_TL_TITLE', 'SIG_TL_DESC', 'SIG_COL_ONE', 'SIG_COL_TWO',
            'SIG_MATH', 'SIG_MERMAID',
        ];
        const lost = signatures.filter((s) => !searchable.includes(s));
        expect(degraded, 'healthy doc must NOT be flagged degraded').toBe(false);
        expect(lost, `blocks lost content on round-trip: ${lost.join(', ')}`).toEqual([]);
    });
});

describe('DOC slide: a throwing block is detected as degraded (data-loss guard)', () => {
    it('drops the throwing block but flags degraded so auto-save can refuse it', () => {
        const editor = makeEditor();
        // A callout with an unsupported theme makes the built-in serializer throw
        // (bt[theme].color). It stands in for ANY block whose serializer throws
        // (legacy-corrupt custom block, Slate mid-edit state, etc.).
        editor.setEditorValue({
            p0: blk(0, 'Paragraph', 'paragraph', 'SIG_KEEP_BEFORE'),
            bad: { id: 'bad', type: 'Callout', meta: { order: 1, depth: 0 }, value: [{ id: 'ebad', type: 'callout', children: [{ text: 'SIG_WILL_DROP' }], props: { theme: 'no-such-theme' } }] },
            p1: blk(2, 'Paragraph', 'paragraph', 'SIG_KEEP_AFTER'),
        } as any);

        const { out, degraded } = appSaveSerialize(editor);

        // The neighbours survive (per-block fallback keeps them)...
        expect(out).toMatch(/SIG_KEEP_BEFORE/);
        expect(out).toMatch(/SIG_KEEP_AFTER/);
        // ...but the throwing block's content is gone from the serialized output...
        expect(out).not.toMatch(/SIG_WILL_DROP/);
        // ...and THIS is the signal the fix relies on: the save is flagged
        // degraded, so autoPublishDocSlide refuses to persist it on slide switch.
        expect(degraded, 'a dropped block must flag the serialize as degraded').toBe(true);
    });

    it('a fully-healthy doc is never flagged degraded', () => {
        const editor = makeEditor();
        editor.setEditorValue({ p: blk(0, 'Paragraph', 'paragraph', 'all good') } as any);
        expect(appSaveSerialize(editor).degraded).toBe(false);
    });
});

describe('DOC slide: signed S3 images survive and get de-signed (truncation regression)', () => {
    it('quiz with INNER signed images — content kept, signature stripped, end-to-end', () => {
        const editor = makeEditor();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const value: Record<string, any> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const add = (b: any) => (value[b.id] = b);
        add(blk(0, 'Paragraph', 'paragraph', 'SIG_BEFORE'));
        add(
            custom(1, 'quizBlock', {
                quizData: {
                    question:
                        'SIG_Q <img src="https://vac.s3.amazonaws.com/q.png?X-Amz-Signature=DEADBEEF&X-Amz-Expires=86400" />',
                    type: 'mcq',
                    explanation: '',
                    options: [
                        {
                            id: 'o1',
                            text: 'SIG_OPT_IMG <img src="https://vac.s3.amazonaws.com/o.png?X-Amz-Signature=CAFEBABE" />',
                            isCorrect: true,
                        },
                        { id: 'o2', text: 'SIG_OPT_PLAIN', isCorrect: false },
                    ],
                },
            })
        );
        add(blk(2, 'Paragraph', 'paragraph', 'SIG_AFTER'));
        editor.setEditorValue(value as any);

        const stored = formatHTMLString(html.serialize(editor, value as any));
        const reloaded = makeEditor();
        reloaded.setEditorValue(html.deserialize(reloaded, appReloadPreprocess(stored)));
        const { out, degraded } = appSaveSerialize(reloaded);
        const searchable = out + decodeDataAttrs(out);

        for (const s of ['SIG_BEFORE', 'SIG_Q', 'SIG_OPT_IMG', 'SIG_OPT_PLAIN', 'SIG_AFTER']) {
            expect(searchable, `lost "${s}" on round-trip`).toContain(s);
        }
        expect(searchable, 'inner image q.png kept').toContain('q.png');
        expect(searchable, 'inner image o.png kept').toContain('o.png');
        expect(searchable, 'expiring signature must be stripped so the image cannot 404').not.toContain(
            'X-Amz-Signature'
        );
        expect(degraded).toBe(false);
    });

    it('legacy entity-encoded data-* holding a signed URL is NOT truncated by the save sanitizer', () => {
        // The ORIGINAL bug: a signed S3 URL inside a legacy (pre-base64) data-*
        // block. The old whole-doc sanitizer ate across the encoded JSON quotes
        // and deleted everything from the '?' — taking SIG_INSIDE (and often the
        // rest of the slide) with it. The fixed sanitizer only touches real
        // src/href/poster attributes, so the data-* payload is left byte-intact.
        const storedRaw =
            '<div data-quiz="{&quot;u&quot;:&quot;https://vac.s3.amazonaws.com/x.png?sig=ABC&quot;,&quot;keep&quot;:&quot;SIG_INSIDE&quot;}">Q</div>' +
            '<p>SIG_OUTSIDE</p>';
        const afterSave = formatHTMLString(storedRaw);
        expect(afterSave, 'save must not truncate the encoded payload').toContain('SIG_INSIDE');
        expect(afterSave, 'neighbour content survives').toContain('SIG_OUTSIDE');
        // The old code would have deleted "sig=ABC…" from inside the data-*; the
        // fix leaves the payload completely untouched.
        expect(afterSave, 'data-* payload left untouched').toContain('sig=ABC');
    });

    it('a top-level signed image between blocks keeps neighbours and is de-signed', () => {
        const storedRaw =
            '<h1>SIG_TOP</h1>' +
            '<div><img src="https://vac.s3.amazonaws.com/hero.png?X-Amz-Signature=ZZZ&X-Amz-Expires=1" alt="" /></div>' +
            '<p>SIG_MIDDLE</p><p>SIG_END</p>';
        const afterReload = appReloadPreprocess(formatHTMLString(storedRaw));
        for (const s of ['SIG_TOP', 'SIG_MIDDLE', 'SIG_END']) {
            expect(afterReload, `lost "${s}"`).toContain(s);
        }
        expect(afterReload, 'image kept').toContain('hero.png');
        expect(afterReload, 'signature stripped').not.toContain('X-Amz-Signature');
    });

    // Runs the two content-touching sanitizers that fire on save + reload — the
    // exact path a stored slide flows through when reopened.
    const saveThenReload = (storedInnerHtml: string): string =>
        appReloadPreprocess(formatHTMLString(storedInnerHtml));

    it('DEEP DIVE — image INSIDE an accordion: heading, body & image all survive, de-signed', () => {
        const s = saveThenReload(
            '<p>SIG_A_BEFORE</p>' +
                '<div><details><summary>SIG_ACC_HEADING</summary><div>' +
                '<p>SIG_ACC_BODY</p>' +
                '<img src="https://vac.s3.amazonaws.com/acc.png?X-Amz-Signature=BBB&X-Amz-Expires=86400" alt="" />' +
                '</div></details></div>' +
                '<p>SIG_A_AFTER</p>'
        );
        for (const sig of ['SIG_A_BEFORE', 'SIG_ACC_HEADING', 'SIG_ACC_BODY', 'SIG_A_AFTER']) {
            expect(s, `accordion lost "${sig}"`).toContain(sig);
        }
        expect(s, 'accordion image kept').toContain('acc.png');
        expect(s, 'accordion image de-signed').not.toContain('X-Amz-Signature');
    });

    it('DEEP DIVE — image INSIDE a table cell: cells & image survive, de-signed, table not truncated', () => {
        const s = saveThenReload(
            '<table data-header-row="true"><colgroup><col style="width: 200px" /><col style="width: 200px" /></colgroup>' +
                '<tbody>' +
                '<tr><th>SIG_TH_A</th><th>SIG_TH_B</th></tr>' +
                '<tr><td>SIG_TD_TEXT</td>' +
                '<td><img src="https://vac.s3.amazonaws.com/cell.png?X-Amz-Signature=CCC" alt="" /></td></tr>' +
                '</tbody></table>'
        );
        for (const sig of ['SIG_TH_A', 'SIG_TH_B', 'SIG_TD_TEXT']) {
            expect(s, `table lost "${sig}"`).toContain(sig);
        }
        expect(s, 'table-cell image kept').toContain('cell.png');
        expect(s, 'table-cell image de-signed').not.toContain('X-Amz-Signature');
    });

    it('DEEP DIVE — one slide with image + quiz(inner img) + accordion(inner img): nothing lost, all de-signed', () => {
        // Real quiz block carrying an inner signed image (exercises encodeBlockData)...
        const editor = makeEditor();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const value: Record<string, any> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const add = (b: any) => (value[b.id] = b);
        add(blk(0, 'HeadingOne', 'heading-one', 'SIG_FULL_TITLE'));
        add(
            custom(1, 'quizBlock', {
                quizData: {
                    question:
                        'SIG_FQ <img src="https://vac.s3.amazonaws.com/fq.png?X-Amz-Signature=DDD" />',
                    type: 'mcq',
                    explanation: '',
                    options: [{ id: 'o1', text: 'SIG_FOPT', isCorrect: true }],
                },
            })
        );
        add(blk(2, 'Paragraph', 'paragraph', 'SIG_FULL_END'));
        editor.setEditorValue(value as any);

        // ...plus a doc image + an accordion image authored alongside it.
        let stored = formatHTMLString(html.serialize(editor, value as any));
        stored = stored.replace(
            '\n        </div>\n    </body>',
            '<div><img data-meta-align="center" src="https://vac.s3.amazonaws.com/fdoc.png?X-Amz-Signature=EEE" /></div>' +
                '<div><details><summary>SIG_FACC_HEAD</summary><div>' +
                '<img src="https://vac.s3.amazonaws.com/facc.png?X-Amz-Signature=FFF" /></div></details></div>' +
                '\n        </div>\n    </body>'
        );

        const searchable = saveThenReload(stored) + decodeDataAttrs(saveThenReload(stored));
        for (const sig of ['SIG_FULL_TITLE', 'SIG_FQ', 'SIG_FOPT', 'SIG_FULL_END', 'SIG_FACC_HEAD']) {
            expect(searchable, `combined slide lost "${sig}"`).toContain(sig);
        }
        for (const img of ['fq.png', 'fdoc.png', 'facc.png']) {
            expect(searchable, `combined slide lost image "${img}"`).toContain(img);
        }
        expect(searchable, 'every image de-signed').not.toContain('X-Amz-Signature');
    });
});
