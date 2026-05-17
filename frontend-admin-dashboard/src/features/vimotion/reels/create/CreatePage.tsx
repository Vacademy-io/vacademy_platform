/**
 * `/vim/reels/new` page — Gate 1 + Gate 2 + Gate 3 entry point.
 *
 * State machine:
 *   `picking`   — show AssetPickerStep (unless `?fromAssetId` was provided)
 *   `scanning`  — useScan is in flight against the picked asset
 *   `results`   — ScanResultsGrid with multi-select
 *   `previewing` — PreviewTray drawer (slice 3)
 *
 * Slice 2 ships through `results`. Selecting candidates + clicking Preview
 * toasts a placeholder for now; slice 3 wires the drawer.
 */
import { useMemo, useState } from 'react';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { AlertCircle, ChevronLeft, Loader2, Sparkles } from 'lucide-react';
import { getInstituteId } from '@/constants/helper';
import { useVimotionApiKey } from '../../dashboard/hooks/useVimotionApiKey';
import { useScan } from '../hooks/useScan';
import type { ReelCandidate } from '../services/reels-api';
import { AssetPickerStep } from './AssetPickerStep';
import { VimotionLoader } from '../../brand/VimotionLoader';
import { PreviewTray } from './PreviewTray';
import { ScanResultsGrid } from './ScanResultsGrid';
import { ScanSettingsStrip } from './ScanSettingsStrip';

interface CreatePageSearch {
    fromAssetId?: string;
}

export function CreatePage() {
    const navigate = useNavigate();
    const search = useSearch({ strict: false }) as CreatePageSearch;
    const instituteId = getInstituteId();
    const apiKey = useVimotionApiKey(instituteId);

    // The asset id IS the step indicator: null → picker, set → scanning/results.
    // Initialized from the optional `fromAssetId` deep-link param (set by the
    // "Create Reels from this" CTA on AssetDetailPanel — slice 5).
    const [pickedAssetId, setPickedAssetId] = useState<string | null>(
        search.fromAssetId ?? null
    );

    // Scan-time config. Every field here participates in the backend's
    // `config_hash`, so changing any triggers a fresh `/scan` (TanStack
    // Query re-keys on these). Selected candidate_ids become invalid when
    // the scan re-runs — we reset `previewIds` below.
    const [targetDurationSec, setTargetDurationSec] = useState<number>(25);
    const [scanLimit, setScanLimit] = useState<number>(30);
    const [topicKeywords, setTopicKeywords] = useState<string[]>([]);

    const scan = useScan({
        apiKey: apiKey.data,
        inputAssetId: pickedAssetId ?? undefined,
        targetDurationSec,
        scanLimit,
        topicKeywords,
    });

    // Preview drawer state — opens with the user's selection from the grid.
    const [previewIds, setPreviewIds] = useState<string[]>([]);
    const [previewOpen, setPreviewOpen] = useState(false);

    // Single entry point for scan-settings changes. Clearing `previewIds`
    // here is important: any candidate_ids that were in flight reference
    // the OLD scan's rows, which won't be in the new scan's response.
    const onScanSettingsChange = (patch: {
        targetDurationSec?: number;
        scanLimit?: number;
        topicKeywords?: string[];
    }) => {
        if (patch.targetDurationSec !== undefined) {
            setTargetDurationSec(patch.targetDurationSec);
        }
        if (patch.scanLimit !== undefined) {
            setScanLimit(patch.scanLimit);
        }
        if (patch.topicKeywords !== undefined) {
            setTopicKeywords(patch.topicKeywords);
        }
        setPreviewIds([]);
        setPreviewOpen(false);
    };

    const goBackToDashboard = () => {
        navigate({ to: '/vim/dashboard', search: { tab: 'reels' } });
    };

    const onPreview = (candidateIds: string[]) => {
        setPreviewIds(candidateIds);
        setPreviewOpen(true);
    };

    // PreviewTray needs the original ReelCandidate per id to render
    // accurate cut-plan timelines (we need source_t_start/source_t_end for
    // the 0..100% domain). Index for O(1) lookup.
    const candidatesById = useMemo(() => {
        const map = new Map<string, ReelCandidate>();
        for (const c of scan.data?.candidates ?? []) {
            map.set(c.candidate_id, c);
        }
        return map;
    }, [scan.data]);

    // --- Render branches --------------------------------------------------

    return (
        <div className="min-h-screen bg-[#FAFAF7]">
            <header className="border-b border-neutral-200 bg-white">
                <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-3">
                    <button
                        type="button"
                        onClick={goBackToDashboard}
                        className="inline-flex items-center gap-1 rounded-md p-1 text-sm text-neutral-600 hover:bg-neutral-100"
                    >
                        <ChevronLeft className="size-4" />
                        Reels
                    </button>
                    <div className="h-4 w-px bg-neutral-200" />
                    <h1 className="text-sm font-semibold text-neutral-900">Create a reel</h1>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-6 py-8">
                {apiKey.isError ? (
                    <ErrorPanel message="Could not connect to the video service. Please try again." />
                ) : apiKey.isLoading || !apiKey.data ? (
                    <CenteredLoader message="Preparing your studio…" />
                ) : !pickedAssetId ? (
                    <AssetPickerStep apiKey={apiKey.data} onPick={setPickedAssetId} />
                ) : (
                    <div className="space-y-5">
                        {/* Scan settings — always visible once an asset is
                            picked. Lets the user pivot duration / candidate
                            count without bouncing back to the asset picker.
                            Disabled while the scan itself is in flight to
                            prevent racing query keys. */}
                        <ScanSettingsStrip
                            targetDurationSec={targetDurationSec}
                            scanLimit={scanLimit}
                            topicKeywords={topicKeywords}
                            onChange={onScanSettingsChange}
                            busy={scan.isLoading || scan.isFetching}
                        />

                        {scan.isLoading ? (
                            <ScanningPanel onCancel={() => setPickedAssetId(null)} />
                        ) : scan.isError ? (
                            <ScanErrorPanel
                                message={scan.error?.message ?? 'Scan failed'}
                                onRetry={() => scan.refetch()}
                                onChangeSource={() => setPickedAssetId(null)}
                            />
                        ) : scan.data ? (
                            <ScanResultsGrid
                                candidates={scan.data.candidates}
                                onPreview={onPreview}
                                onBack={
                                    search.fromAssetId
                                        ? undefined
                                        : () => setPickedAssetId(null)
                                }
                            />
                        ) : null}
                    </div>
                )}
            </main>

            {/* Drawer lives at the page level so it can overlay the grid. */}
            {pickedAssetId && (
                <PreviewTray
                    open={previewOpen}
                    onClose={() => setPreviewOpen(false)}
                    apiKey={apiKey.data}
                    inputAssetId={pickedAssetId}
                    candidatesById={candidatesById}
                    candidateIds={previewIds}
                />
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Sub-views — kept inline because they're cosmetic and tightly coupled to
// the page's state machine. If they grow, split into their own files.
// ---------------------------------------------------------------------------

function CenteredLoader({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-neutral-500">
            <VimotionLoader size={56} className="text-neutral-900" label={message} />
            <p>{message}</p>
        </div>
    );
}

function ScanningPanel({ onCancel }: { onCancel: () => void }) {
    return (
        <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-primary-50 ring-1 ring-primary-100">
                <Sparkles className="size-5 text-primary-500" />
            </div>
            <h2 className="mt-5 text-lg font-semibold text-neutral-900">
                Finding engaging moments…
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">
                We’re scoring every candidate window against hook, pacing, info-density and
                loop-quality. Usually under a second.
            </p>
            <div className="mt-6 flex items-center justify-center gap-2 text-sm text-neutral-500">
                <Loader2 className="size-4 animate-spin" />
                Scanning
            </div>
            <button
                type="button"
                onClick={onCancel}
                className="mt-6 inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-200 px-3 text-sm font-medium hover:bg-neutral-50"
            >
                Pick a different video
            </button>
        </div>
    );
}

function ScanErrorPanel({
    message,
    onRetry,
    onChangeSource,
}: {
    message: string;
    onRetry: () => void;
    onChangeSource: () => void;
}) {
    return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 size-5 text-red-600" />
                <div className="flex-1">
                    <h3 className="text-sm font-semibold text-red-800">Couldn’t scan this video</h3>
                    <p className="mt-1 text-sm text-red-700">{message}</p>
                    <div className="mt-4 flex gap-2">
                        <button
                            type="button"
                            onClick={onRetry}
                            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-red-600 px-3 text-sm font-medium text-white hover:bg-red-700"
                        >
                            Retry
                        </button>
                        <button
                            type="button"
                            onClick={onChangeSource}
                            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 text-sm font-medium text-red-700 hover:bg-red-50"
                        >
                            Pick a different video
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ErrorPanel({ message }: { message: string }) {
    return (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
            <div className="flex items-center gap-2 font-medium">
                <AlertCircle className="size-4" />
                {message}
            </div>
        </div>
    );
}
