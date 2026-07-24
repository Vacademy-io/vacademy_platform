import { useEffect, useRef, useState } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import mermaid from 'mermaid';
import { toast } from 'sonner';
import { MyButton } from '@/components/design-system/button';
import { MyInput } from '@/components/design-system/input';
import { UploadFileInS3, getPublicUrl } from '@/services/upload_file';
import { getTokenFromCookie, getTokenDecodedData } from '@/lib/auth/sessionUtility';
import { TokenKey } from '@/constants/auth/tokens';
import { cn } from '@/lib/utils';
import {
    MusicNotes,
    FilePdf,
    UploadSimple,
    ListNumbers,
    Function as FunctionIcon,
} from '@phosphor-icons/react';
import type {
    MathPayload,
    MermaidPayload,
    AudioPayload,
    PdfPayload,
    FillBlanksPayload,
    JupyterPayload,
    ScratchPayload,
} from '../nodes/simple-attr-nodes';

/** Editing UIs for the "plain-attribute" custom blocks. Kept intentionally
 *  thin: each edits the node payload via setPayload; all persistence goes
 *  through the node's exportDOM (see simple-attr-nodes.tsx). */

interface BlockEditorProps<T> {
    payload: T;
    setPayload: (next: T) => void;
    readOnly: boolean;
}

function BlockShell({
    title,
    icon,
    children,
}: {
    title: string;
    icon?: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <div className="my-2 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-caption font-semibold text-neutral-600">
                {icon}
                {title}
            </div>
            {children}
        </div>
    );
}

async function uploadToS3(file: File): Promise<string | null> {
    try {
        const accessToken = getTokenFromCookie(TokenKey.accessToken);
        const data = getTokenDecodedData(accessToken);
        const instituteId = (data && Object.keys(data.authorities)[0]) || '';
        const userId = data?.sub || 'unknown-user';
        const fileId = await UploadFileInS3(file, () => {}, userId, instituteId, 'STUDENTS', true);
        if (!fileId) return null;
        return (await getPublicUrl(fileId)) || null;
    } catch (e) {
        console.error('[Lexical] upload failed:', e);
        return null;
    }
}

// ---------- Math (KaTeX) ----------
export function MathBlockEditor({ payload, setPayload, readOnly }: BlockEditorProps<MathPayload>) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(payload.latex);
    const previewRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!previewRef.current) return;
        try {
            katex.render(
                editing ? draft : payload.latex || '\\text{Click to add LaTeX}',
                previewRef.current,
                {
                    displayMode: payload.displayMode,
                    throwOnError: false,
                }
            );
        } catch {
            /* katex renders errors inline with throwOnError:false */
        }
    }, [payload.latex, payload.displayMode, draft, editing]);

    return (
        <BlockShell title="Math (LaTeX)" icon={<FunctionIcon size={14} />}>
            <div
                ref={previewRef}
                className={cn('min-h-8 py-1', payload.displayMode ? 'text-center' : 'text-left')}
                onClick={() => !readOnly && setEditing(true)}
            />
            {editing && !readOnly && (
                <div className="mt-2 flex flex-col gap-2">
                    <textarea
                        className="w-full rounded-md border border-neutral-300 p-2 font-mono text-caption"
                        rows={3}
                        value={draft}
                        autoFocus
                        onChange={(e) => setDraft(e.target.value)}
                    />
                    <div className="flex items-center gap-2">
                        <MyButton
                            buttonType="primary"
                            scale="small"
                            onClick={() => {
                                setPayload({ ...payload, latex: draft });
                                setEditing(false);
                            }}
                        >
                            Save
                        </MyButton>
                        <MyButton
                            buttonType="secondary"
                            scale="small"
                            onClick={() => {
                                setDraft(payload.latex);
                                setEditing(false);
                            }}
                        >
                            Cancel
                        </MyButton>
                        <label className="ml-2 flex items-center gap-1 text-caption text-neutral-600">
                            <input
                                type="checkbox"
                                checked={payload.displayMode}
                                onChange={(e) =>
                                    setPayload({ ...payload, displayMode: e.target.checked })
                                }
                            />
                            Display mode (centered)
                        </label>
                    </div>
                </div>
            )}
        </BlockShell>
    );
}

// ---------- Mermaid ----------
let mermaidInitialized = false;
export function MermaidBlockEditor({
    payload,
    setPayload,
    readOnly,
}: BlockEditorProps<MermaidPayload>) {
    const [editing, setEditing] = useState(!payload.code);
    const [draft, setDraft] = useState(payload.code);
    const [svg, setSvg] = useState<string>('');
    const idRef = useRef(`lex-mermaid-${Math.random().toString(36).slice(2, 10)}`);

    useEffect(() => {
        if (!payload.code) {
            setSvg('');
            return;
        }
        if (!mermaidInitialized) {
            mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
            mermaidInitialized = true;
        }
        let cancelled = false;
        mermaid
            .render(idRef.current, payload.code)
            .then((r) => {
                if (!cancelled) setSvg(r.svg);
            })
            .catch((e) => {
                if (!cancelled)
                    setSvg(`<pre class="text-caption text-danger-600">${String(e)}</pre>`);
            });
        return () => {
            cancelled = true;
        };
    }, [payload.code]);

    return (
        <BlockShell title="Mermaid diagram">
            {svg && (
                <div
                    className="overflow-x-auto"
                    onClick={() => !readOnly && setEditing(true)}
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: svg }}
                />
            )}
            {editing && !readOnly && (
                <div className="mt-2 flex flex-col gap-2">
                    <textarea
                        className="w-full rounded-md border border-neutral-300 p-2 font-mono text-caption"
                        rows={5}
                        placeholder={'graph TD\n  A --> B'}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <MyButton
                            buttonType="primary"
                            scale="small"
                            onClick={() => {
                                setPayload({ code: draft });
                                setEditing(false);
                            }}
                        >
                            Render
                        </MyButton>
                        {payload.code && (
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={() => {
                                    setDraft(payload.code);
                                    setEditing(false);
                                }}
                            >
                                Cancel
                            </MyButton>
                        )}
                    </div>
                </div>
            )}
        </BlockShell>
    );
}

// ---------- Audio ----------
export function AudioBlockEditor({
    payload,
    setPayload,
    readOnly,
}: BlockEditorProps<AudioPayload>) {
    const [uploading, setUploading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <BlockShell title="Audio" icon={<MusicNotes size={14} />}>
            {payload.title && (
                <div className="mb-2 text-subtitle font-semibold text-neutral-700">
                    {payload.title}
                </div>
            )}
            {payload.audioUrl ? (
                <audio controls src={payload.audioUrl} className="w-full" preload="metadata" />
            ) : (
                <div className="py-2 text-center text-caption text-neutral-400">
                    No audio uploaded
                </div>
            )}
            {!readOnly && (
                <div className="mt-2 flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploading(true);
                            const url = await uploadToS3(file);
                            setUploading(false);
                            if (url) {
                                setPayload({
                                    ...payload,
                                    audioUrl: url,
                                    title: payload.title || file.name,
                                });
                            } else {
                                toast.error('Audio upload failed');
                            }
                        }}
                    />
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        disable={uploading}
                        onClick={() => inputRef.current?.click()}
                    >
                        <UploadSimple size={14} className="mr-1" />
                        {uploading
                            ? 'Uploading…'
                            : payload.audioUrl
                              ? 'Replace audio'
                              : 'Upload audio'}
                    </MyButton>
                    <MyInput
                        inputType="text"
                        inputPlaceholder="Title (optional)"
                        input={payload.title}
                        onChangeFunction={(e) => setPayload({ ...payload, title: e.target.value })}
                        size="small"
                    />
                </div>
            )}
        </BlockShell>
    );
}

// ---------- PDF ----------
export function PdfBlockEditor({ payload, setPayload, readOnly }: BlockEditorProps<PdfPayload>) {
    const [uploading, setUploading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <BlockShell title="PDF" icon={<FilePdf size={14} />}>
            {payload.title && (
                <div className="mb-2 text-subtitle font-semibold text-neutral-700">
                    {payload.title}
                </div>
            )}
            {payload.pdfUrl ? (
                <a
                    href={payload.pdfUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-caption text-primary-500 underline"
                >
                    Open PDF in new tab
                </a>
            ) : (
                <div className="py-2 text-center text-caption text-neutral-400">
                    No PDF uploaded
                </div>
            )}
            {!readOnly && (
                <div className="mt-2 flex items-center gap-2">
                    <input
                        ref={inputRef}
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            setUploading(true);
                            const url = await uploadToS3(file);
                            setUploading(false);
                            if (url) {
                                setPayload({
                                    ...payload,
                                    pdfUrl: url,
                                    title: payload.title || file.name,
                                });
                            } else {
                                toast.error('PDF upload failed');
                            }
                        }}
                    />
                    <MyButton
                        buttonType="secondary"
                        scale="small"
                        disable={uploading}
                        onClick={() => inputRef.current?.click()}
                    >
                        <UploadSimple size={14} className="mr-1" />
                        {uploading ? 'Uploading…' : payload.pdfUrl ? 'Replace PDF' : 'Upload PDF'}
                    </MyButton>
                    <MyInput
                        inputType="text"
                        inputPlaceholder="Title (optional)"
                        input={payload.title}
                        onChangeFunction={(e) => setPayload({ ...payload, title: e.target.value })}
                        size="small"
                    />
                </div>
            )}
        </BlockShell>
    );
}

// ---------- Fill in the blanks ----------
export function FillBlanksBlockEditor({
    payload,
    setPayload,
    readOnly,
}: BlockEditorProps<FillBlanksPayload>) {
    const [editing, setEditing] = useState(!payload.sentence);
    const [draft, setDraft] = useState(payload.sentence);

    const preview = payload.sentence.split(/(\{blank:[^}]+\})/g).map((part, i) => {
        const m = part.match(/^\{blank:([^}]+)\}$/);
        if (m) {
            return (
                <span
                    key={i}
                    className="mx-1 inline-block min-w-16 border-b-2 border-primary-400 px-2 text-center text-primary-600"
                >
                    {m[1]}
                </span>
            );
        }
        return <span key={i}>{part}</span>;
    });

    return (
        <BlockShell title="Fill in the Blanks" icon={<ListNumbers size={14} />}>
            <div className="leading-8" onClick={() => !readOnly && setEditing(true)}>
                {payload.sentence ? (
                    preview
                ) : (
                    <span className="text-caption text-neutral-400">
                        Click to add a sentence — mark answers as {'{blank:answer}'}
                    </span>
                )}
            </div>
            {editing && !readOnly && (
                <div className="mt-2 flex flex-col gap-2">
                    <textarea
                        className="w-full rounded-md border border-neutral-300 p-2 text-body"
                        rows={3}
                        placeholder="Water boils at {blank:100} degrees Celsius."
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                    />
                    <div className="flex gap-2">
                        <MyButton
                            buttonType="primary"
                            scale="small"
                            onClick={() => {
                                setPayload({ sentence: draft });
                                setEditing(false);
                            }}
                        >
                            Save
                        </MyButton>
                        <MyButton
                            buttonType="secondary"
                            scale="small"
                            onClick={() => {
                                setDraft(payload.sentence);
                                setEditing(false);
                            }}
                        >
                            Cancel
                        </MyButton>
                    </div>
                </div>
            )}
        </BlockShell>
    );
}

// ---------- Jupyter notebook ----------
export function JupyterBlockEditor({
    payload,
    setPayload,
    readOnly,
}: BlockEditorProps<JupyterPayload>) {
    const configured = payload.projectName && payload.contentUrl;
    const binderUrl = configured
        ? `https://mybinder.org/v2/gh/${payload.contentUrl.replace('https://github.com/', '')}/${payload.contentBranch}?labpath=${payload.notebookLocation}`
        : '';

    return (
        <BlockShell
            title={`Jupyter Notebook${payload.projectName ? `: ${payload.projectName}` : ''}`}
        >
            {!readOnly && (
                <div className="mb-3 grid grid-cols-2 gap-2">
                    <MyInput
                        inputType="text"
                        inputPlaceholder="Project name"
                        input={payload.projectName}
                        onChangeFunction={(e) =>
                            setPayload({ ...payload, projectName: e.target.value })
                        }
                        size="small"
                    />
                    <MyInput
                        inputType="text"
                        inputPlaceholder="GitHub repository URL"
                        input={payload.contentUrl}
                        onChangeFunction={(e) =>
                            setPayload({ ...payload, contentUrl: e.target.value })
                        }
                        size="small"
                    />
                    <MyInput
                        inputType="text"
                        inputPlaceholder="Branch (main)"
                        input={payload.contentBranch}
                        onChangeFunction={(e) =>
                            setPayload({ ...payload, contentBranch: e.target.value || 'main' })
                        }
                        size="small"
                    />
                    <MyInput
                        inputType="text"
                        inputPlaceholder="Notebook location (root)"
                        input={payload.notebookLocation}
                        onChangeFunction={(e) =>
                            setPayload({ ...payload, notebookLocation: e.target.value || 'root' })
                        }
                        size="small"
                    />
                </div>
            )}
            {configured ? (
                <>
                    {!readOnly && (
                        <div className="mb-2">
                            <MyButton
                                buttonType="secondary"
                                scale="small"
                                onClick={() =>
                                    setPayload({
                                        ...payload,
                                        activeTab:
                                            payload.activeTab === 'preview'
                                                ? 'settings'
                                                : 'preview',
                                    })
                                }
                            >
                                {payload.activeTab === 'preview' ? 'Hide preview' : 'Show preview'}
                            </MyButton>
                        </div>
                    )}
                    {payload.activeTab === 'preview' && (
                        <iframe
                            src={binderUrl}
                            className="h-96 w-full rounded-md border border-neutral-200"
                            title="Jupyter Notebook Preview"
                        />
                    )}
                </>
            ) : (
                <div className="text-caption text-neutral-500">
                    No notebook configured — project name and GitHub URL needed.
                </div>
            )}
        </BlockShell>
    );
}

// ---------- Scratch project ----------
export function ScratchBlockEditor({
    payload,
    setPayload,
    readOnly,
}: BlockEditorProps<ScratchPayload>) {
    return (
        <BlockShell title="Scratch Project">
            {!readOnly && (
                <div className="mb-2 flex items-center gap-2">
                    <MyInput
                        inputType="text"
                        inputPlaceholder="Scratch project ID"
                        input={payload.scratchId}
                        onChangeFunction={(e) =>
                            setPayload({ ...payload, scratchId: e.target.value.trim() })
                        }
                        size="small"
                    />
                    {payload.scratchId && (
                        <MyButton
                            buttonType="secondary"
                            scale="small"
                            onClick={() =>
                                setPayload({
                                    ...payload,
                                    activeTab:
                                        payload.activeTab === 'preview' ? 'settings' : 'preview',
                                })
                            }
                        >
                            {payload.activeTab === 'preview' ? 'Hide preview' : 'Show preview'}
                        </MyButton>
                    )}
                </div>
            )}
            {payload.scratchId ? (
                payload.activeTab === 'preview' && (
                    <iframe
                        src={`https://scratch.mit.edu/projects/${payload.scratchId}/embed`}
                        className="h-96 w-full rounded-md border border-neutral-200 bg-white"
                        title="Scratch Project"
                        allowFullScreen
                    />
                )
            ) : (
                <div className="text-caption text-neutral-500">
                    No Scratch project configured — project ID needed.
                </div>
            )}
        </BlockShell>
    );
}

// ---------- Table of contents ----------
export function TocBlockEditor() {
    return (
        <BlockShell title="Table of Contents">
            <div className="text-caption text-neutral-500">
                Outline is auto-generated from document headings for learners.
            </div>
        </BlockShell>
    );
}
