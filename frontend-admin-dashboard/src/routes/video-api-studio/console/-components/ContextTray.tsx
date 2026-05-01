import { Globe, Sparkles, Volume2, Layers, FileText, ImageIcon, X, Mic } from 'lucide-react';
import { RoutingPlan, RoutingToolName } from '../../-services/video-generation';

export interface AttachmentItem {
    fileId: string;
    fileName: string;
    fileType: 'image' | 'pdf';
    url: string;
    previewUrl?: string;
}

export interface IndexedVideoItem {
    id: string;
    name: string;
    mode: string;
    duration_seconds: number | null;
    status: string;
    progress?: number;
}

interface ContextTrayProps {
    /* Refs / attachments */
    attachments: AttachmentItem[];
    onRemoveAttachment: (fileId: string) => void;

    /* Selected source videos */
    selectedInputVideoIds: string[];
    indexedVideos: IndexedVideoItem[];
    onRemoveInputVideo: (id: string) => void;

    /* Audio source for selected source videos */
    inputVideoAudio: 'original' | 'tts';
    onInputVideoAudioChange: (mode: 'original' | 'tts') => void;
    muteTtsDuringSourceClips: boolean;
    onMuteTtsDuringSourceClipsChange: (mute: boolean) => void;

    /* Smart Plan */
    routerPlan: RoutingPlan | null;
    routerLoading: boolean;
    isToolEnabled: (name: RoutingToolName) => boolean;
    isToolOverridden: (name: RoutingToolName) => boolean;
    onToggleTool: (name: RoutingToolName) => void;
    cfgValue: <K extends 'mute_tts_on_source_clips' | 'infographic_mode'>(
        key: K
    ) => K extends 'infographic_mode' ? 'overlay' | 'side' : boolean;
    isCfgOverridden: (key: 'mute_tts_on_source_clips' | 'infographic_mode') => boolean;
    onToggleMuteTtsCfg: () => void;
    onToggleOverlayCfg: () => void;
    routerExplanationOpen: boolean;
    onToggleRouterExplanation: () => void;

    /* Web capture (URL detection) */
    detectedUrls: string[];
    ignoredUrls: Set<string>;
    onSetUrlIgnored: (url: string, ignored: boolean) => void;
}

export function ContextTray(props: ContextTrayProps) {
    const { attachments, selectedInputVideoIds, routerPlan, routerLoading, detectedUrls } = props;

    // Hide entire tray when nothing is active
    const hasAny =
        attachments.length > 0 ||
        selectedInputVideoIds.length > 0 ||
        !!routerPlan ||
        routerLoading ||
        detectedUrls.length > 0;
    if (!hasAny) return null;

    return (
        <div className="space-y-1.5">
            <RefsRow attachments={attachments} onRemove={props.onRemoveAttachment} />
            <SourcesRow
                selectedIds={selectedInputVideoIds}
                indexedVideos={props.indexedVideos}
                onRemove={props.onRemoveInputVideo}
            />
            <AudioSourceRow
                hasSources={selectedInputVideoIds.length > 0}
                singleSource={selectedInputVideoIds.length === 1}
                inputVideoAudio={props.inputVideoAudio}
                onInputVideoAudioChange={props.onInputVideoAudioChange}
                muteTtsDuringSourceClips={props.muteTtsDuringSourceClips}
                onMuteTtsDuringSourceClipsChange={props.onMuteTtsDuringSourceClipsChange}
            />
            <SmartPlanRow {...props} />
            <WebCaptureRow
                detectedUrls={detectedUrls}
                ignoredUrls={props.ignoredUrls}
                onSetIgnored={props.onSetUrlIgnored}
            />
        </div>
    );
}

function AudioSourceRow({
    hasSources,
    singleSource,
    inputVideoAudio,
    onInputVideoAudioChange,
    muteTtsDuringSourceClips,
    onMuteTtsDuringSourceClipsChange,
}: {
    hasSources: boolean;
    singleSource: boolean;
    inputVideoAudio: 'original' | 'tts';
    onInputVideoAudioChange: (mode: 'original' | 'tts') => void;
    muteTtsDuringSourceClips: boolean;
    onMuteTtsDuringSourceClipsChange: (mute: boolean) => void;
}) {
    if (!hasSources) return null;
    // Original-audio mode is only meaningful for a single source clip — with
    // multiple clips, the mix is ambiguous, so we force TTS narration.
    const originalAvailable = singleSource;
    return (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50/30 px-2 py-1.5 dark:border-indigo-800 dark:bg-indigo-950/20">
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-indigo-500">
                Audio
            </span>
            <div className="inline-flex shrink-0 rounded-md border bg-background p-0.5">
                <button
                    type="button"
                    disabled={!originalAvailable}
                    onClick={() => originalAvailable && onInputVideoAudioChange('original')}
                    title={
                        originalAvailable
                            ? 'Use the original audio from your source clip'
                            : 'Original audio is only available with a single source clip'
                    }
                    className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors ${
                        inputVideoAudio === 'original'
                            ? 'bg-indigo-500 text-white shadow-sm'
                            : originalAvailable
                              ? 'text-muted-foreground hover:text-foreground'
                              : 'cursor-not-allowed text-muted-foreground/40'
                    }`}
                >
                    <Volume2 className="size-3" />
                    Original
                </button>
                <button
                    type="button"
                    onClick={() => onInputVideoAudioChange('tts')}
                    className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs font-medium transition-colors ${
                        inputVideoAudio === 'tts'
                            ? 'bg-indigo-500 text-white shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Mic className="size-3" />
                    AI Narration
                </button>
            </div>
            {/* Secondary toggle — only meaningful when TTS is the primary track */}
            {inputVideoAudio === 'tts' && (
                <label className="flex shrink-0 cursor-pointer items-center gap-1.5 text-[11px] text-muted-foreground">
                    <input
                        type="checkbox"
                        className="size-3 rounded border-border accent-indigo-500"
                        checked={muteTtsDuringSourceClips}
                        onChange={(e) => onMuteTtsDuringSourceClipsChange(e.target.checked)}
                    />
                    Mute TTS during source clips
                </label>
            )}
        </div>
    );
}

/* ============================================================ */
/*  Sub-rows                                                    */
/* ============================================================ */

function RefsRow({
    attachments,
    onRemove,
}: {
    attachments: AttachmentItem[];
    onRemove: (fileId: string) => void;
}) {
    if (attachments.length === 0) return null;
    return (
        <div className="flex items-center gap-2 rounded-md border bg-muted/20 px-2 py-1.5">
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Refs ({attachments.length})
            </span>
            <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
                {attachments.map((a) => (
                    <div
                        key={a.fileId}
                        className="group flex shrink-0 items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"
                        title={a.fileName}
                    >
                        {a.fileType === 'image' ? (
                            a.previewUrl ? (
                                <img
                                    src={a.previewUrl}
                                    alt={a.fileName}
                                    className="size-6 rounded object-cover"
                                />
                            ) : (
                                <ImageIcon className="size-4 text-blue-500" />
                            )
                        ) : (
                            <FileText className="size-4 text-red-500" />
                        )}
                        <span className="max-w-[100px] truncate">{a.fileName}</span>
                        <button
                            type="button"
                            onClick={() => onRemove(a.fileId)}
                            className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                            aria-label={`Remove ${a.fileName}`}
                        >
                            <X className="size-3.5" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function SourcesRow({
    selectedIds,
    indexedVideos,
    onRemove,
}: {
    selectedIds: string[];
    indexedVideos: IndexedVideoItem[];
    onRemove: (id: string) => void;
}) {
    if (selectedIds.length === 0) return null;
    return (
        <div className="flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50/30 px-2 py-1.5 dark:border-indigo-800 dark:bg-indigo-950/20">
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-indigo-500">
                Sources ({selectedIds.length})
            </span>
            <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
                {selectedIds.map((id, idx) => {
                    const video = indexedVideos.find((v) => v.id === id);
                    const label = String.fromCharCode(65 + idx);
                    return (
                        <div
                            key={id}
                            className="group flex shrink-0 items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"
                            title={video?.name || id}
                        >
                            <span className="flex size-4 items-center justify-center rounded-sm bg-indigo-500 text-[9px] font-bold text-white">
                                {label}
                            </span>
                            <span className="max-w-[120px] truncate font-medium">
                                {video?.name || 'Unknown'}
                            </span>
                            <span className="text-muted-foreground">{video?.mode}</span>
                            <button
                                type="button"
                                onClick={() => onRemove(id)}
                                className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                                aria-label={`Remove ${video?.name}`}
                            >
                                <X className="size-3.5" />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function SmartPlanRow(props: ContextTrayProps) {
    const {
        routerPlan,
        routerLoading,
        selectedInputVideoIds,
        isToolEnabled,
        isToolOverridden,
        onToggleTool,
        cfgValue,
        isCfgOverridden,
        onToggleMuteTtsCfg,
        onToggleOverlayCfg,
        routerExplanationOpen,
        onToggleRouterExplanation,
    } = props;

    if (!routerPlan && !routerLoading) return null;

    return (
        <div className="flex flex-col gap-1.5 rounded-md border border-violet-200 bg-violet-50/30 px-2 py-1.5 dark:border-violet-800 dark:bg-violet-950/20">
            <div className="flex flex-wrap items-center gap-1.5">
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-violet-600">
                    Smart plan
                </span>
                {routerLoading && !routerPlan && (
                    <span className="text-[11px] text-muted-foreground">analyzing prompt…</span>
                )}
                {routerPlan?.tools?.find((t) => t.name === 'scrape_url') && (
                    <button
                        type="button"
                        onClick={() => onToggleTool('scrape_url')}
                        className={`group flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${
                            isToolEnabled('scrape_url')
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40'
                                : 'border-dashed bg-muted/30 text-muted-foreground'
                        }`}
                        title={routerPlan.tools.find((t) => t.name === 'scrape_url')?.reason || ''}
                    >
                        <Globe className="size-3.5" />
                        <span>
                            {isToolEnabled('scrape_url') ? 'Capture website' : 'Skip website'}
                        </span>
                        <span
                            className={`ml-1 rounded px-1 text-[9px] uppercase ${
                                isToolOverridden('scrape_url')
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                    : 'bg-muted text-muted-foreground'
                            }`}
                        >
                            {isToolOverridden('scrape_url') ? 'manual' : 'auto'}
                        </span>
                    </button>
                )}
                {routerPlan?.tools?.find((t) => t.name === 'web_search') && (
                    <button
                        type="button"
                        onClick={() => onToggleTool('web_search')}
                        className={`group flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${
                            isToolEnabled('web_search')
                                ? 'border-sky-300 bg-sky-50 text-sky-700 dark:bg-sky-950/40'
                                : 'border-dashed bg-muted/30 text-muted-foreground'
                        }`}
                        title={routerPlan.tools.find((t) => t.name === 'web_search')?.reason || ''}
                    >
                        <Sparkles className="size-3.5" />
                        <span>{isToolEnabled('web_search') ? 'Web search' : 'Skip search'}</span>
                        <span
                            className={`ml-1 rounded px-1 text-[9px] uppercase ${
                                isToolOverridden('web_search')
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                    : 'bg-muted text-muted-foreground'
                            }`}
                        >
                            {isToolOverridden('web_search') ? 'manual' : 'auto'}
                        </span>
                    </button>
                )}
                {selectedInputVideoIds.length > 0 && routerPlan && (
                    <button
                        type="button"
                        onClick={onToggleMuteTtsCfg}
                        className={`group flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${
                            cfgValue('mute_tts_on_source_clips')
                                ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40'
                                : 'border-dashed bg-muted/30 text-muted-foreground'
                        }`}
                        title="Mute TTS narration during source-clip shots so the demo's original audio plays"
                    >
                        <Volume2 className="size-3.5" />
                        <span>
                            {cfgValue('mute_tts_on_source_clips')
                                ? 'Mute TTS on clips'
                                : 'TTS over clips'}
                        </span>
                        <span
                            className={`ml-1 rounded px-1 text-[9px] uppercase ${
                                isCfgOverridden('mute_tts_on_source_clips')
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                    : 'bg-muted text-muted-foreground'
                            }`}
                        >
                            {isCfgOverridden('mute_tts_on_source_clips') ? 'manual' : 'auto'}
                        </span>
                    </button>
                )}
                {selectedInputVideoIds.length > 0 && routerPlan && (
                    <button
                        type="button"
                        onClick={onToggleOverlayCfg}
                        className={`group flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${
                            cfgValue('infographic_mode') === 'overlay'
                                ? 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/40'
                                : 'border-dashed bg-muted/30 text-muted-foreground'
                        }`}
                        title="Float infographics over the demo footage (vs. side-by-side card)"
                    >
                        <Layers className="size-3.5" />
                        <span>
                            {cfgValue('infographic_mode') === 'overlay'
                                ? 'Overlay infographics'
                                : 'Side infographics'}
                        </span>
                        <span
                            className={`ml-1 rounded px-1 text-[9px] uppercase ${
                                isCfgOverridden('infographic_mode')
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                    : 'bg-muted text-muted-foreground'
                            }`}
                        >
                            {isCfgOverridden('infographic_mode') ? 'manual' : 'auto'}
                        </span>
                    </button>
                )}
                {routerPlan?.explanation && (
                    <button
                        type="button"
                        onClick={onToggleRouterExplanation}
                        className="ml-auto shrink-0 text-[11px] text-violet-600 hover:underline"
                    >
                        {routerExplanationOpen ? 'Hide why ▴' : 'Why? ▾'}
                    </button>
                )}
            </div>
            {routerExplanationOpen && routerPlan?.explanation && (
                <div className="rounded bg-background/60 p-2 text-[11px] leading-relaxed text-muted-foreground">
                    {routerPlan.explanation}
                </div>
            )}
        </div>
    );
}

function WebCaptureRow({
    detectedUrls,
    ignoredUrls,
    onSetIgnored,
}: {
    detectedUrls: string[];
    ignoredUrls: Set<string>;
    onSetIgnored: (url: string, ignored: boolean) => void;
}) {
    if (detectedUrls.length === 0) return null;
    return (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50/30 px-2 py-1.5 dark:border-emerald-800 dark:bg-emerald-950/20">
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-emerald-600">
                Web capture
            </span>
            <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
                {detectedUrls.map((url) => {
                    let host = url;
                    try {
                        host = new URL(url).host.replace(/^www\./, '');
                    } catch {
                        /* noop */
                    }
                    const isIgnored = ignoredUrls.has(url);
                    return (
                        <div
                            key={url}
                            className={`group flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
                                isIgnored
                                    ? 'border-dashed bg-muted/30 text-muted-foreground line-through'
                                    : 'bg-background'
                            }`}
                            title={
                                isIgnored
                                    ? `${url} — ignored (still in prompt, not captured)`
                                    : `${url} — screenshots + images will be captured and used as references`
                            }
                        >
                            <Globe className="size-3.5 text-emerald-600" />
                            <span className="max-w-[160px] truncate font-medium">{host}</span>
                            {isIgnored ? (
                                <button
                                    type="button"
                                    onClick={() => onSetIgnored(url, false)}
                                    className="ml-0.5 rounded-full px-1 text-[10px] text-muted-foreground hover:text-emerald-600"
                                    aria-label={`Re-enable capture for ${host}`}
                                >
                                    undo
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => onSetIgnored(url, true)}
                                    className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                                    aria-label={`Skip capture for ${host}`}
                                >
                                    <X className="size-3.5" />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
