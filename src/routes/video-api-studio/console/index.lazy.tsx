import { useState, useEffect, useCallback, useRef } from 'react';
import { createLazyFileRoute } from '@tanstack/react-router';
import { LayoutContainer } from '@/components/common/layout-container/layout-container';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Video, Loader2, History as HistoryIcon } from 'lucide-react';
import { toast } from 'sonner';
import { getInstituteId } from '@/constants/helper';
import {
    listApiKeys,
    ApiKey,
    getFirstAvailableFullKey,
    generateApiKey,
    storeFullApiKey,
} from '../-services/api-keys';
import {
    GenerateVideoRequest,
    HistoryItem,
    VideoStage,
    SSEEvent,
    ContentType,
    generateVideo,
    getVideoUrls,
    getRemoteHistory,
} from '../-services/video-generation';
import { HistorySidebar } from '../-components/HistorySidebar';
import { PromptInput } from '../-components/PromptInput';
import { GenerationProgress } from '../-components/GenerationProgress';
import { VideoResult } from '../-components/VideoResult';
import { ContentSelector } from '../-components/ContentSelector';
import { DEFAULT_OPTIONS } from '../-services/video-generation';

export const Route = createLazyFileRoute('/video-api-studio/console/')({
    component: VideoConsole,
});

type ConsoleState = 'idle' | 'generating' | 'complete';

interface CurrentGeneration {
    videoId: string;
    prompt: string;
    contentType: ContentType;
    stage: VideoStage;
    percentage: number;
    message: string;
    htmlUrl?: string;
    audioUrl?: string;
    wordsUrl?: string;
    scriptUrl?: string;
    options: Omit<GenerateVideoRequest, 'prompt'>;
}

/** Persisted across page navigations so polling can resume after SSE disconnect */
const PENDING_GENERATION_KEY = 'video-console-pending-gen';

/** Content types that produce no audio — html_url alone is sufficient for "complete" */
const NO_AUDIO_TYPES = new Set<ContentType>(['SLIDES']);
const needsAudio = (contentType?: ContentType | string) =>
    !NO_AUDIO_TYPES.has(contentType as ContentType);

interface PendingGeneration {
    videoId: string;
    prompt: string;
    contentType: ContentType;
    options: Omit<GenerateVideoRequest, 'prompt'>;
}

function VideoConsole() {
    const instituteId = getInstituteId();

    const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
    const [isLoadingKeys, setIsLoadingKeys] = useState(true);
    const [isAutoGenerating, setIsAutoGenerating] = useState(false);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
    const [consoleState, setConsoleState] = useState<ConsoleState>('idle');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isMobileHistoryOpen, setIsMobileHistoryOpen] = useState(false);

    // Lifted state for prompt and options
    const [prompt, setPrompt] = useState(() => localStorage.getItem('video-studio-prompt') || '');
    const [options, setOptions] = useState<Omit<GenerateVideoRequest, 'prompt'>>(() => {
        const saved = localStorage.getItem('video-studio-options');
        if (saved) {
            try {
                return { ...DEFAULT_OPTIONS, ...JSON.parse(saved) };
            } catch (e) {
                console.error('Failed to parse saved options:', e);
                return DEFAULT_OPTIONS;
            }
        }
        return DEFAULT_OPTIONS;
    });

    // Persist prompt and options
    useEffect(() => {
        localStorage.setItem('video-studio-prompt', prompt);
    }, [prompt]);

    useEffect(() => {
        localStorage.setItem('video-studio-options', JSON.stringify(options));
    }, [options]);

    const [currentGeneration, setCurrentGeneration] = useState<CurrentGeneration | null>(null);
    const [isLoadingVideoUrls, setIsLoadingVideoUrls] = useState(false);

    const abortRef = useRef<(() => void) | null>(null);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load API keys
    useEffect(() => {
        const loadKeys = async () => {
            if (!instituteId) return;
            setIsLoadingKeys(true);
            try {
                const keys = await listApiKeys(instituteId);
                setApiKeys(keys.filter((k) => k.status === 'active'));
            } catch (error) {
                console.error('Error loading API keys:', error);
            } finally {
                setIsLoadingKeys(false);
            }
        };
        loadKeys();
    }, [instituteId]);

    // Auto-generate API key if none available
    useEffect(() => {
        const activeKey = getFirstAvailableFullKey(apiKeys);
        if (!isLoadingKeys && !activeKey && !isAutoGenerating && instituteId) {
            const autoGenerate = async () => {
                setIsAutoGenerating(true);
                try {
                    const newKeyName = `Console Key ${new Date().toLocaleDateString()}`;
                    const result = await generateApiKey(instituteId, newKeyName);
                    storeFullApiKey(result.id, result.key);

                    // Refresh keys
                    const keys = await listApiKeys(instituteId);
                    setApiKeys(keys.filter((k) => k.status === 'active'));
                    toast.success('Automatically generated API key for console');
                } catch (error) {
                    console.error('Error auto-generating key:', error);
                    // Don't show toast here as the error screen will show up
                } finally {
                    setIsAutoGenerating(false);
                }
            };
            autoGenerate();
        }
    }, [isLoadingKeys, apiKeys, instituteId, isAutoGenerating]);

    // Get the full API key from localStorage (stored when key was generated)
    const activeApiKey = getFirstAvailableFullKey(apiKeys);

    // Load history
    useEffect(() => {
        const fetchHistory = async () => {
            if (!activeApiKey) return;
            try {
                const remoteHistory = await getRemoteHistory(activeApiKey);
                setHistory(remoteHistory);
            } catch (error) {
                console.error('Failed to load history:', error);
                // Fallback to local if remote fails needed? For now just log error
                // setHistory(getHistory());
            }
        };

        fetchHistory();

        // Poll for updates every 10 seconds if there are pending items
        const interval = setInterval(() => {
            fetchHistory();
        }, 10000);

        return () => clearInterval(interval);
    }, [activeApiKey]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortRef.current) abortRef.current();
            if (pollingRef.current) clearInterval(pollingRef.current);
        };
    }, []);

    /**
     * Poll /urls/{videoId} until html_url + audio_url are available.
     * Used when SSE connection is lost (page navigation) or when opening a
     * still-generating history item.
     */
    const startPollingForVideo = useCallback(
        (pending: PendingGeneration, apiKey: string) => {
            // Cancel any existing poll
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }

            setConsoleState('generating');
            setSelectedHistoryId(pending.videoId);
            setCurrentGeneration({
                videoId: pending.videoId,
                prompt: pending.prompt,
                contentType: pending.contentType,
                stage: 'PENDING',
                percentage: 0,
                message: 'Reconnecting… checking generation status',
                options: pending.options,
            });

            let pollCount = 0;
            // Stop polling after ~12 minutes (72 × 10 s) — server restart or stuck job
            const MAX_POLL_ATTEMPTS = 72;

            const poll = async () => {
                pollCount++;

                if (pollCount > MAX_POLL_ATTEMPTS) {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    pollingRef.current = null;
                    localStorage.removeItem(PENDING_GENERATION_KEY);
                    setConsoleState('idle');
                    setCurrentGeneration(null);
                    toast.error(
                        'Generation is taking longer than expected. Please check history for updates or try again.'
                    );
                    return;
                }

                try {
                    const urls = await getVideoUrls(pending.videoId, apiKey);

                    if (urls.html_url && (urls.audio_url || !needsAudio(pending.contentType))) {
                        // Success — content is ready
                        if (pollingRef.current) clearInterval(pollingRef.current);
                        pollingRef.current = null;
                        localStorage.removeItem(PENDING_GENERATION_KEY);
                        setCurrentGeneration((prev) =>
                            prev
                                ? {
                                      ...prev,
                                      stage: urls.current_stage || 'HTML',
                                      percentage: 100,
                                      message: '',
                                      htmlUrl: urls.html_url!,
                                      audioUrl: urls.audio_url ?? undefined,
                                      wordsUrl: urls.words_url ?? undefined,
                                  }
                                : null
                        );
                        setConsoleState('complete');
                        toast.success('Content is ready!');
                    } else if (urls.status === 'FAILED') {
                        // Backend marked the job as failed
                        if (pollingRef.current) clearInterval(pollingRef.current);
                        pollingRef.current = null;
                        localStorage.removeItem(PENDING_GENERATION_KEY);
                        setConsoleState('idle');
                        setCurrentGeneration(null);
                        toast.error('Content generation failed. Please try again.');
                    } else if (urls.status === 'COMPLETED' && !urls.html_url) {
                        // Completed at a partial stage (e.g. script-only) — no visual content
                        if (pollingRef.current) clearInterval(pollingRef.current);
                        pollingRef.current = null;
                        localStorage.removeItem(PENDING_GENERATION_KEY);
                        setConsoleState('idle');
                        setCurrentGeneration(null);
                        toast.info(
                            'Generation completed but no visual content was produced. The content may only have a script.'
                        );
                    }
                    // Otherwise still IN_PROGRESS — keep polling
                } catch (err) {
                    console.warn('[Polling] Error fetching video URLs:', err);
                }
            };

            poll(); // immediate first check
            pollingRef.current = setInterval(poll, 10_000);
        },
        []
    );

    /**
     * On mount: if we previously stored a pending generation (SSE dropped),
     * resume polling so the user doesn't see a blank screen.
     */
    useEffect(() => {
        if (!activeApiKey) return;
        // Don't interrupt an active SSE session
        if (consoleState === 'generating') return;

        const raw = localStorage.getItem(PENDING_GENERATION_KEY);
        if (!raw) return;

        try {
            const pending: PendingGeneration = JSON.parse(raw);
            startPollingForVideo(pending, activeApiKey);
        } catch {
            localStorage.removeItem(PENDING_GENERATION_KEY);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeApiKey]); // intentionally run only when key first becomes available

    const handleGenerate = useCallback(
        async (request: GenerateVideoRequest) => {
            if (!activeApiKey) {
                toast.error('No API key available');
                return;
            }

            // Cancel any active poll (new generation takes over)
            if (pollingRef.current) {
                clearInterval(pollingRef.current);
                pollingRef.current = null;
            }

            // Reset state
            setConsoleState('generating');
            setSelectedHistoryId(null);

            const contentType = request.content_type || 'VIDEO';

            const updateHistoryState = (newItem: HistoryItem) => {
                setHistory((prev) => {
                    const index = prev.findIndex((h) => h.video_id === newItem.video_id);
                    if (index >= 0) {
                        const newHistory = [...prev];
                        newHistory[index] = { ...prev[index], ...newItem };
                        return newHistory;
                    } else {
                        return [newItem, ...prev];
                    }
                });
            };

            const { abort, videoId } = generateVideo(
                request,
                activeApiKey,
                (event: SSEEvent) => {
                    if (event.type === 'progress') {
                        // Extract URLs from files if available
                        const audioUrl = event.files?.audio?.s3_url;
                        const timelineUrl = event.files?.timeline?.s3_url;
                        const wordsUrl = event.files?.words?.s3_url;
                        const scriptUrl = event.files?.script?.s3_url;

                        setCurrentGeneration((prev) => ({
                            videoId,
                            prompt: request.prompt,
                            contentType,
                            stage: event.stage,
                            percentage: event.percentage,
                            message: event.message,
                            htmlUrl: timelineUrl || prev?.htmlUrl,
                            audioUrl: audioUrl || prev?.audioUrl,
                            wordsUrl: wordsUrl || prev?.wordsUrl,
                            scriptUrl: scriptUrl || prev?.scriptUrl,
                            options: {
                                content_type: contentType,
                                language: request.language,
                                voice_gender: request.voice_gender,
                                tts_provider: request.tts_provider,
                                captions_enabled: request.captions_enabled,
                                html_quality: request.html_quality,
                                target_audience: request.target_audience,
                                target_duration: request.target_duration,
                                model: request.model,
                            },
                        }));

                        // Update history in state
                        updateHistoryState({
                            id: videoId,
                            video_id: videoId,
                            prompt: request.prompt,
                            content_type: contentType,
                            status: 'generating',
                            stage: event.stage,
                            created_at: new Date().toISOString(),
                            html_url: timelineUrl,
                            audio_url: audioUrl,
                            words_url: wordsUrl,
                            options: {
                                content_type: contentType,
                                language: request.language,
                                voice_gender: request.voice_gender,
                                tts_provider: request.tts_provider,
                                captions_enabled: request.captions_enabled,
                                html_quality: request.html_quality,
                                target_audience: request.target_audience,
                                target_duration: request.target_duration,
                                model: request.model,
                            },
                        });

                        // When HTML stage is reached, show the player - content is ready
                        // Audio URL comes from TTS stage, timeline from HTML stage
                        setCurrentGeneration((prev) => {
                            if (
                                event.stage === 'HTML' &&
                                (timelineUrl || prev?.htmlUrl) &&
                                (prev?.audioUrl || !needsAudio(contentType))
                            ) {
                                // HTML stage complete = content ready, show result
                                setConsoleState('complete');
                                toast.success('Content generated successfully!');
                            }
                            return prev
                                ? {
                                      ...prev,
                                      htmlUrl: timelineUrl || prev.htmlUrl,
                                      audioUrl: audioUrl || prev.audioUrl,
                                      wordsUrl: wordsUrl || prev.wordsUrl,
                                  }
                                : null;
                        });
                    } else if (event.type === 'completed') {
                        // Content is complete
                        localStorage.removeItem(PENDING_GENERATION_KEY);
                        setConsoleState('complete');
                        toast.success('Content generated successfully!');

                        // Update history as completed
                        setCurrentGeneration((prev) =>
                            prev
                                ? {
                                      ...prev,
                                      stage: 'HTML',
                                      percentage: 100,
                                  }
                                : null
                        );

                        updateHistoryState({
                            id: videoId,
                            video_id: videoId,
                            prompt: request.prompt,
                            content_type: contentType,
                            status: 'completed',
                            stage: 'HTML',
                            created_at: new Date().toISOString(),
                            options: {
                                content_type: contentType,
                                language: request.language,
                                captions_enabled: request.captions_enabled,
                                html_quality: request.html_quality,
                                target_audience: request.target_audience,
                                voice_gender: request.voice_gender,
                                tts_provider: request.tts_provider,
                                target_duration: request.target_duration,
                                model: request.model,
                            },
                        });
                    } else if (event.type === 'error') {
                        // Check if error happened after HTML stage
                        const errorStage = event.stage;
                        const hasContent = errorStage === 'HTML';

                        setCurrentGeneration((prev) => {
                            // If we have HTML URLs, keep showing the player
                            if (prev?.htmlUrl && (prev?.audioUrl || !needsAudio(contentType)) && hasContent) {
                                localStorage.removeItem(PENDING_GENERATION_KEY);
                                toast.error(
                                    'Generation encountered an issue. Content is still available.'
                                );
                                setConsoleState('complete');
                                return {
                                    ...prev,
                                    message: 'Generation completed with issues',
                                };
                            } else {
                                localStorage.removeItem(PENDING_GENERATION_KEY);
                                toast.error(event.message || 'Generation failed');
                                setConsoleState('idle');
                                return null;
                            }
                        });

                        // Update history
                        updateHistoryState({
                            id: videoId,
                            video_id: videoId,
                            prompt: request.prompt,
                            content_type: contentType,
                            status: hasContent ? 'completed' : 'failed',
                            stage: errorStage || 'PENDING',
                            created_at: new Date().toISOString(),
                            options: {
                                content_type: contentType,
                                language: request.language,
                                captions_enabled: request.captions_enabled,
                                html_quality: request.html_quality,
                                target_audience: request.target_audience,
                                target_duration: request.target_duration,
                                voice_gender: request.voice_gender,
                                tts_provider: request.tts_provider,
                                model: request.model,
                            },
                        });
                    }
                },
                (error) => {
                    localStorage.removeItem(PENDING_GENERATION_KEY);
                    toast.error(`Generation failed: ${error.message}`);
                    setConsoleState('idle');
                }
            );

            abortRef.current = abort;

            // Persist so polling can resume if the user navigates away
            const pendingOptions = {
                content_type: contentType,
                language: request.language,
                captions_enabled: request.captions_enabled,
                html_quality: request.html_quality,
                target_audience: request.target_audience,
                voice_gender: request.voice_gender,
                tts_provider: request.tts_provider,
                target_duration: request.target_duration,
                model: request.model,
            };
            localStorage.setItem(
                PENDING_GENERATION_KEY,
                JSON.stringify({
                    videoId,
                    prompt: request.prompt,
                    contentType,
                    options: pendingOptions,
                } satisfies PendingGeneration)
            );

            // Initialize generation state
            setCurrentGeneration({
                videoId,
                prompt: request.prompt,
                contentType,
                stage: 'PENDING',
                percentage: 0,
                message: 'Starting generation...',
                options: pendingOptions,
            });

            // Save initial history entry
            updateHistoryState({
                id: videoId,
                video_id: videoId,
                prompt: request.prompt,
                content_type: contentType,
                status: 'pending',
                stage: 'PENDING',
                created_at: new Date().toISOString(),
                options: {
                    content_type: contentType,
                    language: request.language,
                    captions_enabled: request.captions_enabled,
                    html_quality: request.html_quality,
                    voice_gender: request.voice_gender,
                    tts_provider: request.tts_provider,
                    target_audience: request.target_audience,
                    target_duration: request.target_duration,
                    model: request.model,
                },
            });
        },
        [activeApiKey]
    );

    const handleSelectHistory = useCallback(
        async (item: HistoryItem) => {
            setSelectedHistoryId(item.video_id);

            // If we have URLs locally, use them directly
            if (item.html_url && (item.audio_url || !needsAudio(item.content_type))) {
                setCurrentGeneration({
                    videoId: item.video_id,
                    prompt: item.prompt,
                    contentType: item.content_type || 'VIDEO',
                    stage: item.stage,
                    percentage: 100,
                    message: '',
                    htmlUrl: item.html_url,
                    audioUrl: item.audio_url,
                    wordsUrl: item.words_url,
                    options: item.options,
                });
                setConsoleState('complete');
                return;
            }

            // If completed but no URLs locally, try to fetch from API
            if (
                (item.status === 'completed' || item.stage === 'HTML' || item.stage === 'RENDER') &&
                activeApiKey
            ) {
                setIsLoadingVideoUrls(true);
                setConsoleState('idle');
                setCurrentGeneration(null);

                try {
                    const urls = await getVideoUrls(item.video_id, activeApiKey);

                    // Backend can return status=COMPLETED with null URLs when the job
                    // finished a mid-stage (e.g. current_stage=SCRIPT). Only show the
                    // player when the required URLs are actually present.
                    if (!urls.html_url || (!urls.audio_url && needsAudio(item.content_type))) {
                        setIsLoadingVideoUrls(false);
                        toast.info('Content is still being generated. Waiting for completion…');
                        startPollingForVideo(
                            {
                                videoId: item.video_id,
                                prompt: item.prompt,
                                contentType: item.content_type || 'VIDEO',
                                options: item.options,
                            },
                            activeApiKey
                        );
                        return;
                    }

                    // Update history with fetched URLs
                    const updatedItem: HistoryItem = {
                        ...item,
                        html_url: urls.html_url,
                        audio_url: urls.audio_url ?? undefined,
                        words_url: urls.words_url ?? undefined,
                        status: 'completed',
                    };

                    setHistory((prev) =>
                        prev.map((h) => (h.video_id === item.video_id ? updatedItem : h))
                    );

                    setCurrentGeneration({
                        videoId: item.video_id,
                        prompt: item.prompt,
                        contentType: item.content_type || 'VIDEO',
                        stage: urls.current_stage || item.stage,
                        percentage: 100,
                        message: '',
                        htmlUrl: urls.html_url,
                        audioUrl: urls.audio_url ?? undefined,
                        wordsUrl: urls.words_url ?? undefined,
                        options: item.options,
                    });
                    setConsoleState('complete');
                    toast.success('Content loaded successfully');
                } catch (error) {
                    console.error('Failed to fetch content URLs:', error);
                    toast.error(
                        'Failed to load content details. The content may no longer be available.'
                    );
                    setConsoleState('idle');
                    setCurrentGeneration(null);
                } finally {
                    setIsLoadingVideoUrls(false);
                }
                return;
            }

            // For pending/generating items: start polling so the UI stays alive
            if ((item.status === 'generating' || item.status === 'pending') && activeApiKey) {
                startPollingForVideo(
                    {
                        videoId: item.video_id,
                        prompt: item.prompt,
                        contentType: item.content_type || 'VIDEO',
                        options: item.options,
                    },
                    activeApiKey
                );
                return;
            }

            // Failed items with no content to show
            setConsoleState('idle');
            setCurrentGeneration(null);
        },
        [activeApiKey, startPollingForVideo]
    );

    const handleDeleteHistory = useCallback(
        (videoId: string) => {
            // Optimistically remove from UI
            setHistory((prev) => prev.filter((h) => h.video_id !== videoId));

            if (videoId === selectedHistoryId) {
                setSelectedHistoryId(null);
                setCurrentGeneration(null);
                setConsoleState('idle');
            }
        },
        [selectedHistoryId]
    );

    const handleNewVideo = useCallback(() => {
        if (abortRef.current) {
            abortRef.current();
            abortRef.current = null;
        }
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
        localStorage.removeItem(PENDING_GENERATION_KEY);
        setSelectedHistoryId(null);
        setCurrentGeneration(null);
        setConsoleState('idle');
    }, []);

    // No API keys or no stored full key - redirect to main page
    const hasActiveKeys = apiKeys.filter((k) => k.status === 'active').length > 0;

    if (isAutoGenerating) {
        return (
            <LayoutContainer>
                <div className="flex h-[calc(100vh-theme(spacing.20))] flex-col items-center justify-center gap-4">
                    <Loader2 className="size-12 animate-spin text-violet-600" />
                    <p className="text-muted-foreground">Setting up Content Console...</p>
                </div>
            </LayoutContainer>
        );
    }

    if (!isLoadingKeys && (!hasActiveKeys || !activeApiKey)) {
        return (
            <LayoutContainer>
                <div className="flex h-[calc(100vh-theme(spacing.20))] flex-col items-center justify-center gap-4">
                    <div className="text-center">
                        <Video className="mx-auto mb-4 size-16 text-muted-foreground" />
                        <h1 className="mb-2 text-2xl font-bold">
                            {!hasActiveKeys ? 'No API Keys Found' : 'API Key Not Available'}
                        </h1>
                        <p className="mb-6 text-muted-foreground">
                            {!hasActiveKeys
                                ? 'You need an active API key to use the Content Console'
                                : 'Please generate a new API key to use the Content Console'}
                        </p>
                        <Button onClick={() => window.history.back()}>
                            Go to API Studio
                        </Button>
                    </div>
                </div>
            </LayoutContainer>
        );
    }

    const isGenerating = consoleState === 'generating';

    return (
        <LayoutContainer
            intrnalMargin={false}
            hasInternalSidebarComponent={true}
        >
        <div className="relative flex h-[calc(100vh-56px)] w-full overflow-hidden bg-background md:h-[calc(100vh-72px)]">
            {/* Mobile History Drawer */}
            <Sheet open={isMobileHistoryOpen} onOpenChange={setIsMobileHistoryOpen}>
                <SheetContent side="left" className="w-[280px] p-0">
                    <SheetTitle className="sr-only">History</SheetTitle>
                    <HistorySidebar
                        history={history}
                        selectedId={selectedHistoryId}
                        onSelect={(item) => {
                            handleSelectHistory(item);
                            setIsMobileHistoryOpen(false);
                        }}
                        onDelete={handleDeleteHistory}
                        onNewVideo={() => {
                            handleNewVideo();
                            setIsMobileHistoryOpen(false);
                        }}
                        isCollapsed={false}
                        onToggleCollapse={() => setIsMobileHistoryOpen(false)}
                    />
                </SheetContent>
            </Sheet>

            {/* Collapsible History Sidebar (desktop only) */}
            <div
                className="hidden flex-shrink-0 flex-col border-r bg-white dark:bg-card md:flex"
                style={{
                    width: isSidebarOpen ? 280 : 48,
                    transition: 'width 0.25s ease',
                    overflow: 'hidden',
                }}
            >
                <HistorySidebar
                    history={history}
                    selectedId={selectedHistoryId}
                    onSelect={handleSelectHistory}
                    onDelete={handleDeleteHistory}
                    onNewVideo={handleNewVideo}
                    isCollapsed={!isSidebarOpen}
                    onToggleCollapse={() => setIsSidebarOpen((prev) => !prev)}
                />
            </div>

            {/* Main Content */}
            <div className="flex min-w-0 flex-1 flex-col bg-secondary/10">
                {/* Mobile: History access button (shown only on mobile, hidden on md+) */}
                {history.length > 0 && (
                    <div className="flex items-center border-b px-3 py-1.5 md:hidden">
                        <button
                            onClick={() => setIsMobileHistoryOpen(true)}
                            className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            <HistoryIcon className="size-3.5" />
                            History ({history.length})
                        </button>
                    </div>
                )}

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth p-2 sm:p-3">
                    {consoleState === 'idle' && !currentGeneration && !isLoadingVideoUrls && (
                        <ContentSelector
                            selectedType={options.content_type || 'VIDEO'}
                            onSelect={(type) =>
                                setOptions((prev: Omit<GenerateVideoRequest, 'prompt'>) => ({
                                    ...prev,
                                    content_type: type,
                                }))
                            }
                            onSamplePromptSelect={(p) => setPrompt(p)}
                        />
                    )}

                    {isLoadingVideoUrls && (
                        <div className="flex h-full flex-col items-center justify-center gap-4 p-4 text-center duration-300 animate-in fade-in">
                            <div className="relative">
                                <div className="absolute inset-0 rounded-full bg-violet-500/20 blur-2xl" />
                                <div className="relative rounded-2xl border border-violet-100/50 bg-gradient-to-br from-violet-100 to-indigo-50 p-6 shadow-sm">
                                    <Loader2 className="size-12 animate-spin text-violet-600" />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-lg font-semibold text-foreground">
                                    Loading Video
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Fetching video details from server...
                                </p>
                            </div>
                        </div>
                    )}

                    {consoleState === 'generating' && currentGeneration && (
                        <div className="mx-auto w-full max-w-3xl px-2 py-4 sm:px-4">
                            <GenerationProgress
                                currentStage={currentGeneration.stage}
                                percentage={currentGeneration.percentage}
                                message={currentGeneration.message}
                                contentType={currentGeneration.contentType}
                                scriptUrl={currentGeneration.scriptUrl}
                                audioUrl={currentGeneration.audioUrl}
                                wordsUrl={currentGeneration.wordsUrl}
                            />
                        </div>
                    )}

                    {consoleState === 'complete' &&
                        currentGeneration?.htmlUrl &&
                        (currentGeneration?.audioUrl || !needsAudio(currentGeneration?.contentType)) && (
                            <VideoResult
                                videoId={currentGeneration.videoId}
                                htmlUrl={currentGeneration.htmlUrl}
                                audioUrl={currentGeneration.audioUrl}
                                wordsUrl={currentGeneration.wordsUrl}
                                contentType={currentGeneration.contentType}
                                prompt={currentGeneration.prompt}
                            />
                        )}
                </div>

                {/* Prompt Input */}
                <div className="sticky bottom-0 z-20 border-t bg-background/80 shadow-lg shadow-violet-500/5 backdrop-blur-md">
                    <PromptInput
                        onGenerate={handleGenerate}
                        isGenerating={isGenerating}
                        disabled={!activeApiKey}
                        prompt={prompt}
                        onPromptChange={setPrompt}
                        options={options}
                        onOptionsChange={setOptions}
                    />
                </div>
            </div>
        </div>
        </LayoutContainer>
    );
}
