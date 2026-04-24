import { useCallback, useEffect, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';

// Monaco's types live in `monaco-editor` which isn't installed as a direct
// dep — it's lazy-loaded via the loader. We infer what we need from OnMount.
type MonacoEditor = Parameters<OnMount>[0];
type MonacoNs = Parameters<OnMount>[1];

/**
 * Regex matching inline base64 data URIs (image or video) long enough to be
 * worth collapsing. We require ≥200 base64 chars (~150 bytes of payload);
 * tiny inline SVG/PNG icons under that stay readable.
 */
const BASE64_RE = /data:(image|video)\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]{200,}/g;

interface Base64Hit {
    /** 0-based absolute offset in the document text where the data: URI starts. */
    start: number;
    /** 0-based absolute offset just past the last base64 char. */
    end: number;
    /** "image" | "video" — drives whether we offer a hover thumbnail. */
    kind: 'image' | 'video';
    /** Full data URI string — used for hover preview. */
    uri: string;
    /** Byte-size estimate of the payload (base64 is ~33% larger than raw). */
    bytes: number;
}

function scanBase64(text: string): Base64Hit[] {
    const hits: Base64Hit[] = [];
    BASE64_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = BASE64_RE.exec(text)) !== null) {
        const uri = m[0];
        const payloadLen = uri.length - uri.indexOf(',') - 1;
        hits.push({
            start: m.index,
            end: m.index + uri.length,
            kind: m[1] as 'image' | 'video',
            uri,
            bytes: Math.floor((payloadLen * 3) / 4),
        });
    }
    return hits;
}

function formatBytes(n: number): string {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

interface MonacoHtmlEditorProps {
    value: string;
    onChange: (next: string) => void;
    /** Triggered on ⌘/Ctrl + Enter. */
    onApply?: () => void;
}

/**
 * Monaco-based HTML editor with a base64-image UX tuned for the video-shot
 * editor: every inline `data:image/…;base64,…` URI is auto-folded to a single
 * marker line and reveals an image thumbnail on hover. The underlying text is
 * never modified — folding is a pure display transform.
 */
export function MonacoHtmlEditor({ value, onChange, onApply }: MonacoHtmlEditorProps) {
    const editorRef = useRef<MonacoEditor | null>(null);
    const monacoRef = useRef<MonacoNs | null>(null);
    // Hits are recomputed on every content change; refolding happens after.
    const hitsRef = useRef<Base64Hit[]>([]);
    const onApplyRef = useRef(onApply);
    onApplyRef.current = onApply;

    const foldAllBase64 = useCallback(() => {
        const ed = editorRef.current;
        const monaco = monacoRef.current;
        if (!ed || !monaco || hitsRef.current.length === 0) return;
        const model = ed.getModel();
        if (!model) return;
        const selections = hitsRef.current.map((h) => {
            const start = model.getPositionAt(h.start);
            const end = model.getPositionAt(h.end);
            return {
                startLineNumber: start.lineNumber,
                startColumn: start.column,
                endLineNumber: end.lineNumber,
                endColumn: end.column,
            };
        });
        // Monaco's fold action works on the current selections; set them, fold, restore.
        const prev = ed.getSelections();
        ed.setSelections(
            selections.map((r) => ({
                selectionStartLineNumber: r.startLineNumber,
                selectionStartColumn: r.startColumn,
                positionLineNumber: r.endLineNumber,
                positionColumn: r.endColumn,
            }))
        );
        ed.trigger('base64-collapser', 'editor.fold', {});
        if (prev) ed.setSelections(prev);
    }, []);

    const handleMount: OnMount = useCallback(
        (ed, monaco) => {
            editorRef.current = ed;
            monacoRef.current = monaco;

            // Hover: show a thumbnail for image data URIs.
            const hoverDisposable = monaco.languages.registerHoverProvider('html', {
                provideHover: (model, position) => {
                    const offset = model.getOffsetAt(position);
                    const hit = hitsRef.current.find(
                        (h) => offset >= h.start && offset <= h.end
                    );
                    if (!hit) return null;
                    const start = model.getPositionAt(hit.start);
                    const end = model.getPositionAt(hit.end);
                    const label = `**Inline ${hit.kind}** — ${formatBytes(hit.bytes)}`;
                    const contents =
                        hit.kind === 'image'
                            ? [
                                  { value: label },
                                  {
                                      // Monaco renders markdown images directly from data URIs.
                                      value: `![preview](${hit.uri}|width=320)`,
                                  },
                              ]
                            : [{ value: `${label}\n\n_Inline video — expand to view source._` }];
                    return {
                        range: {
                            startLineNumber: start.lineNumber,
                            startColumn: start.column,
                            endLineNumber: end.lineNumber,
                            endColumn: end.column,
                        },
                        contents,
                    };
                },
            });

            // Folding provider: mark each base64 hit as a collapsible region.
            const foldingDisposable = monaco.languages.registerFoldingRangeProvider('html', {
                provideFoldingRanges: (model) => {
                    const ranges: Array<{ start: number; end: number; kind: unknown }> = [];
                    for (const h of hitsRef.current) {
                        const start = model.getPositionAt(h.start);
                        const end = model.getPositionAt(h.end);
                        if (start.lineNumber === end.lineNumber) continue;
                        ranges.push({
                            start: start.lineNumber,
                            end: end.lineNumber,
                            kind: monaco.languages.FoldingRangeKind.Region,
                        });
                    }
                    // Cast at return — the inferred shape matches FoldingRange.
                    return ranges as ReturnType<
                        NonNullable<
                            Parameters<
                                MonacoNs['languages']['registerFoldingRangeProvider']
                            >[1]['provideFoldingRanges']
                        >
                    >;
                },
            });

            // ⌘/Ctrl + Enter → apply
            ed.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
                onApplyRef.current?.();
            });

            // Initial scan + fold once the model is ready.
            const model = ed.getModel();
            if (model) {
                hitsRef.current = scanBase64(model.getValue());
                // Defer: folding must run after the provider has been consulted.
                setTimeout(foldAllBase64, 0);
            }

            ed.onDidDispose(() => {
                hoverDisposable.dispose();
                foldingDisposable.dispose();
            });
        },
        [foldAllBase64]
    );

    // When the incoming `value` prop changes (external update: undo, remake,
    // different entry selected), rescan + refold.
    useEffect(() => {
        const ed = editorRef.current;
        if (!ed) return;
        const model = ed.getModel();
        if (!model) return;
        hitsRef.current = scanBase64(value);
        // Let the folding provider re-run, then collapse.
        setTimeout(foldAllBase64, 0);
    }, [value, foldAllBase64]);

    const handleChange = useCallback(
        (next: string | undefined) => {
            onChange(next ?? '');
        },
        [onChange]
    );

    return (
        <Editor
            height="100%"
            defaultLanguage="html"
            value={value}
            onChange={handleChange}
            onMount={handleMount}
            theme="vs-dark"
            options={{
                minimap: { enabled: false },
                fontSize: 12,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                padding: { top: 8, bottom: 8 },
                tabSize: 2,
                folding: true,
                foldingStrategy: 'auto',
                renderLineHighlight: 'line',
                automaticLayout: true,
            }}
        />
    );
}

/** Exposed for callers that want to report inline-media counts/sizes in UI. */
export function countInlineBase64(html: string): { count: number; totalBytes: number } {
    const hits = scanBase64(html);
    return {
        count: hits.length,
        totalBytes: hits.reduce((sum, h) => sum + h.bytes, 0),
    };
}
