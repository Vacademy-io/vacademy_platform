import { useEffect, useState } from 'react';
import { MyDialog } from '@/components/design-system/dialog';
import { MyButton } from '@/components/design-system/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    sourceTextUrl?: string | null;
    englishTextUrl?: string | null;
    detectedLanguage?: string;
    recordingTitle?: string;
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
        toast.success(`${label} copied`);
    } catch {
        toast.error('Could not access clipboard');
    }
};

export function TranscriptActionsDialog({
    open,
    onOpenChange,
    sourceTextUrl,
    englishTextUrl,
    detectedLanguage,
    recordingTitle = 'transcript',
    onCreateAssessment,
}: Props) {
    const [source, setSource] = useState<TextState>({ state: 'idle', text: '' });
    const [english, setEnglish] = useState<TextState>({ state: 'idle', text: '' });
    const [notes, setNotes] = useState<{
        state: LoadState;
        markdown: string;
        error?: string;
    }>({ state: 'idle', markdown: '' });

    useEffect(() => {
        if (!open) {
            // Reset notes view when the dialog closes so reopening starts
            // fresh on the action picker rather than the previous result.
            setNotes({ state: 'idle', markdown: '' });
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
            <div className="flex max-h-[75vh] flex-col gap-4 overflow-y-auto p-5">
                {/* Status pill */}
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                        <Sparkles className="size-3" />
                        Transcript ready
                    </span>
                    {detectedLanguage && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-600">
                            <Languages className="size-3" />
                            {langName(detectedLanguage)}
                        </span>
                    )}
                </div>

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
                        <div className="flex items-center justify-between">
                            <button
                                type="button"
                                onClick={() => setNotes({ state: 'idle', markdown: '' })}
                                className="text-xs font-medium text-primary-600 hover:underline"
                            >
                                ← Back to actions
                            </button>
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
                                    onClick={() =>
                                        downloadBlob(
                                            `${fileBase}.notes.md`,
                                            notes.markdown,
                                            'text/markdown',
                                        )
                                    }
                                >
                                    <Download className="mr-1.5 size-3.5" />
                                    .md
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
                            <div className="prose prose-sm prose-neutral max-w-none px-6 py-5 prose-headings:font-semibold prose-headings:text-neutral-800 prose-h1:mb-3 prose-h1:text-xl prose-h2:mt-5 prose-h2:text-lg prose-h3:mt-4 prose-h3:text-base prose-p:my-2 prose-p:leading-7 prose-li:my-0.5 prose-blockquote:border-l-primary-300 prose-blockquote:bg-primary-50/40 prose-blockquote:py-1 prose-blockquote:not-italic prose-blockquote:text-primary-900 prose-code:rounded prose-code:bg-neutral-100 prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none">
                                <ReactMarkdown>{notes.markdown}</ReactMarkdown>
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
