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
import { formatHTMLString, stripAwsQueryParamsFromUrls } from '../formatHtmlString';
import { appReloadPreprocess, detectDeserializeLoss, countSerializedBlocks } from './reload';

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

    it('EDGE — accordion survives repeated save/reload WITHOUT padding accumulation', () => {
        const editor = makeEditor();
        const v = {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            a: custom(0, 'accordion', {
                items: [
                    { heading: 'SIG_AH1', content: '<p>SIG_ACC1</p>' },
                    { heading: 'SIG_AH2', content: '<p>SIG_ACC2</p>' },
                ],
            }),
        };
        editor.setEditorValue(v as any);
        let stored = formatHTMLString(html.serialize(editor, v as any));
        // 4 open→save cycles — the accumulation bug grew a wrapper each time
        for (let k = 0; k < 4; k++) {
            const r = makeEditor();
            r.setEditorValue(html.deserialize(r, appReloadPreprocess(stored)));
            stored = formatHTMLString(html.serialize(r, r.getEditorValue()));
        }
        const pads = (stored.match(/padding: 4px 0/g) || []).length;
        expect(stored, 'accordion content kept').toContain('SIG_ACC1');
        expect(stored).toContain('SIG_ACC2');
        expect(stored).toContain('SIG_AH1');
        // 2 items → 2 wrappers max, and it must NOT grow with cycles (was 2→4→6…)
        expect(pads, `padding wrappers must not accumulate (got ${pads})`).toBeLessThanOrEqual(2);
    });

    it('EDGE — non-amazonaws URL with a ?query is left untouched (not stripped, not truncated)', () => {
        const out = appReloadPreprocess(
            formatHTMLString(
                '<p>SIG_BEFORE</p><a href="https://youtube.com/watch?v=abc&t=4">link</a><p>SIG_AFTER</p>'
            )
        );
        expect(out).toContain('SIG_BEFORE');
        expect(out).toContain('SIG_AFTER');
        expect(out, 'non-aws query preserved').toContain('v=abc');
    });

    it('EDGE — content with NO amazonaws URL is byte-identical through the sanitizer (no false unsaved-changes)', () => {
        const input =
            '<h1>Title</h1><p>Body with a <a href="https://example.com/x">link</a> and text.</p>';
        // stripAws is the only content-touching step that could drift a no-image slide
        expect(stripAwsQueryParamsFromUrls(input), 'no-op on non-aws content').toBe(input);
    });

    it('EDGE — many signed images across every container: nothing lost, every one de-signed', () => {
        const editor = makeEditor();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v: Record<string, any> = {};
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const add = (b: any) => (v[b.id] = b);
        add(blk(0, 'Paragraph', 'paragraph', 'SIG_P'));
        add(
            custom(1, 'quizBlock', {
                quizData: {
                    question: 'SIG_Q <img src="https://a.s3.amazonaws.com/1.png?X-Amz-Signature=A" />',
                    type: 'mcq',
                    options: [{ id: 'o', text: 'SIG_O', isCorrect: true }],
                },
            })
        );
        add(
            custom(2, 'tabbedContent', {
                tabs: [
                    {
                        label: 'SIG_TL',
                        content: '<p>SIG_TC <img src="https://a.s3.amazonaws.com/2.png?X-Amz-Signature=B" /></p>',
                    },
                ],
            })
        );
        add(
            custom(3, 'accordion', {
                items: [
                    {
                        heading: 'SIG_AH',
                        content: '<p>SIG_AC <img src="https://a.s3.amazonaws.com/3.png?X-Amz-Signature=C" /></p>',
                    },
                ],
            })
        );
        editor.setEditorValue(v as any);
        const stored = formatHTMLString(html.serialize(editor, v as any));
        const reloaded = makeEditor();
        reloaded.setEditorValue(html.deserialize(reloaded, appReloadPreprocess(stored)));
        const searchable = appSaveSerialize(reloaded).out;
        const all = searchable + decodeDataAttrs(searchable);
        for (const sig of ['SIG_P', 'SIG_Q', 'SIG_O', 'SIG_TL', 'SIG_TC', 'SIG_AH', 'SIG_AC']) {
            expect(all, `lost "${sig}"`).toContain(sig);
        }
        for (const img of ['1.png', '2.png', '3.png']) {
            expect(all, `lost image "${img}"`).toContain(img);
        }
        expect(all, 'every signed URL de-signed').not.toContain('X-Amz-Signature');
    });

    it('EDGE — repeated round-trips are idempotent (signed content stabilises, no drift/leak)', () => {
        const editor = makeEditor();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const v: Record<string, any> = {
            p: blk(0, 'Paragraph', 'paragraph', 'stable'),
            q: custom(1, 'quizBlock', {
                quizData: {
                    question: 'Q <img src="https://a.s3.amazonaws.com/z.png?X-Amz-Signature=S" />',
                    type: 'mcq',
                    options: [{ id: 'o', text: 'O', isCorrect: true }],
                },
            }),
        };
        editor.setEditorValue(v as any);
        const s1 = formatHTMLString(html.serialize(editor, v as any));
        const r1 = makeEditor();
        r1.setEditorValue(html.deserialize(r1, appReloadPreprocess(s1)));
        const s2 = formatHTMLString(html.serialize(r1, r1.getEditorValue()));
        const r2 = makeEditor();
        r2.setEditorValue(html.deserialize(r2, appReloadPreprocess(s2)));
        const s3 = formatHTMLString(html.serialize(r2, r2.getEditorValue()));
        // After the first normalisation, further round-trips must not change anything.
        expect(s3, 'content must be stable across repeated save/reload').toBe(s2);
        expect(s2, 'no signature ever leaks back').not.toContain('X-Amz-Signature');
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

describe('DOC slide: content nested in semantic wrappers survives reload (heading-loss regression)', () => {
    // Yoopta's html.deserialize does NOT recurse into <section>/<header>/nested <div>,
    // so blocks buried inside them were silently dropped on reload. appReloadPreprocess
    // now flattens those wrappers first. See docs/SLIDE_CONTENT_LOSS_INVESTIGATION.md.
    const typeCounts = (value: Record<string, any>) => {
        const counts: Record<string, number> = {};
        Object.values(value || {}).forEach((b: any) => {
            counts[b?.type ?? 'UNKNOWN'] = (counts[b?.type ?? 'UNKNOWN'] || 0) + 1;
        });
        return counts;
    };

    it('keeps every heading/paragraph nested in <section>/<header>/<div>', () => {
        const stored = `<html><head></head><body>
            <header><div><h1>SIG_H1</h1></div></header>
            <section>
                <h2>SIG_H2_A</h2>
                <p>SIG_P_A</p>
                <div><h3>SIG_H3_A</h3><p>SIG_P_NESTED</p></div>
            </section>
            <section>
                <div><div><h2>SIG_H2_DEEP</h2></div></div>
                <h3>SIG_H3_B</h3>
            </section>
        </body></html>`;

        const reloaded = makeEditor();
        const value = html.deserialize(reloaded, appReloadPreprocess(stored));
        const counts = typeCounts(value as any);

        // Source has 1 h1, 2 h2, 2 h3 — all must survive (pre-fix: several dropped).
        expect(counts.HeadingOne ?? 0, 'lost the <h1>').toBe(1);
        expect(counts.HeadingTwo ?? 0, 'lost an <h2> nested in a wrapper').toBe(2);
        expect(counts.HeadingThree ?? 0, 'lost an <h3> nested in a wrapper').toBe(2);

        reloaded.setEditorValue(value);
        const out = formatHTMLString(html.serialize(reloaded, reloaded.getEditorValue()));
        for (const sig of ['SIG_H1', 'SIG_H2_A', 'SIG_P_A', 'SIG_H3_A', 'SIG_P_NESTED', 'SIG_H2_DEEP', 'SIG_H3_B']) {
            expect(out, `content "${sig}" lost through the semantic-wrapper round-trip`).toContain(sig);
        }
    });

    it('does NOT flatten the internals of protected blocks (table/list/custom) inside a section', () => {
        const stored = `<html><head></head><body>
            <section>
                <h2>SIG_BEFORE_TABLE</h2>
                <table><thead><tr><th>SIG_TH</th></tr></thead><tbody><tr><td>SIG_TD</td></tr></tbody></table>
                <ul><li>SIG_LI_ONE</li><li>SIG_LI_TWO</li></ul>
            </section>
        </body></html>`;

        const reloaded = makeEditor();
        const value = html.deserialize(reloaded, appReloadPreprocess(stored));
        const counts = typeCounts(value as any);

        expect(counts.Table ?? 0, 'table dropped or shredded when its section was flattened').toBe(1);
        reloaded.setEditorValue(value);
        const out = formatHTMLString(html.serialize(reloaded, reloaded.getEditorValue()));
        for (const sig of ['SIG_BEFORE_TABLE', 'SIG_TH', 'SIG_TD', 'SIG_LI_ONE', 'SIG_LI_TWO']) {
            expect(out, `protected-block content "${sig}" lost`).toContain(sig);
        }
    });
});

describe('DOC slide: load-integrity detector flags a lossy deserialize (Layer 2)', () => {
    it('flags a dropped table', () => {
        const src = '<h2>x</h2><table><tbody><tr><td>c</td></tr></tbody></table>';
        const value = { a: blk(0, 'HeadingTwo', 'heading-two', 'x') }; // Table missing
        const r = detectDeserializeLoss(src, value as any);
        expect(r.lossy).toBe(true);
        expect(r.lost.join(' ')).toMatch(/table/);
    });

    it('flags a dropped heading', () => {
        const src = '<h2>a</h2><h2>b</h2>';
        const value = { a: blk(0, 'HeadingTwo', 'heading-two', 'a') }; // one h2 missing
        expect(detectDeserializeLoss(src, value as any).lossy).toBe(true);
    });

    it('does NOT flag a clean round-trip', () => {
        const src = '<h2>x</h2>';
        const value = { a: blk(0, 'HeadingTwo', 'heading-two', 'x') };
        expect(detectDeserializeLoss(src, value as any).lossy).toBe(false);
    });

    it('does NOT false-positive on media/headings nested inside a custom block', () => {
        // A quiz block whose serialized markup contains an inner <img> and <h3>.
        const src = '<div data-yoopta-type="quizBlock"><h3>inner</h3><img src="x"/></div>';
        const value = { q: custom(0, 'quizBlock', { quizData: {} }) };
        // The quiz block survived; its inner img/heading are part of it, not lost blocks.
        expect(detectDeserializeLoss(src, value as any).lossy).toBe(false);
    });

    it('flags a dropped custom block', () => {
        const src = '<div data-yoopta-type="flashcard" data-front="a" data-back="b"></div>';
        const value = { p: blk(0, 'Paragraph', 'paragraph', 'nothing') }; // flashcard gone
        const r = detectDeserializeLoss(src, value as any);
        expect(r.lossy).toBe(true);
        expect(r.lost.join(' ')).toMatch(/flashcard/);
    });
});

/**
 * Save-side integrity (the "publish wiped my lesson" incident, 2026-07-17).
 *
 * Prod forensics: a slide's published_data went 47864B -> 3267B, where 3267B was
 * exactly ONE block (the quizBlock the author had been editing). The serializer had
 * dropped every other block; publish had no degraded-guard, so it shipped the
 * fragment, and the server's "this will remove N blocks" confirm read as a false
 * alarm to an author who had only ADDED content. They clicked OK; the lesson was gone.
 *
 * The invariant: the editor VALUE is the source of truth for author intent — a real
 * deletion is already reflected there. So serialize emitting materially fewer blocks
 * than the value holds is ALWAYS a bug, never a deletion.
 */
/**
 * Images inside table cells (prod slide 4f31649f "Lesson 5", 2026-07-17).
 * Yoopta's table cannot hold an image, so html.deserialize drops it on EVERY load —
 * the editor cannot even create this shape (it arrives via AI-generated HTML or a
 * paste). The load gate then refuses to save, which is correct but must be explained
 * honestly: this is permanent, so "reload and try again" would loop the author forever.
 */
describe('detectDeserializeLoss — images inside table cells', () => {
    it('reports images nested in a table cell', () => {
        const src =
            '<table><tbody><tr><td><div><img src="a.jpg"/></div></td><td><img src="b.jpg"/></td></tr></tbody></table>';
        // The table survived as a block; its images did not.
        const value = { t: blk(0, 'Table', 'table', '') };
        const r = detectDeserializeLoss(src, value as any);
        expect(r.imagesInsideTables).toBe(2);
        expect(r.lossy).toBe(true);
        expect(r.lost.join(' ')).toMatch(/image/);
    });

    it('does NOT count standalone images as in-table', () => {
        const src = '<p>x</p><img src="a.jpg"/>';
        const value = { i: blk(0, 'Image', 'image', '') };
        expect(detectDeserializeLoss(src, value as any).imagesInsideTables).toBe(0);
    });

    it('reports zero when detection fails rather than blocking a load', () => {
        const r = detectDeserializeLoss('', {} as any);
        expect(r.imagesInsideTables).toBe(0);
        expect(r.lossy).toBe(false);
    });
});

describe('countSerializedBlocks — save-side block accounting', () => {
    // Mirrors the guard predicate in slide-material.tsx getCurrentEditorHTMLContent().
    const isDegraded = (inBlocks: number, outBlocks: number) =>
        inBlocks >= 3 && outBlocks > 0 && outBlocks < inBlocks * 0.5;

    const wrap = (inner: string) => `<html><head></head><body><div>${inner}</div></body></html>`;

    it('counts each top-level block, seeing through formatHTMLString wrappers', () => {
        const h = wrap('<h2>a</h2><p>b</p><table><tr><td>c</td></tr></table>');
        expect(countSerializedBlocks(h)).toBe(3);
    });

    it('counts a lone custom block as 1 and does not descend into it', () => {
        // The exact shape of the 3267B payload that wiped the live slide.
        const h = wrap('<div data-yoopta-type="quizBlock" data-quiz="eyJ4IjoxfQ=="><p>q</p></div>');
        expect(countSerializedBlocks(h)).toBe(1);
    });

    it('FIRES when serialization collapses a full slide to the focused block', () => {
        // Editor holds 119 blocks; serialize emitted 1. This is the incident.
        expect(isDegraded(119, 1)).toBe(true);
    });

    it('does NOT fire on a healthy serialize', () => {
        expect(isDegraded(119, 119)).toBe(false);
    });

    it('does NOT fire when the author genuinely deletes almost everything', () => {
        // The deletion is reflected in the VALUE, so in and out shrink together.
        expect(isDegraded(1, 1)).toBe(false);
        expect(isDegraded(2, 2)).toBe(false);
    });

    it('does NOT fire on a small slide, where ratios are noisy', () => {
        expect(isDegraded(2, 1)).toBe(false);
    });

    it('stays silent when counting fails rather than blocking a save', () => {
        expect(countSerializedBlocks('')).toBe(0);
        expect(isDegraded(119, 0)).toBe(false); // out=0 disables the comparison
    });
});
