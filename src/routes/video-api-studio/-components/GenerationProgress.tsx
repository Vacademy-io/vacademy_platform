import { useState, useEffect } from 'react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { VideoStage, ContentType, getContentTypeLabel } from '../-services/video-generation';
import {
    FileText,
    Mic,
    AlignLeft,
    Code,
    CheckCircle2,
    Loader2,
    ChevronDown,
    ChevronUp,
    Copy,
    Check,
    Clock,
    Volume2,
} from 'lucide-react';

interface GenerationProgressProps {
    currentStage: VideoStage;
    percentage: number;
    message?: string;
    contentType?: ContentType;
    scriptUrl?: string;
    audioUrl?: string;
    wordsUrl?: string;
}

const STAGES: {
    id: VideoStage;
    label: string;
    icon: React.ReactNode;
    description: string;
}[] = [
    {
        id: 'SCRIPT',
        label: 'Script',
        icon: <FileText className="size-4" />,
        description: 'Writing narration',
    },
    {
        id: 'TTS',
        label: 'Audio',
        icon: <Mic className="size-4" />,
        description: 'Synthesizing voice',
    },
    {
        id: 'WORDS',
        label: 'Timing',
        icon: <AlignLeft className="size-4" />,
        description: 'Word alignment',
    },
    {
        id: 'HTML',
        label: 'Visuals',
        icon: <Code className="size-4" />,
        description: 'Generating slides',
    },
];

function getStageIndex(stage: VideoStage): number {
    return STAGES.findIndex((s) => s.id === stage);
}

function useRemoteText(url: string | undefined) {
    const [text, setText] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!url) return;
        setLoading(true);
        setError(false);
        fetch(url)
            .then((r) => {
                if (!r.ok) throw new Error(`HTTP ${r.status}`);
                return r.text();
            })
            .then(setText)
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [url]);

    return { text, loading, error };
}

// ── Script panel ──────────────────────────────────────────────────────────────
function ScriptContent({ url }: { url: string }) {
    const { text, loading, error } = useRemoteText(url);
    const [copied, setCopied] = useState(false);
    const [expanded, setExpanded] = useState(false);

    if (loading)
        return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Loading script…
            </div>
        );
    if (error)
        return <p className="text-xs text-destructive">Could not load script.</p>;
    if (!text) return null;

    // The script file may be a JSON plan_data object or plain text.
    let display = text;
    try {
        const parsed = JSON.parse(text);
        // Extract narration text from common keys
        display =
            parsed.script ||
            parsed.narration ||
            parsed.narration_script ||
            parsed.text ||
            // If none found, pretty-print the whole thing
            JSON.stringify(parsed, null, 2);
    } catch {
        // plain text – use as-is
    }

    const PREVIEW_LEN = 500;
    const isLong = display.length > PREVIEW_LEN;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(display);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="space-y-2">
            <div className="relative">
                <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap rounded-md bg-muted/40 p-3 font-sans text-xs leading-relaxed text-foreground">
                    {expanded ? display : display.slice(0, PREVIEW_LEN)}
                    {!expanded && isLong && '…'}
                </pre>
                <Button
                    size="icon"
                    variant="ghost"
                    className="absolute right-1.5 top-1.5 size-6"
                    onClick={handleCopy}
                    title="Copy script"
                >
                    {copied ? (
                        <Check className="size-3 text-green-600" />
                    ) : (
                        <Copy className="size-3" />
                    )}
                </Button>
            </div>
            {isLong && (
                <Button
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-xs"
                    onClick={() => setExpanded((e) => !e)}
                >
                    {expanded ? 'Show less' : 'Show full script'}
                </Button>
            )}
        </div>
    );
}

// ── Audio panel ───────────────────────────────────────────────────────────────
function AudioContent({ url }: { url: string }) {
    return (
        <div className="space-y-1.5">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls className="h-9 w-full" preload="metadata">
                <source src={url} type="audio/mpeg" />
                Your browser does not support the audio element.
            </audio>
            <p className="text-[11px] text-muted-foreground">
                AI-synthesised narration — word-level timing will be computed next.
            </p>
        </div>
    );
}

// ── Word timing panel ─────────────────────────────────────────────────────────
function WordsContent({ url }: { url: string }) {
    const { text, loading, error } = useRemoteText(url);

    if (loading)
        return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3 animate-spin" /> Loading timing data…
            </div>
        );
    if (error)
        return <p className="text-xs text-destructive">Could not load timing data.</p>;
    if (!text) return null;

    let words: Array<{ word: string; start: number; end: number }> = [];
    try {
        words = JSON.parse(text);
    } catch {
        return <p className="text-xs text-destructive">Invalid word timing format.</p>;
    }
    if (!Array.isArray(words) || words.length === 0)
        return <p className="text-xs text-muted-foreground">No timing data found.</p>;

    const totalDuration = words[words.length - 1]?.end ?? 0;
    const sample = words.slice(0, 48);

    return (
        <div className="space-y-2">
            {/* Stats row */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                    <AlignLeft className="size-3" />
                    {words.length} words
                </span>
                <span className="flex items-center gap-1">
                    <Clock className="size-3" />
                    {totalDuration.toFixed(1)}s
                </span>
            </div>

            {/* Word chips */}
            <div className="flex flex-wrap gap-1">
                {sample.map((w, i) => (
                    <span
                        key={i}
                        className="inline-flex items-baseline gap-0.5 rounded border border-blue-100 bg-blue-50 px-1.5 py-0.5 text-[11px] text-blue-800"
                    >
                        {w.word}
                        <span className="text-[9px] text-blue-400">{w.start.toFixed(1)}s</span>
                    </span>
                ))}
                {words.length > 48 && (
                    <span className="px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        +{words.length - 48} more
                    </span>
                )}
            </div>
        </div>
    );
}

// ── Collapsible stage-result panel ────────────────────────────────────────────
function StagePanel({
    title,
    icon,
    defaultOpen,
    children,
}: {
    title: string;
    icon: React.ReactNode;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen ?? false);

    return (
        <div className="overflow-hidden rounded-lg border border-green-200 bg-green-50/30 duration-200 animate-in fade-in slide-in-from-top-2">
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-green-50/70"
            >
                <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 shrink-0 text-green-600" />
                    <span className="text-green-700">{icon}</span>
                    <span className="text-sm font-medium">{title}</span>
                </div>
                {open ? (
                    <ChevronUp className="size-3.5 text-muted-foreground" />
                ) : (
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                )}
            </button>
            {open && (
                <div className="border-t border-green-100 px-3 pb-3 pt-2">{children}</div>
            )}
        </div>
    );
}

// ── Main component ────────────────────────────────────────────────────────────
export function GenerationProgress({
    currentStage,
    percentage,
    message,
    contentType = 'VIDEO',
    scriptUrl,
    audioUrl,
    wordsUrl,
}: GenerationProgressProps) {
    const currentIndex = getStageIndex(currentStage);
    const contentLabel = getContentTypeLabel(contentType);

    // Auto-expand the most recently completed stage's panel
    // (tracked by whichever URL just appeared)
    const scriptReady = !!scriptUrl;
    const audioReady = !!audioUrl;
    const wordsReady = !!wordsUrl;

    return (
        <div className="w-full space-y-5">
            {/* ── Progress bar ── */}
            <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">
                        Generating {contentLabel.replace(/^[^\s]+\s/, '')}…
                    </span>
                    <span className="tabular-nums text-muted-foreground">{percentage}%</span>
                </div>
                <Progress value={percentage} className="h-1.5" />
            </div>

            {/* ── Stage stepper ── */}
            <div className="flex items-start">
                {STAGES.map((stage, index) => {
                    const isCompleted = index < currentIndex;
                    const isCurrent = index === currentIndex;
                    const isPending = index > currentIndex;
                    const isLast = index === STAGES.length - 1;

                    return (
                        <div key={stage.id} className="flex flex-1 items-start">
                            <div className="flex flex-1 flex-col items-center gap-1">
                                <div
                                    className={`
                                        flex size-7 items-center justify-center rounded-full text-xs font-bold transition-all
                                        ${isCompleted ? 'bg-green-500 text-white' : ''}
                                        ${isCurrent ? 'bg-blue-500 text-white ring-2 ring-blue-200' : ''}
                                        ${isPending ? 'bg-muted text-muted-foreground' : ''}
                                    `}
                                >
                                    {isCompleted ? (
                                        <CheckCircle2 className="size-3.5" />
                                    ) : isCurrent ? (
                                        <Loader2 className="size-3.5 animate-spin" />
                                    ) : (
                                        stage.icon
                                    )}
                                </div>
                                <div className="text-center">
                                    <div
                                        className={`text-xs font-medium leading-none ${
                                            isCurrent
                                                ? 'text-blue-600'
                                                : isCompleted
                                                  ? 'text-green-600'
                                                  : 'text-muted-foreground'
                                        }`}
                                    >
                                        {stage.label}
                                    </div>
                                    {isCurrent && (
                                        <div className="mt-0.5 text-[10px] leading-none text-blue-400">
                                            {stage.description}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {!isLast && (
                                <div
                                    className={`mx-1 mt-3.5 h-px flex-1 ${
                                        index < currentIndex ? 'bg-green-400' : 'bg-muted'
                                    }`}
                                />
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Status message ── */}
            {message && (
                <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-center text-xs text-blue-700">
                    {message}
                </div>
            )}

            {/* ── Stage result panels (appear progressively as each stage finishes) ── */}
            <div className="space-y-2">
                {scriptReady && (
                    <StagePanel
                        title="Script Generated"
                        icon={<FileText className="size-3.5" />}
                        defaultOpen={!audioReady}
                    >
                        <ScriptContent url={scriptUrl} />
                    </StagePanel>
                )}

                {audioReady && (
                    <StagePanel
                        title="Audio Ready"
                        icon={<Volume2 className="size-3.5" />}
                        defaultOpen={!wordsReady}
                    >
                        <AudioContent url={audioUrl} />
                    </StagePanel>
                )}

                {wordsReady && (
                    <StagePanel
                        title="Word Timing Ready"
                        icon={<AlignLeft className="size-3.5" />}
                        defaultOpen={currentStage === 'WORDS' || currentStage === 'HTML'}
                    >
                        <WordsContent url={wordsUrl} />
                    </StagePanel>
                )}
            </div>
        </div>
    );
}
