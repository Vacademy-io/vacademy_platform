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

// Credit-only display: USD figures are intentionally not shown to the
// user (credits are the only billing currency). The backend response
// still carries `cost_usd` fields for internal accounting / forensic
// debugging — we just don't render them. To re-enable USD for an
// internal admin view, render the same `row.cost_usd` / `est.*_cost_usd`
// fields explicitly behind your own gate.

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
        // Forward AI video opt-in so the BE adds a worst-case Veo row to
        // the breakdown. Same tier-gate as host above — BE ignores on
        // sub-ultra tiers.
        ai_video_enabled: options.ai_video_enabled,
        ai_video_audio_enabled: options.ai_video_audio_enabled,
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
    const insufficient = !!(bal && !bal.sufficient_for_high);

    // Selection details (quality_tier / duration / orientation / voice / model)
    // are already shown as chips in the option-bubble row above this preview,
    // so we only render the cost + balance summary here.
    if (!est && !bal && !loading) return null;

    // Visual weight bumped intentionally — the previous neutral `text-[11px]`
    // strip was being missed by users who only discovered the cost at the
    // confirmation modal. Amber pill makes "this is the price tag" obvious
    // at a glance; insufficient balance flips to red.
    return (
        <div className="flex flex-wrap items-center justify-end gap-2 text-xs">
            {loading && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
            {est && (
                <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-0.5 font-semibold text-amber-900 ring-1 ring-amber-200">
                    <Coins className="size-3.5 text-amber-600" />~{fmtCredits(est.expected_credits)}{' '}
                    credits
                    <span className="font-normal text-amber-700">
                        ({fmtCredits(est.low_credits)}–{fmtCredits(est.high_credits)})
                    </span>
                </span>
            )}
            {bal && bal.current != null && (
                <span
                    className={
                        insufficient
                            ? 'inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 font-semibold text-red-700 ring-1 ring-red-200'
                            : 'inline-flex items-center gap-1 px-1 text-muted-foreground'
                    }
                >
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
                                            </tr>
                                        ))}
                                        <tr className="border-t font-semibold">
                                            <td>
                                                Expected total
                                                <div className="text-[11px] font-normal text-muted-foreground">
                                                    Range: {fmtCredits(est.low_credits)}–
                                                    {fmtCredits(est.high_credits)} credits
                                                </div>
                                            </td>
                                            <td className="text-right tabular-nums">
                                                {fmtCredits(est.expected_credits)}
                                            </td>
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
