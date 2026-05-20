import { useEffect, useMemo, useState } from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
    BookText,
    Copy,
    Download,
    FileText,
    Languages,
    Loader2,
    Sparkles,
    Wand2,
} from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { GENERATE_TRANSCRIPT_NOTES_URL } from '@/constants/urls';

interface TranscriptViewerModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sourceTextUrl?: string | null;
    englishTextUrl?: string | null;
    detectedLanguage?: string;
    /** Optional — used as the filename prefix for downloads. */
    recordingTitle?: string;
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

/** Break a long transcript into readable paragraphs by sentence boundaries. */
const formatTranscript = (text: string): string[] => {
    if (!text) return [];
    const cleaned = text.replace(/\s+/g, ' ').trim();
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

const buildMarkdown = (
    sourceText: string,
    englishText: string,
    detectedLanguage?: string,
): string => {
    const srcLabel = langName(detectedLanguage);
    const lines: string[] = [];
    lines.push('# Lecture Transcript');
    lines.push('');
    if (detectedLanguage) {
        lines.push(`> Detected language: **${srcLabel}** (\`${detectedLanguage}\`)`);
        lines.push('');
    }
    if (sourceText) {
        lines.push(`## ${srcLabel}`);
        lines.push('');
        formatTranscript(sourceText).forEach((p) => {
            lines.push(p);
            lines.push('');
        });
    }
    if (englishText && detectedLanguage !== 'en') {
        lines.push('## English Translation');
        lines.push('');
        formatTranscript(englishText).forEach((p) => {
            lines.push(p);
            lines.push('');
        });
    }
    return lines.join('\n').trim() + '\n';
};

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

const copyToClipboard = async (text: string, label: string) => {
    try {
        await navigator.clipboard.writeText(text);
        toast.success(`${label} copied to clipboard`);
    } catch {
        toast.error('Could not access clipboard');
    }
};

export function TranscriptViewerModal({
    open,
    onOpenChange,
    sourceTextUrl,
    englishTextUrl,
    detectedLanguage,
    recordingTitle = 'transcript',
}: TranscriptViewerModalProps) {
    const [source, setSource] = useState<TextState>({ state: 'idle', text: '' });
    const [english, setEnglish] = useState<TextState>({ state: 'idle', text: '' });
    // AI-generated markdown study notes derived from the transcript.
    // Cached on the component while the modal is open so users can click
    // around tabs without re-triggering the LLM call.
    const [notes, setNotes] = useState<{
        state: LoadState;
        markdown: string;
        error?: string;
    }>({ state: 'idle', markdown: '' });

    // Fetch both transcripts when the modal opens. Each URL is a public S3
    // file produced by the worker — no auth header needed.
    useEffect(() => {
        if (!open) return;
        const loadText = async (url: string | null | undefined, set: (s: TextState) => void) => {
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

    const srcLabel = langName(detectedLanguage);
    const isEnglishSource = detectedLanguage?.toLowerCase() === 'en';

    const sourceParagraphs = useMemo(() => formatTranscript(source.text), [source.text]);
    const englishParagraphs = useMemo(() => formatTranscript(english.text), [english.text]);

    const markdown = useMemo(
        () => buildMarkdown(source.text, english.text, detectedLanguage),
        [source.text, english.text, detectedLanguage],
    );

    const fileBase = recordingTitle.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60);

    /**
     * Asks the ai-service to turn the loaded transcript into markdown
     * notes. Prefers the English text (which the LLM produces cleaner
     * output from), falling back to the source-language transcript.
     */
    const handleGenerateNotes = async () => {
        const transcriptForLlm = english.text || source.text;
        if (!transcriptForLlm || transcriptForLlm.trim().length < 20) {
            toast.error('Transcript is empty or too short to generate notes from');
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
                    (body && (body.detail || body.message)) ||
                    `HTTP ${resp.status}`;
                throw new Error(msg);
            }
            const data = (await resp.json()) as { markdown: string };
            if (!data.markdown || !data.markdown.trim()) {
                throw new Error('ai-service returned empty notes');
            }
            setNotes({ state: 'loaded', markdown: data.markdown });
            toast.success('Study notes generated');
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Failed to generate notes';
            setNotes({ state: 'error', markdown: '', error: msg });
            toast.error(msg);
        }
    };

    const defaultTab = source.text ? 'source' : english.text ? 'english' : 'source';

    return (
        <MyDialog
            open={open}
            onOpenChange={onOpenChange}
            heading="Lecture Transcript"
            dialogWidth="max-w-4xl"
        >
            <div className="flex max-h-[70vh] flex-col gap-3 p-4">
                {/* Header row: language badges + word counts */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-600">
                    {detectedLanguage && (
                        <Badge variant="secondary" className="gap-1">
                            <Languages className="size-3" />
                            {srcLabel}
                        </Badge>
                    )}
                    {source.state === 'loaded' && (
                        <span>
                            Source: ~{source.text.trim().split(/\s+/).length.toLocaleString()} words
                        </span>
                    )}
                    {english.state === 'loaded' && !isEnglishSource && (
                        <span className="before:mr-2 before:content-['•']">
                            English: ~{english.text.trim().split(/\s+/).length.toLocaleString()} words
                        </span>
                    )}
                </div>

                <Tabs defaultValue={defaultTab} className="flex flex-1 flex-col overflow-hidden">
                    <TabsList className="w-fit">
                        <TabsTrigger value="source">
                            <Languages className="mr-1.5 size-3.5" />
                            {srcLabel}
                        </TabsTrigger>
                        {!isEnglishSource && (
                            <TabsTrigger value="english">
                                <FileText className="mr-1.5 size-3.5" />
                                English
                            </TabsTrigger>
                        )}
                        <TabsTrigger value="markdown">
                            <Sparkles className="mr-1.5 size-3.5" />
                            Markdown
                        </TabsTrigger>
                        <TabsTrigger value="notes">
                            <BookText className="mr-1.5 size-3.5" />
                            Study Notes
                        </TabsTrigger>
                    </TabsList>

                    {/* ---------- Source language tab ---------- */}
                    <TabsContent value="source" className="flex-1 overflow-hidden">
                        <TranscriptPanel
                            state={source}
                            paragraphs={sourceParagraphs}
                            onCopy={() => copyToClipboard(source.text, `${srcLabel} transcript`)}
                            onDownloadTxt={() =>
                                downloadBlob(`${fileBase}.${detectedLanguage ?? 'src'}.txt`, source.text, 'text/plain')
                            }
                            emptyMessage={`No ${srcLabel} transcript available for this recording.`}
                        />
                    </TabsContent>

                    {/* ---------- English tab ---------- */}
                    {!isEnglishSource && (
                        <TabsContent value="english" className="flex-1 overflow-hidden">
                            <TranscriptPanel
                                state={english}
                                paragraphs={englishParagraphs}
                                onCopy={() => copyToClipboard(english.text, 'English transcript')}
                                onDownloadTxt={() =>
                                    downloadBlob(`${fileBase}.en.txt`, english.text, 'text/plain')
                                }
                                emptyMessage="No English translation available for this recording."
                            />
                        </TabsContent>
                    )}

                    {/* ---------- Combined markdown tab ---------- */}
                    <TabsContent value="markdown" className="flex-1 overflow-hidden">
                        <div className="flex h-full flex-col gap-2">
                            <div className="flex items-center justify-end gap-2">
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={() => copyToClipboard(markdown, 'Markdown')}
                                >
                                    <Copy className="mr-1.5 size-3.5" />
                                    Copy
                                </MyButton>
                                <MyButton
                                    type="button"
                                    buttonType="secondary"
                                    scale="small"
                                    onClick={() =>
                                        downloadBlob(`${fileBase}.md`, markdown, 'text/markdown')
                                    }
                                >
                                    <Download className="mr-1.5 size-3.5" />
                                    .md
                                </MyButton>
                            </div>
                            <ScrollArea className="flex-1 rounded-md border border-neutral-200 bg-neutral-50">
                                <pre className="whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed text-neutral-800">
                                    {markdown}
                                </pre>
                            </ScrollArea>
                        </div>
                    </TabsContent>

                    {/* ---------- AI study-notes tab ---------- */}
                    <TabsContent value="notes" className="flex-1 overflow-hidden">
                        <StudyNotesPanel
                            notes={notes}
                            onGenerate={handleGenerateNotes}
                            onCopy={() =>
                                copyToClipboard(notes.markdown, 'Study notes')
                            }
                            onDownload={() =>
                                downloadBlob(
                                    `${fileBase}.notes.md`,
                                    notes.markdown,
                                    'text/markdown',
                                )
                            }
                            transcriptReady={
                                source.state === 'loaded' || english.state === 'loaded'
                            }
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </MyDialog>
    );
}

interface TranscriptPanelProps {
    state: TextState;
    paragraphs: string[];
    onCopy: () => void;
    onDownloadTxt: () => void;
    emptyMessage: string;
}

/**
 * Renders the AI study notes tab. Four states:
 *  - transcript not yet loaded → disabled empty-state pitch
 *  - notes idle → centred Generate button with a one-line hook
 *  - notes loading → spinner + estimated wait
 *  - notes loaded → toolbar (Copy / .md) + markdown render
 *  - notes error → red message with a Retry button
 *
 * Notes are intentionally kept in-memory only — re-opening the modal
 * starts the user at the idle state again so they decide whether the
 * LLM cost is worth re-running. Persisting goes in a follow-up if
 * teachers ask for it.
 */
function StudyNotesPanel({
    notes,
    onGenerate,
    onCopy,
    onDownload,
    transcriptReady,
}: {
    notes: { state: LoadState; markdown: string; error?: string };
    onGenerate: () => void;
    onCopy: () => void;
    onDownload: () => void;
    transcriptReady: boolean;
}) {
    if (!transcriptReady) {
        return (
            <div className="flex h-64 items-center justify-center px-4 text-center text-sm text-neutral-500">
                Waiting for the transcript to finish loading before notes can be
                generated.
            </div>
        );
    }
    if (notes.state === 'idle') {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-8 py-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-primary-50 text-primary-500">
                    <Wand2 className="size-5" />
                </div>
                <div className="max-w-md text-sm text-neutral-600">
                    Turn this transcript into clean, structured study notes —
                    headings, key terms, bullet points, and per-section takeaways,
                    rendered as Markdown.
                </div>
                <MyButton type="button" scale="medium" onClick={onGenerate}>
                    <Wand2 className="mr-1.5 size-3.5" />
                    Generate Study Notes
                </MyButton>
                <div className="text-[11px] text-neutral-400">
                    Uses Gemini 2.5 Flash · typically 5–15 seconds
                </div>
            </div>
        );
    }
    if (notes.state === 'loading') {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
                <Loader2 className="size-6 animate-spin text-primary-500" />
                <div className="text-sm font-medium text-neutral-800">
                    Generating study notes…
                </div>
                <div className="text-xs text-neutral-500">
                    Reading the transcript and structuring it. Hang tight for a few
                    seconds.
                </div>
            </div>
        );
    }
    if (notes.state === 'error') {
        return (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-8 py-12 text-center">
                <Alert variant="destructive" className="max-w-md text-left">
                    <AlertDescription>
                        {notes.error ?? 'Could not generate notes.'}
                    </AlertDescription>
                </Alert>
                <MyButton
                    type="button"
                    buttonType="secondary"
                    scale="small"
                    onClick={onGenerate}
                >
                    <Wand2 className="mr-1.5 size-3.5" />
                    Retry
                </MyButton>
            </div>
        );
    }
    // loaded
    return (
        <div className="flex h-full flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <Badge variant="secondary" className="gap-1">
                    <Wand2 className="size-3" />
                    AI-generated · review before sharing
                </Badge>
                <div className="flex items-center gap-2">
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        onClick={onCopy}
                    >
                        <Copy className="mr-1.5 size-3.5" />
                        Copy
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        onClick={onDownload}
                    >
                        <Download className="mr-1.5 size-3.5" />
                        .md
                    </MyButton>
                    <MyButton
                        type="button"
                        buttonType="secondary"
                        scale="small"
                        onClick={onGenerate}
                    >
                        <Wand2 className="mr-1.5 size-3.5" />
                        Regenerate
                    </MyButton>
                </div>
            </div>
            <ScrollArea className="flex-1 rounded-md border border-neutral-200 bg-white">
                <div className="prose prose-sm prose-neutral max-w-none px-5 py-4 prose-headings:font-semibold prose-headings:text-neutral-800 prose-h1:mb-3 prose-h1:text-xl prose-h2:mt-5 prose-h2:text-lg prose-h3:mt-4 prose-h3:text-base prose-p:my-2 prose-p:leading-7 prose-li:my-0.5 prose-blockquote:border-l-primary-300 prose-blockquote:bg-primary-50/40 prose-blockquote:py-1 prose-blockquote:text-primary-900 prose-code:rounded prose-code:bg-neutral-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none">
                    <ReactMarkdown>{notes.markdown}</ReactMarkdown>
                </div>
            </ScrollArea>
        </div>
    );
}

function TranscriptPanel({
    state,
    paragraphs,
    onCopy,
    onDownloadTxt,
    emptyMessage,
}: TranscriptPanelProps) {
    if (state.state === 'loading') {
        return (
            <div className="flex h-64 items-center justify-center text-sm text-neutral-500">
                Loading transcript…
            </div>
        );
    }
    if (state.state === 'error') {
        return (
            <Alert variant="destructive">
                <AlertDescription>
                    Could not load transcript: {state.error ?? 'unknown error'}
                </AlertDescription>
            </Alert>
        );
    }
    if (state.state !== 'loaded' || !paragraphs.length) {
        return (
            <div className="flex h-64 items-center justify-center text-sm text-neutral-500">
                {emptyMessage}
            </div>
        );
    }

    return (
        <div className="flex h-full flex-col gap-2">
            <div className="flex items-center justify-end gap-2">
                <MyButton type="button" buttonType="secondary" scale="small" onClick={onCopy}>
                    <Copy className="mr-1.5 size-3.5" />
                    Copy
                </MyButton>
                <MyButton type="button" buttonType="secondary" scale="small" onClick={onDownloadTxt}>
                    <Download className="mr-1.5 size-3.5" />
                    .txt
                </MyButton>
            </div>
            <ScrollArea className="flex-1 rounded-md border border-neutral-200 bg-white">
                <div className="space-y-3 p-4 text-sm leading-7 text-neutral-800">
                    {paragraphs.map((p, i) => (
                        <p key={i}>{p}</p>
                    ))}
                </div>
            </ScrollArea>
        </div>
    );
}
