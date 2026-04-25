import { useEffect, useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Coins, Loader2 } from 'lucide-react';
import {
    previewVideoCost,
    type GenerateVideoRequest,
    type VideoCostPreviewRequest,
    type VideoCostPreviewResponse,
} from '../-services/video-generation';

// Feature flag: render USD cost lines next to credits. Flip to false (or set
// VITE_SHOW_USD_COST=false) to hide all $ figures without touching layout.
const SHOW_USD_COST: boolean =
    (import.meta.env.VITE_SHOW_USD_COST ?? 'true').toString().toLowerCase() !== 'false';

function buildPreviewPayload(
    options: Omit<GenerateVideoRequest, 'prompt'>,
    extras: { reviewMode: boolean; attachmentsCount: number; backgroundMusicEnabled?: boolean | null }
): VideoCostPreviewRequest {
    return {
        quality_tier: options.quality_tier,
        model: options.model || undefined,
        target_duration: options.target_duration,
        target_audience: options.target_audience,
        orientation: options.orientation || 'landscape',
        visual_style: options.visual_style,
        voice_gender: options.voice_gender,
        tts_provider: options.tts_provider,
        voice_id: options.voice_id || undefined,
        language: options.language,
        generate_avatar: false,
        background_music_enabled:
            extras.backgroundMusicEnabled === undefined ? null : extras.backgroundMusicEnabled,
        sound_effects_enabled: true,
        content_type: options.content_type || 'VIDEO',
        captions_enabled: options.captions_enabled,
        html_quality: options.html_quality,
        review_mode: extras.reviewMode,
        attachments_count: extras.attachmentsCount,
    };
}

// ---------------------------------------------------------------------------
// Hook — debounced fetch as user toggles options.
// ---------------------------------------------------------------------------

export function useCostPreview(args: {
    apiKey?: string | null;
    options: Omit<GenerateVideoRequest, 'prompt'>;
    reviewMode: boolean;
    attachmentsCount: number;
    enabled?: boolean;
}) {
    const { apiKey, options, reviewMode, attachmentsCount, enabled = true } = args;
    const [data, setData] = useState<VideoCostPreviewResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const payload = useMemo(
        () => buildPreviewPayload(options, { reviewMode, attachmentsCount }),
        [options, reviewMode, attachmentsCount]
    );
    const payloadKey = useMemo(() => JSON.stringify(payload), [payload]);

    useEffect(() => {
        if (!enabled || !apiKey) return;
        let cancelled = false;
        const t = setTimeout(() => {
            setLoading(true);
            setError(null);
            previewVideoCost(payload, apiKey)
                .then((res) => {
                    if (!cancelled) setData(res);
                })
                .catch((err) => {
                    if (!cancelled) setError(err instanceof Error ? err.message : 'Preview failed');
                })
                .finally(() => {
                    if (!cancelled) setLoading(false);
                });
        }, 300);
        return () => {
            cancelled = true;
            clearTimeout(t);
        };
    }, [payloadKey, apiKey, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

    return { data, loading, error };
}

// ---------------------------------------------------------------------------
// Inline summary — sits below PromptInput, auto-updates.
// ---------------------------------------------------------------------------

const _CHIP_BASE = 'inline-flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-[11px]';

function fmtCredits(n: number | null | undefined): string {
    if (n == null) return '—';
    return Math.round(n).toLocaleString();
}
function fmtUsd(n: number | null | undefined): string {
    if (n == null) return '—';
    return `$${n.toFixed(2)}`;
}

export function CostPreviewInline({ data, loading }: { data: VideoCostPreviewResponse | null; loading: boolean }) {
    if (!data && !loading) return null;
    const sel = data?.selections;
    const est = data?.estimate;
    const bal = data?.balance;
    const insufficient = bal && !bal.sufficient_for_high;

    return (
        <div className="mt-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                    {sel && (
                        <>
                            <Badge variant="secondary" className="font-medium uppercase tracking-wide">
                                {sel.quality_tier}
                            </Badge>
                            <span className={_CHIP_BASE}>{sel.target_duration}</span>
                            <span className={_CHIP_BASE}>{sel.orientation}</span>
                            <span className={_CHIP_BASE}>
                                {sel.voice.provider} · {sel.voice.gender}
                            </span>
                            {sel.model && (
                                <span className={_CHIP_BASE} title={sel.model}>
                                    {sel.model.split('/').pop()}
                                </span>
                            )}
                        </>
                    )}
                </div>

                <div className="ml-auto flex items-center gap-2">
                    {loading && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
                    {est && (
                        <span className="flex items-center gap-1 font-medium">
                            <Coins className="size-3 text-amber-500" />
                            ~{fmtCredits(est.expected_credits)} credits
                            <span className="text-muted-foreground">
                                ({fmtCredits(est.low_credits)}–{fmtCredits(est.high_credits)})
                            </span>
                        </span>
                    )}
                    {SHOW_USD_COST && est && (
                        <span className="text-muted-foreground">≈ {fmtUsd(est.expected_cost_usd)}</span>
                    )}
                    {bal && bal.current != null && (
                        <span className={`text-[11px] ${insufficient ? 'text-red-600' : 'text-muted-foreground'}`}>
                            {insufficient ? '⚠ ' : '✓ '}
                            {fmtCredits(bal.current)} available
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Confirmation modal — full breakdown, blocks on insufficient balance.
// ---------------------------------------------------------------------------

export function CostPreviewModal({
    open,
    onOpenChange,
    data,
    loading,
    error,
    onConfirm,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    data: VideoCostPreviewResponse | null;
    loading: boolean;
    error: string | null;
    onConfirm: () => void;
}) {
    const sel = data?.selections;
    const est = data?.estimate;
    const bal = data?.balance;
    const insufficient = bal != null && !bal.sufficient_for_high;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[85vh] w-[92vw] max-w-3xl flex-col overflow-hidden sm:max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Confirm generation</DialogTitle>
                </DialogHeader>

                <div className="-mx-6 flex-1 overflow-y-auto px-6">
                {loading && !data && (
                    <div className="flex items-center justify-center py-10 text-muted-foreground">
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        Estimating cost…
                    </div>
                )}

                {error && !data && (
                    <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                        <span>Couldn't load estimate: {error}. You can still proceed.</span>
                    </div>
                )}

                {sel && est && (
                    <div className="space-y-4 text-sm">
                        {/* Selections summary */}
                        <section>
                            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Your selections
                            </h3>
                            <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                                <SelectionRow label="Quality" value={sel.quality_tier} highlight />
                                <SelectionRow label="Model" value={sel.model || 'default'} highlight />
                                <SelectionRow label="Duration" value={sel.target_duration} />
                                <SelectionRow label="Orientation" value={sel.orientation} highlight />
                                <SelectionRow label="Audience" value={sel.target_audience} />
                                <SelectionRow label="Language" value={sel.language} />
                                <SelectionRow
                                    label="Voice"
                                    value={`${sel.voice.provider} · ${sel.voice.gender}${
                                        sel.voice.voice_id ? ` (${sel.voice.voice_id})` : ''
                                    }`}
                                />
                                <SelectionRow label="Captions" value={sel.captions_enabled ? 'on' : 'off'} />
                                <SelectionRow
                                    label="Background music"
                                    value={sel.background_music_enabled ? 'on' : 'off'}
                                />
                                <SelectionRow
                                    label="Sound effects"
                                    value={sel.sound_effects_enabled ? 'on' : 'off'}
                                />
                                <SelectionRow label="Review mode" value={sel.review_mode ? 'on (stop at script)' : 'off'} />
                                {sel.attachments_count > 0 && (
                                    <SelectionRow label="Attachments" value={`${sel.attachments_count} file(s)`} />
                                )}
                            </dl>
                        </section>

                        {/* Cost breakdown */}
                        <section>
                            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Estimated cost
                            </h3>
                            <table className="w-full border-separate border-spacing-y-1 text-xs">
                                <thead className="text-muted-foreground">
                                    <tr>
                                        <th className="text-left font-normal">Component</th>
                                        <th className="text-right font-normal">Credits</th>
                                        {SHOW_USD_COST && <th className="text-right font-normal">USD</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {est.breakdown.map((row) => (
                                        <tr key={row.component}>
                                            <td>
                                                <div className="font-medium">{row.component}</div>
                                                <div className="text-[11px] text-muted-foreground">{row.detail}</div>
                                            </td>
                                            <td className="text-right tabular-nums">{fmtCredits(row.credits)}</td>
                                            {SHOW_USD_COST && (
                                                <td className="text-right tabular-nums text-muted-foreground">
                                                    {fmtUsd(row.cost_usd)}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                    <tr className="border-t font-semibold">
                                        <td>
                                            Expected total
                                            <div className="text-[11px] font-normal text-muted-foreground">
                                                Range: {fmtCredits(est.low_credits)}–{fmtCredits(est.high_credits)} credits
                                                {SHOW_USD_COST &&
                                                    ` (${fmtUsd(est.low_cost_usd)}–${fmtUsd(est.high_cost_usd)})`}
                                            </div>
                                        </td>
                                        <td className="text-right tabular-nums">{fmtCredits(est.expected_credits)}</td>
                                        {SHOW_USD_COST && (
                                            <td className="text-right tabular-nums">
                                                {fmtUsd(est.expected_cost_usd)}
                                            </td>
                                        )}
                                    </tr>
                                </tbody>
                            </table>
                        </section>

                        {/* Balance */}
                        {bal && bal.current != null && (
                            <section
                                className={`rounded-md border p-2.5 text-xs ${
                                    insufficient ? 'border-red-300 bg-red-50' : 'bg-muted/40'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span>Current balance</span>
                                    <span className="tabular-nums font-medium">{fmtCredits(bal.current)} credits</span>
                                </div>
                                <div className="flex items-center justify-between text-muted-foreground">
                                    <span>After expected charge</span>
                                    <span className="tabular-nums">{fmtCredits(bal.after_expected)}</span>
                                </div>
                                <div className="flex items-center justify-between text-muted-foreground">
                                    <span>Worst case (high)</span>
                                    <span className="tabular-nums">{fmtCredits(bal.after_high)}</span>
                                </div>
                                {insufficient && (
                                    <div className="mt-2 flex items-center gap-1.5 font-medium text-red-700">
                                        <AlertTriangle className="size-3.5" />
                                        Insufficient credits to cover the worst-case estimate.
                                    </div>
                                )}
                            </section>
                        )}

                        {est.assumptions.length > 0 && (
                            <details className="text-[11px] text-muted-foreground">
                                <summary className="cursor-pointer">Assumptions</summary>
                                <ul className="mt-1 list-disc space-y-0.5 pl-4">
                                    {est.assumptions.map((a, i) => (
                                        <li key={i}>{a}</li>
                                    ))}
                                </ul>
                            </details>
                        )}
                    </div>
                )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    {insufficient ? (
                        <Button disabled className="bg-red-600 text-white hover:bg-red-700">
                            Insufficient credits — top up
                        </Button>
                    ) : (
                        <Button onClick={onConfirm} disabled={loading && !data}>
                            Confirm & generate
                            {est && ` · ${fmtCredits(est.expected_credits)} credits`}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function SelectionRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
    return (
        <>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={highlight ? 'font-semibold' : ''}>{value}</dd>
        </>
    );
}
