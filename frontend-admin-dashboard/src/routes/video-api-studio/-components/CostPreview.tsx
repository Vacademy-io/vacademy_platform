import { useEffect, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Coins, Loader2 } from 'lucide-react';
import {
    previewVideoCost,
    type GenerateVideoRequest,
    type VideoCostPreviewRequest,
    type VideoCostPreviewResponse,
    type VideoCostPreviewBreakdownRow,
} from '../-services/video-generation';
import { getInstituteId } from '@/constants/helper';
import type { StudioAvatar } from '@/features/vimotion/api/dashboardTypes';

// Feature flag: render USD cost lines next to credits. Flip to false (or set
// VITE_SHOW_USD_COST=false) to hide all $ figures without touching layout.
const SHOW_USD_COST: boolean =
    (import.meta.env.VITE_SHOW_USD_COST ?? 'true').toString().toLowerCase() !== 'false';

function buildPreviewPayload(
    options: Omit<GenerateVideoRequest, 'prompt'>,
    extras: {
        reviewMode: boolean;
        attachmentsCount: number;
        backgroundMusicEnabled?: boolean | null;
    }
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
        // Forward the host config so the BE estimator can add the avatar
        // synthesis + reference-image cost lines. BE silently ignores `host`
        // for tiers below ultra (matches the API-edge tier gate).
        host: options.host,
    };
}

// ---------------------------------------------------------------------------
// Avatar breakdown rewriter — drop the misleading fal-endpoint string from
// the BE response and replace it with the picked avatar's display name. The
// BE may still emit `~81s @ fal-ai/kling-video/...` even when the actual
// dispatch is Argil/VEED (see video_estimation_service.py — pre-fix backends
// don't resolve saved_avatar_id at preview time). This FE pass gives users
// a stable, accurate label regardless of which BE version is responding.
// ---------------------------------------------------------------------------

const _AVATAR_SYNTH_COMPONENT = 'Avatar video synthesis (host)';
const _AVATAR_REF_COMPONENT = 'Avatar reference images (host)';

function rewriteAvatarRow(
    row: VideoCostPreviewBreakdownRow,
    pickedAvatar: StudioAvatar | undefined
): VideoCostPreviewBreakdownRow | null {
    if (row.component === _AVATAR_SYNTH_COMPONENT) {
        // Always rewrite to drop the technical endpoint string. Use the
        // picked avatar's name when available; fall back to a bare label
        // for admin (free-form upload, no studio_avatar row).
        if (pickedAvatar) {
            const isBuiltin = pickedAvatar.provider !== 'custom';
            const label = isBuiltin ? 'Preset avatar' : 'Custom avatar';
            const name = (pickedAvatar.name || '').trim();
            return {
                ...row,
                detail: name ? `${label} — ${name}` : label,
            };
        }
        return { ...row, detail: 'Custom avatar' };
    }
    if (row.component === _AVATAR_REF_COMPONENT) {
        // Built-in catalog avatars skip Seedream entirely — drop this row
        // when a built-in is picked. The cost number is harmless either way
        // (we'd just be over-displaying a charge that won't actually fire).
        if (pickedAvatar && pickedAvatar.provider !== 'custom') {
            return null;
        }
        // Custom path — keep the row but simplify the detail.
        return { ...row, detail: 'Per-shot identity images' };
    }
    return row;
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

function fmtCredits(n: number | null | undefined): string {
    if (n == null) return '—';
    return Math.round(n).toLocaleString();
}
function fmtUsd(n: number | null | undefined): string {
    if (n == null) return '—';
    return `$${n.toFixed(2)}`;
}

export function CostPreviewInline({
    data,
    loading,
}: {
    data: VideoCostPreviewResponse | null;
    loading: boolean;
}) {
    if (!data && !loading) return null;
    const est = data?.estimate;
    const bal = data?.balance;
    const insufficient = bal && !bal.sufficient_for_high;

    // Selection details (quality_tier / duration / orientation / voice / model)
    // are already shown as chips in the option-bubble row above this preview,
    // so we only render the cost + balance summary here.
    if (!est && !bal && !loading) return null;

    return (
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-0.5 text-[11px]">
            {loading && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
            {est && (
                <span className="flex items-center gap-1 font-medium">
                    <Coins className="size-3 text-amber-500" />~{fmtCredits(est.expected_credits)}{' '}
                    credits
                    <span className="text-muted-foreground">
                        ({fmtCredits(est.low_credits)}–{fmtCredits(est.high_credits)})
                    </span>
                </span>
            )}
            {SHOW_USD_COST && est && (
                <span className="text-muted-foreground">≈ {fmtUsd(est.expected_cost_usd)}</span>
            )}
            {bal && bal.current != null && (
                <span className={insufficient ? 'text-red-600' : 'text-muted-foreground'}>
                    {insufficient ? '⚠ ' : '✓ '}
                    {fmtCredits(bal.current)} available
                </span>
            )}
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
    savedAvatarId,
}: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    data: VideoCostPreviewResponse | null;
    loading: boolean;
    error: string | null;
    onConfirm: () => void;
    /**
     * studio_avatar.id of the picked saved avatar, when one is selected.
     * Used to rewrite the BE-built breakdown rows so the user sees a
     * friendly label ("Custom avatar — Matteo" / "Preset avatar — Matteo")
     * instead of the inert fal endpoint slug carried by the BE for
     * back-compat. Lookup uses the React Query cache populated by
     * VimSavedAvatarSelect — no extra fetch.
     */
    savedAvatarId?: string;
}) {
    const sel = data?.selections;
    const est = data?.estimate;
    const bal = data?.balance;
    const insufficient = bal != null && !bal.sufficient_for_high;

    // Resolve the picked saved avatar from the React Query cache so we can
    // render its name + provider in the breakdown. Cache key matches the
    // one VimSavedAvatarSelect uses; we don't trigger a fetch from here.
    const queryClient = useQueryClient();
    const instituteId = getInstituteId();
    const cachedAvatars =
        queryClient.getQueryData<StudioAvatar[]>(['vim-saved-avatars', instituteId]) ?? [];
    const pickedAvatar = savedAvatarId
        ? cachedAvatars.find((a) => a.id === savedAvatarId)
        : undefined;

    const visibleBreakdown = useMemo(() => {
        if (!est) return [];
        return est.breakdown
            .map((row) => rewriteAvatarRow(row, pickedAvatar))
            .filter((row): row is VideoCostPreviewBreakdownRow => row !== null);
    }, [est, pickedAvatar]);

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
                            <span>
                                Couldn&rsquo;t load estimate: {error}. You can still proceed.
                            </span>
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
                                    <SelectionRow
                                        label="Quality"
                                        value={sel.quality_tier}
                                        highlight
                                    />
                                    <SelectionRow
                                        label="Model"
                                        value={sel.model || 'default'}
                                        highlight
                                    />
                                    <SelectionRow label="Duration" value={sel.target_duration} />
                                    <SelectionRow
                                        label="Orientation"
                                        value={sel.orientation}
                                        highlight
                                    />
                                    <SelectionRow label="Audience" value={sel.target_audience} />
                                    <SelectionRow label="Language" value={sel.language} />
                                    <SelectionRow
                                        label="Voice"
                                        value={`${sel.voice.provider} · ${sel.voice.gender}${
                                            sel.voice.voice_id ? ` (${sel.voice.voice_id})` : ''
                                        }`}
                                    />
                                    <SelectionRow
                                        label="Captions"
                                        value={sel.captions_enabled ? 'on' : 'off'}
                                    />
                                    <SelectionRow
                                        label="Background music"
                                        value={sel.background_music_enabled ? 'on' : 'off'}
                                    />
                                    <SelectionRow
                                        label="Sound effects"
                                        value={sel.sound_effects_enabled ? 'on' : 'off'}
                                    />
                                    <SelectionRow
                                        label="Review mode"
                                        value={sel.review_mode ? 'on (stop at script)' : 'off'}
                                    />
                                    {sel.attachments_count > 0 && (
                                        <SelectionRow
                                            label="Attachments"
                                            value={`${sel.attachments_count} file(s)`}
                                        />
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
                                            {SHOW_USD_COST && (
                                                <th className="text-right font-normal">USD</th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visibleBreakdown.map((row) => (
                                            <tr key={row.component}>
                                                <td>
                                                    <div className="font-medium">
                                                        {row.component}
                                                    </div>
                                                    <div className="text-[11px] text-muted-foreground">
                                                        {row.detail}
                                                    </div>
                                                </td>
                                                <td className="text-right tabular-nums">
                                                    {fmtCredits(row.credits)}
                                                </td>
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
                                                    Range: {fmtCredits(est.low_credits)}–
                                                    {fmtCredits(est.high_credits)} credits
                                                    {SHOW_USD_COST &&
                                                        ` (${fmtUsd(est.low_cost_usd)}–${fmtUsd(est.high_cost_usd)})`}
                                                </div>
                                            </td>
                                            <td className="text-right tabular-nums">
                                                {fmtCredits(est.expected_credits)}
                                            </td>
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
                                        <span className="font-medium tabular-nums">
                                            {fmtCredits(bal.current)} credits
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <span>After expected charge</span>
                                        <span className="tabular-nums">
                                            {fmtCredits(bal.after_expected)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-muted-foreground">
                                        <span>Worst case (high)</span>
                                        <span className="tabular-nums">
                                            {fmtCredits(bal.after_high)}
                                        </span>
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

function SelectionRow({
    label,
    value,
    highlight,
}: {
    label: string;
    value: string;
    highlight?: boolean;
}) {
    return (
        <>
            <dt className="text-muted-foreground">{label}</dt>
            <dd className={highlight ? 'font-semibold' : ''}>{value}</dd>
        </>
    );
}
