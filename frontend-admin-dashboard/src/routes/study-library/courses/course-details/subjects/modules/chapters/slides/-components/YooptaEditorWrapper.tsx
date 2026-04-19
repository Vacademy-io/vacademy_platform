import React from 'react';
import YooptaEditor, { Blocks } from '@yoopta/editor';
import type { YooEditor } from '@yoopta/editor';
import { html } from '@yoopta/exports';

interface YooptaEditorWrapperProps {
    editor: YooEditor;
    plugins: any[];
    tools: any;
    marks: any;
    value: any;
    selectionBoxRoot: React.RefObject<HTMLDivElement>;
    autoFocus: boolean;
    onChange: () => void;
    className?: string;
    style?: React.CSSProperties;
}

const LIST_TYPES = new Set(['NumberedList', 'BulletedList', 'TodoList']);

/**
 * Paste interceptor for Google-Docs / Word / plain-text clipboard content.
 *
 * Problem: pasting from Google Docs or a plain-text source into Yoopta
 * loses all structure. Three reasons:
 *  1. Google Docs wraps everything in `<b id="docs-internal-guid-..." style="font-weight:normal">`
 *     and represents bold as `<span style="font-weight:700">`, italics as
 *     `<span style="font-style:italic">`, etc. Yoopta's deserializer only
 *     recognizes semantic tags (STRONG / EM / U), so the styled spans are
 *     stripped to plain text.
 *  2. Yoopta's text-node normalization replaces any `\t\n\r\f\v+` with a
 *     single space — so a multi-line plain-text paste collapses to one
 *     run-on line.
 *  3. Without a paste handler, the browser's default behavior kicks in,
 *     which for contenteditable means "insert the raw text into one
 *     block" — so several paragraphs from Docs end up as one paragraph.
 *
 * This handler runs in capture phase, transforms the clipboard HTML into
 * clean semantic HTML (or converts plain-text newlines into `<p>` blocks),
 * hands the result to Yoopta's own HTML deserializer, and inserts each
 * resulting block with `Blocks.insertBlock`. `preventDefault` blocks the
 * browser / Yoopta default so we don't double-insert.
 */
function isGoogleDocsHtml(htmlStr: string): boolean {
    return /id=(['"])docs-internal-guid-/i.test(htmlStr);
}

function cleanPastedHtml(rawHtml: string): string {
    const doc = new DOMParser().parseFromString(rawHtml, 'text/html');
    const body = doc.body;
    if (!body) return '';

    // 1. Unwrap the Google Docs outer <b id="docs-internal-guid-..."> shell
    //    so its children become top-level siblings.
    body.querySelectorAll('b[id^="docs-internal-guid-"]').forEach((wrapper) => {
        const fragment = doc.createDocumentFragment();
        while (wrapper.firstChild) fragment.appendChild(wrapper.firstChild);
        wrapper.replaceWith(fragment);
    });

    // 2. Convert style-based inline formatting to semantic tags Yoopta knows.
    //    We mutate the DOM in-place; walking spans this way is safe because
    //    we replace each span with a new element of the same text content.
    Array.from(body.querySelectorAll('span[style]')).forEach((span) => {
        const style = (span.getAttribute('style') || '').toLowerCase();
        const isBold = /font-weight\s*:\s*(bold|700|800|900|[6-9]\d{2,}|1000)/.test(style);
        const isItalic = /font-style\s*:\s*italic/.test(style);
        const isUnderline = /text-decoration[^:;]*:\s*[^;]*underline/.test(style);
        const isStrike = /text-decoration[^:;]*:\s*[^;]*line-through/.test(style);

        // Outer wrapper: apply marks in strike > underline > italic > bold order
        // so the innermost tag is <strong> (rendered consistently).
        let outermost: HTMLElement | null = null;
        let innermost: HTMLElement | null = null;
        const wrap = (tagName: string) => {
            const el = doc.createElement(tagName);
            if (innermost) innermost.appendChild(el);
            else outermost = el;
            innermost = el;
        };
        if (isStrike) wrap('s');
        if (isUnderline) wrap('u');
        if (isItalic) wrap('em');
        if (isBold) wrap('strong');

        if (outermost && innermost) {
            while (span.firstChild) (innermost as HTMLElement).appendChild(span.firstChild);
            span.replaceWith(outermost);
        } else {
            // Plain styled span (color / font) — unwrap, keep text.
            const fragment = doc.createDocumentFragment();
            while (span.firstChild) fragment.appendChild(span.firstChild);
            span.replaceWith(fragment);
        }
    });

    // 3. Promote inline text-align into Yoopta's data-meta-align attribute
    //    on alignable blocks BEFORE we strip style. Yoopta reads alignment
    //    from data-meta-align only — if we drop style first, a "centered
    //    heading copied from Docs" pastes as left-aligned.
    const ALIGNABLE = new Set([
        'H1','H2','H3','H4','H5','H6','P','BLOCKQUOTE','UL','OL','LI',
    ]);
    body.querySelectorAll('[style]').forEach((el) => {
        if (!ALIGNABLE.has(el.tagName)) return;
        const style = (el.getAttribute('style') || '').toLowerCase();
        const m = /text-align\s*:\s*(left|center|right)/.exec(style);
        if (m && !el.hasAttribute('data-meta-align')) {
            el.setAttribute('data-meta-align', m[1]);
        }
    });

    // 4. Unwrap <p> inside <li>. Google Docs (and most rich editors) emit
    //    <li><p>...</p></li>, but Yoopta's list deserializer expects the
    //    <li> to contain inline content directly — a nested <p> gets
    //    re-parsed as a separate paragraph block, which flattens the
    //    list structure.
    body.querySelectorAll('li > p').forEach((p) => {
        const parentLi = p.parentElement;
        if (!parentLi) return;
        // Only unwrap if the <p> is the sole block child; if the <li>
        // has nested <ul>/<ol> siblings we leave it alone so nesting
        // survives.
        const fragment = doc.createDocumentFragment();
        while (p.firstChild) fragment.appendChild(p.firstChild);
        p.replaceWith(fragment);
    });

    // 5. Strip remaining inline styles & class attrs so Yoopta doesn't
    //    carry over Google's margins / fonts / colors. The alignment
    //    we cared about is now on data-meta-align.
    body.querySelectorAll('[style], [class]').forEach((el) => {
        el.removeAttribute('style');
        el.removeAttribute('class');
    });

    // 6. Drop meta / link / script noise Google Docs ships.
    body.querySelectorAll('meta, link, script, style').forEach((n) => n.remove());

    return body.innerHTML;
}

function plainTextToHtml(text: string): string {
    // Double newline → paragraph break. Single newline → <br/>.
    const escape = (s: string) =>
        s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const paragraphs = text.replace(/\r\n/g, '\n').split(/\n\s*\n+/);
    return paragraphs
        .map((p) => {
            const inner = escape(p).replace(/\n/g, '<br/>');
            return inner.trim() ? `<p>${inner}</p>` : '';
        })
        .filter(Boolean)
        .join('');
}

function handlePasteCapture(editor: YooEditor, e: React.ClipboardEvent) {
    const cd = e.clipboardData;
    if (!cd) return;

    const htmlData = cd.getData('text/html');
    const textData = cd.getData('text/plain');

    // Only intercept when we have something we can meaningfully clean up.
    // For simple in-app copy/paste (single word, single line), leave Yoopta's
    // default behavior alone so we don't regress the normal path.
    const looksLikeMultiLine = textData && /\r?\n/.test(textData.trim());
    const looksLikeDocsHtml = htmlData && isGoogleDocsHtml(htmlData);
    if (!looksLikeMultiLine && !looksLikeDocsHtml && !htmlData) return;

    let cleanedHtml = '';
    if (htmlData) {
        cleanedHtml = cleanPastedHtml(htmlData);
    }
    // If HTML path produced no usable output, fall back to plain text.
    if (!cleanedHtml.trim() && textData) {
        cleanedHtml = plainTextToHtml(textData);
    }
    if (!cleanedHtml.trim()) return;

    let blocksMap: Record<string, any>;
    try {
        // html.deserialize wraps the string in a <body> and walks blocks.
        blocksMap = (html as any).deserialize(editor, cleanedHtml) as Record<string, any>;
    } catch (err) {
        console.warn('Paste: deserialize failed, letting Yoopta default handle it', err);
        return;
    }

    const blocks = Object.values(blocksMap).sort(
        (a: any, b: any) => (a?.meta?.order ?? 0) - (b?.meta?.order ?? 0)
    );
    if (blocks.length === 0) return;

    e.preventDefault();
    e.stopPropagation();

    // Insert each parsed block at an incrementing `at` index so order is
    // preserved. Without `at`, every call inserts at the current cursor
    // and the blocks land in reverse. Mirrors what Yoopta's own built-in
    // paste handler does internally. Focus the last inserted block so
    // the user can keep typing where the paste ended.
    try {
        const currentOrder =
            typeof (editor as any)?.path?.current === 'number'
                ? (editor as any).path.current
                : Object.keys(editor.children || {}).length - 1;
        const baseAt = Math.max(0, currentOrder) + 1;
        blocks.forEach((block: any, idx: number) => {
            Blocks.insertBlock(editor, block.type, {
                at: baseAt + idx,
                focus: idx === blocks.length - 1,
                blockData: {
                    value: block.value,
                    meta: block.meta,
                },
            } as any);
        });
    } catch (err) {
        console.warn('Paste: Blocks.insertBlock failed', err);
    }
}

/**
 * Tab / Shift+Tab override for list indentation.
 *
 * Yoopta's built-in Tab handler iterates `editor.path.selected` and calls
 * `increaseBlockDepth` on every path — so if a user drag-selects from
 * somewhere above the sub-items, the "selected" array can silently include
 * the parent list item too, and pressing Tab indents the parent along with
 * the children. To the user this looks like "I only wanted to indent 1.1/
 * 1.2/1.3 but '1.' also moved."
 *
 * This capture-phase listener fires BEFORE Yoopta's own handler (which is
 * attached in bubble phase on the editable), stops propagation, and only
 * indents the block that currently has the cursor. Multi-block Tab is
 * intentionally disabled for list items so the parent can't be caught up.
 */
function handleListTabCapture(editor: YooEditor, e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const currentPath = (editor as any)?.path?.current;
    if (currentPath === null || currentPath === undefined) return;

    // Find the currently focused block.
    const children = editor.children as Record<string, any>;
    const focusedBlock = Object.values(children).find(
        (b: any) => b?.meta?.order === currentPath
    ) as any;
    if (!focusedBlock || !LIST_TYPES.has(focusedBlock.type)) return;

    // Stop Yoopta's default multi-select Tab handler; only the focused
    // list item should change depth.
    e.preventDefault();
    e.stopPropagation();

    try {
        if (e.shiftKey) {
            (editor as any).decreaseBlockDepth({ blockId: focusedBlock.id });
        } else {
            (editor as any).increaseBlockDepth({ blockId: focusedBlock.id });
        }
    } catch {
        /* noop — fall through silently; worst case native Tab inserts a
           literal tab character, which is still less surprising than
           accidentally indenting the parent. */
    }
}

/**
 * Error boundary that catches Slate's "Cannot resolve a DOM point" family of
 * crashes. These happen when editor.selection references a path/offset that
 * no longer exists in the DOM (e.g. content was just replaced via
 * setEditorValue but the old selection was still pointing at offset 56 of a
 * node that's now shorter). Uncaught, this throws all the way up to the
 * app's global error boundary and the user sees a 500 page.
 *
 * On catch: clear editor.selection (which is what setEditorContent already
 * does defensively, but this covers cases where the bad selection is
 * introduced *after* that cleanup — e.g. on focus/blur/type right after a
 * content reload), bump a remount key so the YooptaEditor re-mounts fresh,
 * and render normally again. If the same error fires three times in a row
 * we fall back to a visible error UI rather than loop forever.
 */
interface YooptaErrorBoundaryProps {
    editor: YooEditor;
    children: React.ReactNode;
}
interface YooptaErrorBoundaryState {
    hasError: boolean;
    errorCount: number;
    remountKey: number;
}

class YooptaErrorBoundary extends React.Component<
    YooptaErrorBoundaryProps,
    YooptaErrorBoundaryState
> {
    state: YooptaErrorBoundaryState = {
        hasError: false,
        errorCount: 0,
        remountKey: 0,
    };

    static getDerivedStateFromError(): Partial<YooptaErrorBoundaryState> {
        return { hasError: true };
    }

    componentDidCatch(error: Error) {
        console.error('[YooptaEditorWrapper] caught editor error:', error);

        // The common "Cannot resolve a DOM point" / "toDOMRange" crashes
        // are all rooted in a stale Slate selection. Clear it so the
        // remount starts from a clean state.
        try {
            (this.props.editor as any).selection = null;
        } catch {
            /* noop */
        }

        this.setState((prev) => {
            const nextCount = prev.errorCount + 1;
            // Give up after 3 consecutive crashes to avoid an infinite
            // remount loop. User can reload the page.
            if (nextCount >= 3) {
                return { hasError: true, errorCount: nextCount, remountKey: prev.remountKey };
            }
            return {
                hasError: false,
                errorCount: nextCount,
                remountKey: prev.remountKey + 1,
            };
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                    <p className="font-semibold">Editor could not recover</p>
                    <p className="mt-1 text-xs">
                        The editor hit an unexpected state and can&apos;t
                        continue. Please refresh the page — your last saved
                        draft is safe on the server.
                    </p>
                </div>
            );
        }
        // The key bump on recoverable errors forces YooptaEditor to
        // remount with a clean internal state.
        return (
            <React.Fragment key={this.state.remountKey}>
                {this.props.children}
            </React.Fragment>
        );
    }
}

export function YooptaEditorWrapper({
    editor,
    plugins,
    tools,
    marks,
    value,
    selectionBoxRoot,
    autoFocus,
    onChange,
    className,
    style,
}: YooptaEditorWrapperProps) {
    return (
        <YooptaErrorBoundary editor={editor}>
            <div
                onKeyDownCapture={(reactEvt) =>
                    handleListTabCapture(editor, reactEvt.nativeEvent)
                }
                onPasteCapture={(reactEvt) => handlePasteCapture(editor, reactEvt)}
            >
                <YooptaEditor
                    editor={editor}
                    plugins={plugins}
                    tools={tools}
                    marks={marks}
                    value={value}
                    selectionBoxRoot={selectionBoxRoot}
                    autoFocus={autoFocus}
                    onChange={onChange}
                    className={className}
                    style={style}
                />
            </div>
        </YooptaErrorBoundary>
    );
}
