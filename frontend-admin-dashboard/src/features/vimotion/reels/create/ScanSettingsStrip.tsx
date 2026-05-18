/**
 * Compact scan-settings strip that sits above `ScanResultsGrid`. Lets the
 * user pick `target_duration_sec` + `scan_limit` before they commit to a
 * full preview/render cycle.
 *
 * Both fields are intrinsic to the SCAN — they shape which windows the
 * scorer considers. Changing either triggers a fresh `/scan` via
 * `useScan`'s queryKey (so the backend re-runs the engagement scorer,
 * bypassing the 1h server-side cache). Selected candidate IDs become
 * invalid when params change; CreatePage clears the selection on each
 * change.
 *
 * Always-visible chip strip rather than a collapsible panel because the
 * "tweak duration → see new candidates → tweak again" loop is the core
 * exploration flow — hiding it behind an extra click would be friction.
 */
import { useState } from 'react';
import { Clock, Hash, ListChecks, X } from 'lucide-react';
import { VimotionLoader } from '../../brand/VimotionLoader';
import { cn } from '@/lib/utils';

interface ScanSettingsStripProps {
    targetDurationSec: number;
    scanLimit: number;
    topicKeywords: string[];
    onChange: (next: {
        targetDurationSec?: number;
        scanLimit?: number;
        topicKeywords?: string[];
    }) => void;
    /** Disabled while the scan is in flight — chip clicks during a fetch
     *  would queue conflicting query keys and confuse TanStack Query. */
    busy?: boolean;
}

// Cap visible to the user so the strip can't grow unbounded. Backend doesn't
// enforce a hard limit, but 10 is comfortably more than any practical biasing
// intent + protects the prompt-size envelope.
const MAX_TOPIC_KEYWORDS = 10;
// Per-keyword length cap. Backend `reels_preview_service` already sanitizes
// to 64 chars; we cap at the same length here so the UI doesn't accept
// something the server will silently trim.
const MAX_KEYWORD_LEN = 64;

// Sweet-spot durations from research §12.2:
//   * 15s — Reels max-retention window (60-80% completion typical)
//   * 25s — TikTok 21-34s sweet spot, our default
//   * 45s — long-form lecture / interview slice
//   * 60s — full minute, useful for narrative arcs
const DURATION_CHIPS = [15, 25, 45, 60] as const;

// Scan limit caps how many candidates the scorer returns. 30 is our
// default. Smaller = faster UI rendering on the candidate grid; larger
// = more options to pick from. Server caps at 50.
const LIMIT_CHIPS = [10, 20, 30, 50] as const;

export function ScanSettingsStrip({
    targetDurationSec,
    scanLimit,
    topicKeywords,
    onChange,
    busy = false,
}: ScanSettingsStripProps) {
    return (
        <div
            className={cn(
                'space-y-3 rounded-xl border border-neutral-200 bg-white px-4 py-3',
                busy && 'opacity-60 pointer-events-none'
            )}
        >
            <div className="flex flex-wrap items-center gap-4">
                <SettingGroup
                    icon={<Clock className="size-4 text-neutral-500" />}
                    label="Target duration"
                >
                    {DURATION_CHIPS.map((d) => (
                        <Chip
                            key={d}
                            active={d === targetDurationSec}
                            onClick={() => onChange({ targetDurationSec: d })}
                        >
                            {d}s
                        </Chip>
                    ))}
                </SettingGroup>

                <div className="hidden h-6 w-px bg-neutral-200 sm:block" />

                <SettingGroup
                    icon={<ListChecks className="size-4 text-neutral-500" />}
                    label="Candidates"
                >
                    {LIMIT_CHIPS.map((n) => (
                        <Chip
                            key={n}
                            active={n === scanLimit}
                            onClick={() => onChange({ scanLimit: n })}
                        >
                            {n}
                        </Chip>
                    ))}
                </SettingGroup>

                {busy && (
                    <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-neutral-500">
                        <VimotionLoader size={12} className="text-neutral-500" label="Re-scanning" />
                        Re-scanning…
                    </span>
                )}
            </div>

            <TopicKeywordInput
                keywords={topicKeywords}
                onChange={(next) => onChange({ topicKeywords: next })}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Topic keyword input — chip-input pattern
//
// Engagement scorer bias: when present, windows that mention any of these
// keywords score higher on the Info axis (research §1.3 + scorer's
// `keyword_match` bonus). Useful for "give me clips about X" intent.
//
// UX:
//   - Type a keyword → Enter or comma commits it as a chip + clears input
//   - X on a chip removes it
//   - Backspace on empty input removes the last chip (familiar pattern)
//   - Soft cap of MAX_TOPIC_KEYWORDS; once hit, the input goes disabled
//   - Empty array (cleared chips) sends `topic_keywords: []` to backend,
//     which means "no bias" — engagement scoring proceeds normally
// ---------------------------------------------------------------------------

function TopicKeywordInput({
    keywords,
    onChange,
}: {
    keywords: string[];
    onChange: (next: string[]) => void;
}) {
    const [draft, setDraft] = useState('');
    const atLimit = keywords.length >= MAX_TOPIC_KEYWORDS;

    const commit = () => {
        const cleaned = draft.trim().slice(0, MAX_KEYWORD_LEN);
        if (!cleaned) {
            setDraft('');
            return;
        }
        // Case-insensitive dedupe — backend lowercases for matching anyway.
        const exists = keywords.some((k) => k.toLowerCase() === cleaned.toLowerCase());
        if (exists || atLimit) {
            setDraft('');
            return;
        }
        onChange([...keywords, cleaned]);
        setDraft('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            commit();
            return;
        }
        // Backspace on empty input → remove the last chip. Standard chip-
        // input affordance; saves the user from reaching for the mouse.
        if (e.key === 'Backspace' && draft.length === 0 && keywords.length > 0) {
            e.preventDefault();
            onChange(keywords.slice(0, -1));
        }
    };

    const removeAt = (i: number) => {
        onChange(keywords.filter((_, idx) => idx !== i));
    };

    return (
        <div className="flex items-start gap-2.5 border-t border-neutral-100 pt-3">
            <div className="flex shrink-0 items-center gap-1.5 pt-1">
                <Hash className="size-4 text-neutral-500" />
                <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-600">
                    Topics
                </span>
            </div>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                {keywords.map((k, i) => (
                    <span
                        key={`${k}-${i}`}
                        className="inline-flex h-7 items-center gap-1 rounded-full bg-neutral-900 px-2.5 text-xs font-medium text-white"
                    >
                        {k}
                        <button
                            type="button"
                            onClick={() => removeAt(i)}
                            className="-mr-0.5 inline-flex size-4 items-center justify-center rounded-full hover:bg-white/15"
                            aria-label={`Remove ${k}`}
                        >
                            <X className="size-3" />
                        </button>
                    </span>
                ))}
                <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={commit}
                    disabled={atLimit}
                    placeholder={
                        atLimit
                            ? `Max ${MAX_TOPIC_KEYWORDS} keywords`
                            : keywords.length === 0
                              ? 'Type a topic + Enter (biases scoring toward clips about it)'
                              : 'Add another…'
                    }
                    className={cn(
                        'inline-flex h-7 min-w-[12rem] flex-1 items-center rounded-md bg-transparent px-2 text-xs',
                        'placeholder:text-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300',
                        atLimit && 'cursor-not-allowed opacity-50'
                    )}
                />
            </div>
        </div>
    );
}


// ---------------------------------------------------------------------------
// Primitives — kept local; consistent with RenderConfigPanel's Chip style
// ---------------------------------------------------------------------------

function SettingGroup({
    icon,
    label,
    children,
}: {
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5">
                {icon}
                <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-600">
                    {label}
                </span>
            </div>
            <div className="flex flex-wrap gap-1.5">{children}</div>
        </div>
    );
}

function Chip({
    active,
    onClick,
    children,
}: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'inline-flex h-7 items-center rounded-full px-2.5 text-xs font-medium transition-colors',
                active
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white text-neutral-700 ring-1 ring-neutral-200 hover:bg-neutral-50'
            )}
        >
            {children}
        </button>
    );
}
