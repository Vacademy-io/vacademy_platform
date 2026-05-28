import { useEffect, useMemo, useRef, useState } from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
// Phosphor icons only (design-system governance — banned-icon-library rule).
// `as`-aliases keep call-site names unchanged from the previous lucide
// imports, so the JSX below reads identically.
import {
    BookOpenText as BookText,
    Copy,
    DownloadSimple as Download,
    FileText,
    Translate as Languages,
    CircleNotch as Loader2,
    Sparkle as Sparkles,
    MagicWand as Wand2,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
// `remark-gfm` adds GitHub-Flavored Markdown support to react-markdown:
// tables, strikethrough, task lists, autolinks. Without it, our LLM-emitted
// `| col | col |` tables show up as literal pipe-delimited text instead of
// rendering as actual HTML tables.
import remarkGfm from 'remark-gfm';
import { formatDistanceToNow } from 'date-fns';
import { GENERATE_TRANSCRIPT_NOTES_URL } from '@/constants/urls';
import { saveStudyNotes } from '../-services/utils';

/**
 * Single entrypoint dialog opened from the "Show Transcript" button on a
 * recording row. The teacher picks one of two actions:
 *
 *   1. Create Assessment  — closes this dialog and lets the parent open
 *      `CreateAssessmentFromRecordingModal` (the parent passes
 *      `onCreateAssessment` for this).
 *   2. Generate Lecture Notes — calls ai-service in-place and renders
 *      the resulting markdown.
 *
 * We deliberately do NOT surface every action available on the transcript
 * (raw source / English / markdown tabs, copy buttons, download buttons,
 * etc.) — those overcrowded the previous viewer. Power users can still
 * copy/download the generated notes once produced.
 */

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Recording identifiers — required to POST generated notes back to
     * admin-core for caching. */
    scheduleId: string;
    recordingId: string;
    sourceTextUrl?: string | null;
    englishTextUrl?: string | null;
    detectedLanguage?: string;
    recordingTitle?: string;
    /** Previously-generated notes loaded from the transcription status DTO.
     * When present, the dialog skips the action picker and shows the cached
     * notes immediately on open, with a "Regenerate" affordance. */
    savedNotesMarkdown?: string;
    savedNotesGeneratedAt?: string;
    /** Lift saved-notes state up to the parent so a regen here is reflected
     * everywhere the parent uses the same recording row. Called after a
     * successful save with the new markdown + ISO timestamp. */
    onSavedNotesChange?: (markdown: string, generatedAt: string) => void;
    /** Fires when the teacher clicks the Create Assessment card. */
    onCreateAssessment: () => void;
}

type LoadState = 'idle' | 'loading' | 'loaded' | 'error';

interface TextState {
    state: LoadState;
    text: string;
    error?: string;
}

const LANGUAGE_NAMES: Record<string, string> = {
    en: 'English',
    hi: 'Hindi',
    bn: 'Bengali',
    ta: 'Tamil',
    te: 'Telugu',
    mr: 'Marathi',
    gu: 'Gujarati',
    kn: 'Kannada',
    ml: 'Malayalam',
    pa: 'Punjabi',
    ur: 'Urdu',
};

const langName = (code?: string) =>
    code ? LANGUAGE_NAMES[code.toLowerCase()] ?? code.toUpperCase() : 'Source';

/**
 * Break a long Whisper transcript into readable paragraphs by sentence
 * boundaries. Whisper output is one long blob — chunking by 4 sentences
 * mirrors how a teacher would naturally paragraph a lecture.
 *
 * Trades off perfection (some run-ons, some short ends) for readability —
 * a "good enough" formatter is much better than a wall of text, and the
 * cost of a smarter approach (LLM call, semantic chunking) isn't worth
 * it for a viewer the user reads, not edits.
 */
const formatTranscript = (text: string): string[] => {
    if (!text) return [];
    const cleaned = text.replace(/\s+/g, ' ').trim();
    // `।` is Devanagari danda — Hindi sentence terminator.
    const sentences = cleaned.match(/[^.!?।]+[.!?।]+\s*/g) ?? [cleaned];
    const paragraphs: string[] = [];
    let buf: string[] = [];
    for (const s of sentences) {
        buf.push(s.trim());
        if (buf.length >= 4) {
            paragraphs.push(buf.join(' '));
            buf = [];
        }
    }
    if (buf.length) paragraphs.push(buf.join(' '));
    return paragraphs;
};

const wordCount = (text: string): number =>
    text.trim() ? text.trim().split(/\s+/).length : 0;

const downloadBlob = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};

/**
 * Render a DOM node into a multi-page A4 PDF and trigger the download.
 *
 * Approach: html2canvas captures the rendered notes block to a single tall
 * canvas, then we slice that canvas across A4 pages and add each slice as
 * an image to a jsPDF document. This preserves every visual style the
 * react-markdown render applied (prose-img rounding, headings, blockquotes,
 * code blocks) without having to re-implement them as PDF primitives.
 *
 * CORS note: Serper-returned image URLs are random host domains. We pass
 * `useCORS: true` so html2canvas requests the image with `crossOrigin`. If
 * the host doesn't send CORS headers, the image is dropped from the canvas
 * (the rest of the notes still render fine). Re-hosting images on our S3
 * is the right long-term fix; not blocking the v1 ship for it.
 */
const renderNodeToPdf = async (node: HTMLElement, filename: string) => {
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas'),
    ]);

    const canvas = await html2canvas(node, {
        scale: 2, // 2× for crisp output on retina; standard practice for PDF capture
        useCORS: true,
        backgroundColor: 'white',
        logging: false,
    });

    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 32; // points — comfortable reading margin
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;

    // Scale the captured canvas width down to the page's usable width;
    // the page count is determined by how many vertical slices fit.
    const renderWidthPx = canvas.width;
    const renderHeightPx = canvas.height;
    const pxPerPt = renderWidthPx / usableWidth;
    const pageSliceHeightPx = Math.floor(usableHeight * pxPerPt);

    let yOffsetPx = 0;
    let pageNumber = 0;
    while (yOffsetPx < renderHeightPx) {
        // Build a per-page canvas via a temporary 2d context.
        const sliceHeightPx = Math.min(pageSliceHeightPx, renderHeightPx - yOffsetPx);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = renderWidthPx;
        sliceCanvas.height = sliceHeightPx;
        const ctx = sliceCanvas.getContext('2d');
        if (!ctx) throw new Error('Could not create slice canvas context');
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, renderWidthPx, sliceHeightPx);
        ctx.drawImage(
            canvas,
            0, yOffsetPx, renderWidthPx, sliceHeightPx,
            0, 0, renderWidthPx, sliceHeightPx,
        );

        if (pageNumber > 0) pdf.addPage();
        const sliceHeightPt = sliceHeightPx / pxPerPt;
        pdf.addImage(
            sliceCanvas.toDataURL('image/jpeg', 0.92),
            'JPEG',
            margin,
            margin,
            usableWidth,
            sliceHeightPt,
        );

        yOffsetPx += sliceHeightPx;
        pageNumber += 1;
    }

    pdf.save(filename);
};

/**
 * Image component used inside the rendered notes. Hides itself on load
 * failure so the user doesn't see the raw alt text (e.g. "osmosis diagram")
 * sitting where an image was supposed to be — a common failure when Serper
 * returns URLs from hosts that block hot-linking or don't send CORS
 * headers (which html2canvas needs for the PDF capture).
 *
 * crossOrigin="anonymous" lets the browser load the image AND lets the
 * PDF capture pull it into the canvas without tainting. Loading lazy keeps
 * the dialog snappy when several images are embedded.
 */
function NotesImage({ alt, src, ...rest }: React.ImgHTMLAttributes<HTMLImageElement>) {
    const [errored, setErrored] = useState(false);
    if (errored || !src) return null;
    return (
        <img
            alt={alt ?? ''}
            src={src}
            crossOrigin="anonymous"
            loading="lazy"
            onError={() => setErrored(true)}
            // `max-h-96` caps vertical size; `max-w-full` + `h-auto` keeps
            // wide diagrams from overflowing the print container. Without
            // max-w-full the image renders at its natural width, the dialog
            // visually clips it, but html2canvas captures the overflow —
            // producing a stretched/cut-off image in the downloaded PDF.
            className="mx-auto my-6 block h-auto max-h-96 max-w-full rounded-xl border border-neutral-200 object-contain shadow-md"
            {...rest}
        />
    );
}

/**
 * Per-element renderers for the study-notes view. We previously relied on
 * Tailwind's `prose-*` utilities (@tailwindcss/typography plugin) but the
 * plugin isn't installed in this project, so every `prose-h1:…` /
 * `prose-li:…` class was a silent no-op and the rendered notes came out as
 * a wall of same-sized text. Defining the styles per element here makes
 * the styling work regardless of Tailwind config, and gives us tighter
 * control over the look (custom bullet markers, blockquote callouts,
 * underlined section headers, etc.) than what @tailwindcss/typography
 * defaults provide.
 *
 * `as Components` cast is required because react-markdown's `Components`
 * type is a bivariant mapped type that doesn't accept specifically-typed
 * arrow functions without coercion.
 */
const NOTES_MARKDOWN_COMPONENTS = {
    img: NotesImage,
    // Document title — large, bold, primary-coloured underline strip
    h1: ({ children }) => (
        <h1 className="mb-5 mt-0 border-b-2 border-primary-500 pb-2 text-3xl font-bold tracking-tight text-neutral-900">
            {children}
        </h1>
    ),
    // Section header — left bar + light tint, like a sidebar callout
    h2: ({ children }) => (
        <h2 className="mb-3 mt-7 rounded-r-md border-l-4 border-primary-500 bg-primary-50/50 px-3 py-1.5 text-2xl font-bold tracking-tight text-neutral-900">
            {children}
        </h2>
    ),
    // Sub-section — distinct, slightly smaller, with primary-coloured text
    h3: ({ children }) => (
        <h3 className="mb-2 mt-5 text-lg font-bold text-primary-700">{children}</h3>
    ),
    // Body paragraphs
    p: ({ children }) => (
        <p className="my-3 leading-relaxed text-neutral-800">{children}</p>
    ),
    // Custom bullet: small primary-coloured dot. Cleaner than the default
    // browser disc, especially when the body text uses the same neutral palette.
    ul: ({ children }) => (
        <ul className="my-3 list-none space-y-1.5 pl-0">{children}</ul>
    ),
    li: ({ children }) => (
        <li className="flex gap-3 leading-relaxed text-neutral-800">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary-500" />
            <span className="flex-1">{children}</span>
        </li>
    ),
    // Ordered lists stay numbered (no marker override) but get the same
    // spacing rhythm as the unordered version.
    ol: ({ children }) => (
        <ol className="my-3 list-decimal space-y-1.5 pl-6 marker:font-semibold marker:text-primary-600">
            {children}
        </ol>
    ),
    // Inline emphasis
    strong: ({ children }) => (
        <strong className="font-bold text-neutral-900">{children}</strong>
    ),
    em: ({ children }) => <em className="italic text-neutral-700">{children}</em>,
    // "Key takeaway" callout — distinctly styled card so the eye lands on it
    blockquote: ({ children }) => (
        <blockquote className="my-5 rounded-r-lg border-l-4 border-l-primary-500 bg-primary-50 px-5 py-3 text-neutral-900 [&>p]:my-0 [&>p]:font-medium">
            {children}
        </blockquote>
    ),
    // Inline code
    code: ({ children }) => (
        <code className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-sm text-primary-700">
            {children}
        </code>
    ),
    // Code blocks
    pre: ({ children }) => (
        <pre className="my-4 overflow-x-auto rounded-lg border border-neutral-200 bg-neutral-900 p-4 text-sm text-neutral-100">
            {children}
        </pre>
    ),
    // Tables — used by the LLM for comparison sections (hyper vs hypo, etc.)
    table: ({ children }) => (
        <div className="my-5 overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full border-collapse text-sm">{children}</table>
        </div>
    ),
    thead: ({ children }) => <thead className="bg-primary-50">{children}</thead>,
    th: ({ children }) => (
        <th className="border-b border-neutral-200 px-3 py-2 text-left font-semibold text-neutral-900">
            {children}
        </th>
    ),
    td: ({ children }) => (
        <td className="border-b border-neutral-100 px-3 py-2 align-top text-neutral-800">
            {children}
        </td>
    ),
    // Links
    a: ({ children, href }) => (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-primary-600 underline-offset-2 hover:underline"
        >
            {children}
        </a>
    ),
    // Horizontal rule (section breaks if the LLM emits them)
    hr: () => <hr className="my-6 border-neutral-200" />,
} as Components;

const copyToClipboard = async (text: string, label: string) => {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(`${label} copied`);
    } catch {
        toast.error('Could not access clipboard');
    }
};

export function TranscriptActionsDialog({
    open,
    onOpenChange,
    scheduleId,
    recordingId,
    sourceTextUrl,
    englishTextUrl,
    detectedLanguage,
    recordingTitle = 'transcript',
    savedNotesMarkdown,
    savedNotesGeneratedAt,
    onSavedNotesChange,
    onCreateAssessment,
}: Props) {
    const [source, setSource] = useState<TextState>({ state: 'idle', text: '' });
    const [english, setEnglish] = useState<TextState>({ state: 'idle', text: '' });
    // Hydrate notes from the server-side cache so reopening the dialog shows
    // them immediately without an LLM call. If no cached notes, start idle —
    // the action picker will render and the user can click "Generate".
    const [notes, setNotes] = useState<{
        state: LoadState;
        markdown: string;
        error?: string;
    }>(() =>
        savedNotesMarkdown
            ? { state: 'loaded', markdown: savedNotesMarkdown }
            : { state: 'idle', markdown: '' },
    );
    // Local mirror of the generated-at timestamp so the "Generated X ago"
    // label updates instantly after a regen (without waiting for the parent
    // to re-fetch the transcription status).
    const [notesGeneratedAt, setNotesGeneratedAt] = useState<string | undefined>(
        savedNotesGeneratedAt,
    );
    // Which transcript view the user is currently reading. Defaults to
    // English when a translation is available (most users find the
    // English version easier to scan); falls back to the source when the
    // recording is already in English or the translation is missing.
    const [view, setView] = useState<'source' | 'english'>('english');
    // Ref to the rendered notes container — captured by html2canvas for
    // the PDF download. Living on the prose node (not the ScrollArea
    // wrapper) means the capture excludes scrollbars and matches what
    // the user actually sees.
    const notesPrintRef = useRef<HTMLDivElement | null>(null);
    const [downloadingPdf, setDownloadingPdf] = useState(false);

    useEffect(() => {
        if (!open) {
            // On close: reset to whatever the server has cached. This means:
            //  - Notes that were just generated (and saved) stay visible on
            //    reopen (because the parent passed them in via prop).
            //  - A regen-then-error doesn't strand the user on a stale view.
            // We deliberately don't blank the markdown unconditionally —
            // doing so would force a wasteful re-show of the action picker
            // every time the user closes/reopens the dialog.
            if (savedNotesMarkdown) {
                setNotes({ state: 'loaded', markdown: savedNotesMarkdown });
                setNotesGeneratedAt(savedNotesGeneratedAt);
            } else {
                setNotes({ state: 'idle', markdown: '' });
                setNotesGeneratedAt(undefined);
            }
            return;
        }
        const loadText = async (
            url: string | null | undefined,
            set: (s: TextState) => void,
        ) => {
            if (!url) {
                set({ state: 'idle', text: '' });
                return;
            }
            set({ state: 'loading', text: '' });
            try {
                const resp = await fetch(url);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const text = await resp.text();
                set({ state: 'loaded', text });
            } catch (e) {
                set({
                    state: 'error',
                    text: '',
                    error: e instanceof Error ? e.message : 'Failed to load',
                });
            }
        };
        loadText(sourceTextUrl, setSource);
        loadText(englishTextUrl, setEnglish);
    }, [open, sourceTextUrl, englishTextUrl]);

    const fileBase = recordingTitle.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);
    const transcriptReady = source.state === 'loaded' || english.state === 'loaded';
    const isEnglishSource = detectedLanguage?.toLowerCase() === 'en';

    // ── Reader-view derived state ──────────────────────────────────
    // Whether the source and English texts are different documents (when
    // the source IS English the worker reuses the same blob, so there's
    // no point offering a toggle). The toggle also requires both to have
    // actually loaded — otherwise we'd flash an empty pane.
    const hasLanguageToggle =
        !isEnglishSource && source.state === 'loaded' && english.state === 'loaded';

    // What the reader actually renders. When source is already English
    // there's only one document — we still label it "English". When the
    // source is non-English, the toggle picks; otherwise we fall back to
    // whichever blob actually loaded so the viewer never goes blank.
    const showingEnglish = isEnglishSource || (hasLanguageToggle && view === 'english');
    const activeText = showingEnglish && english.text
        ? english.text
        : source.text || english.text;
    const activeLanguageLabel = showingEnglish ? 'English' : langName(detectedLanguage);

    const activeParagraphs = useMemo(() => formatTranscript(activeText), [activeText]);
    const activeWordCount = useMemo(() => wordCount(activeText), [activeText]);

    const handleGenerateNotes = async () => {
        const transcriptForLlm = english.text || source.text;
        if (!transcriptForLlm || transcriptForLlm.trim().length < 20) {
            toast.error('Transcript is empty or too short to generate notes');
            return;
        }
        setNotes({ state: 'loading', markdown: '' });
        try {
            const resp = await fetch(GENERATE_TRANSCRIPT_NOTES_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript_text: transcriptForLlm,
                    title_hint: recordingTitle,
                    target_language:
                        english.text || isEnglishSource
                            ? 'en'
                            : (detectedLanguage ?? 'en').toLowerCase(),
                }),
            });
            if (!resp.ok) {
                const body = await resp.json().catch(() => null);
                const msg =
                    (body && (body.detail || body.message)) || `HTTP ${resp.status}`;
                throw new Error(msg);
            }
            const data = (await resp.json()) as { markdown: string };
            if (!data.markdown || !data.markdown.trim()) {
                throw new Error('ai-service returned empty notes');
            }
            setNotes({ state: 'loaded', markdown: data.markdown });
            // Persist so the next dialog open shows the cached version
            // without re-running the LLM. Failure here is non-fatal —
            // the user already has the notes on screen; we just log and
            // show a soft warning, no need to roll back the UI.
            try {
                const saved = await saveStudyNotes(scheduleId, recordingId, data.markdown);
                const generatedAt =
                    saved.savedNotesGeneratedAt ?? new Date().toISOString();
                setNotesGeneratedAt(generatedAt);
                onSavedNotesChange?.(data.markdown, generatedAt);
            } catch (saveErr) {
                console.warn('[study-notes] save failed (non-fatal):', saveErr);
                toast.warning('Notes generated, but caching failed — regenerate to retry.');
            }
            toast.success('Lecture notes generated');
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to generate notes';
            setNotes({ state: 'error', markdown: '', error: msg });
            toast.error(msg);
        }
    };

    return (
        <MyDialog
            open={open}
            onOpenChange={onOpenChange}
            heading="Transcript"
            dialogWidth="max-w-3xl"
        >
            {/* MyDialog already caps the body to a sensible viewport
                fraction and handles scroll on its inner wrapper, so we
                don't need to duplicate either constraint here. */}
            <div className="flex flex-col gap-4 p-5">
                {/* Status pill */}
                <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        <Sparkles className="size-3" />
                        Transcript ready
                    </span>
                    {detectedLanguage && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600">
                            <Languages className="size-3" />
                            {langName(detectedLanguage)}
                        </span>
                    )}
                    {transcriptReady && activeWordCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600">
                            {activeWordCount.toLocaleString()} words
                        </span>
                    )}
                </div>

                {/* Transcript reader — paragraph view of the actual lecture text.
                    Hidden while AI study notes are being generated/viewed so the
                    user focuses on one thing at a time, matching the existing
                    notes flow. */}
                {transcriptReady && notes.state === 'idle' && (
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            {hasLanguageToggle ? (
                                <div className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-neutral-50 p-0.5">
                                    <button
                                        type="button"
                                        onClick={() => setView('source')}
                                        className={
                                            view === 'source'
                                                ? 'rounded-sm bg-white px-2.5 py-1 text-xs font-semibold text-neutral-800 shadow-sm'
                                                : 'rounded-sm px-2.5 py-1 text-xs font-medium text-neutral-500 hover:text-neutral-700'
                                        }
                                    >
                                        {langName(detectedLanguage)}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setView('english')}
                                        className={
                                            view === 'english'
                                                ? 'rounded-sm bg-white px-2.5 py-1 text-xs font-semibold text-neutral-800 shadow-sm'
                                                : 'rounded-sm px-2.5 py-1 text-xs font-medium text-neutral-500 hover:text-neutral-700'
                                        }
                                    >
                                        English
                                    </button>
                                </div>
                            ) : (
                                <div className="text-xs font-medium text-neutral-500">
                                    {activeLanguageLabel} transcript
                                </div>
                            )}
                            <div className="flex items-center gap-1.5">
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={() =>
                                        copyToClipboard(
                                            activeText,
                                            `${activeLanguageLabel} transcript`,
                                        )
                                    }
                                >
                                    <Copy className="mr-1.5 size-3.5" />
                                    Copy
                                </MyButton>
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={() =>
                                        downloadBlob(
                                            `${fileBase}.${showingEnglish ? 'en' : detectedLanguage ?? 'src'}.txt`,
                                            activeText,
                                            'text/plain',
                                        )
                                    }
                                >
                                    <Download className="mr-1.5 size-3.5" />
                                    .txt
                                </MyButton>
                            </div>
                        </div>
                        {/* Plain div with overflow-y-auto + max-h works
                            reliably for variable-length content. Radix
                            ScrollArea needs an explicit height (not
                            max-height) on its root for its internal
                            viewport to enable scrolling, which would
                            waste space for shorter transcripts. */}
                        <div className="max-h-72 overflow-y-auto rounded-lg border border-neutral-200 bg-white">
                            <div className="space-y-3 px-5 py-4 text-sm leading-7 text-neutral-800">
                                {activeParagraphs.length > 0 ? (
                                    activeParagraphs.map((p, i) => (
                                        <p key={i}>{p}</p>
                                    ))
                                ) : (
                                    <p className="text-neutral-500">
                                        Transcript is empty for this recording.
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Action picker — visible until notes are generated */}
                {notes.state === 'idle' && (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <ActionCard
                            icon={<FileText className="size-5" />}
                            title="Create Assessment"
                            description="Auto-generate an MCQ assessment from this lecture and publish it to your batches."
                            cta="Create Assessment"
                            onClick={onCreateAssessment}
                            tone="primary"
                            disabled={!transcriptReady}
                        />
                        <ActionCard
                            icon={<BookText className="size-5" />}
                            title="Generate Lecture Notes"
                            description="Turn this transcript into clean, structured study notes you can share with learners."
                            cta="Generate Notes"
                            onClick={handleGenerateNotes}
                            tone="violet"
                            disabled={!transcriptReady}
                        />
                    </div>
                )}

                {/* Loading state */}
                {notes.state === 'loading' && (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                        <Loader2 className="size-6 animate-spin text-primary-500" />
                        <div className="text-sm font-medium text-neutral-800">
                            Generating lecture notes…
                        </div>
                        <div className="text-xs text-neutral-500">
                            Usually takes 5–15 seconds.
                        </div>
                    </div>
                )}

                {/* Error state */}
                {notes.state === 'error' && (
                    <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                        <Alert variant="destructive" className="max-w-md text-left">
                            <AlertDescription>
                                {notes.error ?? 'Could not generate notes.'}
                            </AlertDescription>
                        </Alert>
                        <div className="flex items-center gap-2">
                            <MyButton
                                type="button"
                                buttonType="secondary"
                                scale="small"
                                onClick={() => setNotes({ state: 'idle', markdown: '' })}
                            >
                                Back
                            </MyButton>
                            <MyButton
                                type="button"
                                scale="small"
                                onClick={handleGenerateNotes}
                            >
                                <Wand2 className="mr-1.5 size-3.5" />
                                Retry
                            </MyButton>
                        </div>
                    </div>
                )}

                {/* Loaded notes — concise toolbar + rendered markdown only.
                    Deliberately no language/word-count chrome — the user only
                    cares about the actual content here. */}
                {notes.state === 'loaded' && (
                    <div className="flex min-h-0 flex-1 flex-col gap-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setNotes({ state: 'idle', markdown: '' })}
                                    className="text-xs font-medium text-primary-600 hover:underline"
                                >
                                    ← Back to actions
                                </button>
                                {notesGeneratedAt && (
                                    <span
                                        className="text-xs text-neutral-500"
                                        title={new Date(notesGeneratedAt).toLocaleString()}
                                    >
                                        Generated{' '}
                                        {formatDistanceToNow(new Date(notesGeneratedAt), {
                                            addSuffix: true,
                                        })}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5">
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={() =>
                                        copyToClipboard(notes.markdown, 'Lecture notes')
                                    }
                                >
                                    <Copy className="mr-1.5 size-3.5" />
                                    Copy
                                </MyButton>
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="small"
                                    disabled={downloadingPdf}
                                    onClick={async () => {
                                        const node = notesPrintRef.current;
                                        if (!node) return;
                                        setDownloadingPdf(true);
                                        try {
                                            await renderNodeToPdf(
                                                node,
                                                `${fileBase}.notes.pdf`,
                                            );
                                            toast.success('PDF downloaded');
                                        } catch (e) {
                                            const msg =
                                                e instanceof Error
                                                    ? e.message
                                                    : 'Could not generate PDF';
                                            toast.error(msg);
                                        } finally {
                                            setDownloadingPdf(false);
                                        }
                                    }}
                                >
                                    <Download className="mr-1.5 size-3.5" />
                                    {downloadingPdf ? 'Preparing…' : 'Download PDF'}
                                </MyButton>
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={handleGenerateNotes}
                                >
                                    <Wand2 className="mr-1.5 size-3.5" />
                                    Regenerate
                                </MyButton>
                            </div>
                        </div>
                        <ScrollArea className="min-h-0 flex-1 rounded-lg border border-neutral-200 bg-white">
                            {/* Every element gets its style from
                                NOTES_MARKDOWN_COMPONENTS above (not prose-*
                                utilities, since @tailwindcss/typography isn't
                                installed in this project). We capture this
                                node for the PDF export, so the PDF mirrors
                                exactly what the user sees on screen.
                                `overflow-hidden` keeps wide content (mostly
                                naturally-wide diagrams) from being rendered
                                outside the container — without this,
                                html2canvas would still capture the overflow
                                and the PDF would crop/stretch the image. */}
                            <div
                                ref={notesPrintRef}
                                className="overflow-hidden bg-white px-8 py-6 text-base"
                            >
                                <ReactMarkdown
                                    components={NOTES_MARKDOWN_COMPONENTS}
                                    remarkPlugins={[remarkGfm]}
                                >
                                    {notes.markdown}
                                </ReactMarkdown>
                            </div>
                        </ScrollArea>
                    </div>
                )}

                {/* Loading indicator while transcript is being fetched. Only
                    shown if we don't already have either copy and aren't in
                    the middle of generating notes. */}
                {!transcriptReady && notes.state === 'idle' && (
                    <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                        Loading transcript…
                    </div>
                )}
            </div>
        </MyDialog>
    );
}

/**
 * Single CTA card with icon + tinted background. Two tones supported —
 * primary (blue) for the create-assessment path, violet for notes — so the
 * two actions read as visually distinct without being garish.
 */
function ActionCard({
    icon,
    title,
    description,
    cta,
    onClick,
    tone,
    disabled,
}: {
    icon: React.ReactNode;
    title: string;
    description: string;
    cta: string;
    onClick: () => void;
    tone: 'primary' | 'violet';
    disabled?: boolean;
}) {
    const toneStyles =
        tone === 'primary'
            ? {
                  ring: 'hover:border-primary-300 hover:bg-primary-50/40',
                  iconBg: 'bg-primary-50 text-primary-600',
                  // Match MyButton's primary variant: hover goes to the
                  // lighter primary-400, not darker primary-600. Going
                  // darker on this orange palette reads as a different
                  // (brown-ish) colour and feels off-brand.
                  cta: 'bg-primary-500 hover:bg-primary-400 active:bg-primary-400',
              }
            : {
                  ring: 'hover:border-violet-300 hover:bg-violet-50/40',
                  iconBg: 'bg-violet-50 text-violet-600',
                  cta: 'bg-violet-500 hover:bg-violet-400 active:bg-violet-400',
              };
    return (
        <div
            className={`flex flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition-colors ${toneStyles.ring}`}
        >
            <div
                className={`flex size-10 items-center justify-center rounded-lg ${toneStyles.iconBg}`}
            >
                {icon}
            </div>
            <div>
                <div className="text-sm font-semibold text-neutral-800">{title}</div>
                <div className="mt-0.5 text-xs leading-relaxed text-neutral-500">
                    {description}
                </div>
            </div>
            <button
                type="button"
                disabled={disabled}
                onClick={onClick}
                className={`mt-auto inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${toneStyles.cta}`}
            >
                {cta}
            </button>
        </div>
    );
}
