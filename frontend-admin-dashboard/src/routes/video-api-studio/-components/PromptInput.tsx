import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
    Send,
    Sparkles,
    Globe,
    Clock,
    Users,
    Captions,
    Wand2,
    Mic,
    Volume2,
    Layers,
    ArrowRight,
    Eye,
    EyeOff,
    Paperclip,
    Loader2,
    Palette,
    Settings2,
    Film,
    Type,
    ExternalLink,
    Check,
    X,
    ImageIcon,
    FileText,
    Play,
    Pause,
    Monitor,
    Smartphone,
    Upload,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { useFileUpload } from '@/hooks/use-file-upload';
import { getUserId } from '@/utils/userDetails';
import { getInstituteId } from '@/constants/helper';
import { GET_VIDEO_STYLE, GET_VIDEO_BRANDING } from '@/constants/urls';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import {
    handleStartProcessUploadedFile,
    handleConvertPDFToHTML,
} from '@/routes/ai-center/-services/ai-center-service';
import { toast } from 'sonner';
import {
    GenerateVideoRequest,
    ReferenceFile,
    LANGUAGES,
    VOICE_GENDERS,
    TTS_PROVIDERS,
    TARGET_AUDIENCES,
    TARGET_DURATIONS,
    CONTENT_TYPES,
    QUALITY_TIERS,
    VoiceGender,
    TtsProvider,
    ContentType,
    QualityTier,
    TtsVoice,
    VideoOrientation,
    fetchTtsVoices,
} from '../-services/video-generation';
import { useAIModelsList } from '@/hooks/useAiModels';
import { useAiCreditsQuery, useCreditEstimateQuery } from '@/services/ai-credits/get-ai-credits';
import { LatexRenderer } from './LatexRenderer';

interface PromptInputProps {
    onGenerate: (request: GenerateVideoRequest) => void;
    isGenerating: boolean;
    disabled?: boolean;
    prompt: string;
    onPromptChange: (value: string) => void;
    options: Omit<GenerateVideoRequest, 'prompt'>;
    onOptionsChange: (options: Omit<GenerateVideoRequest, 'prompt'>) => void;
    reviewModeEnabled?: boolean;
    onReviewModeChange?: (enabled: boolean) => void;
    /** API key for fetching indexed videos list. */
    apiKey?: string | null;
}

interface OptionBubbleProps {
    icon: React.ReactNode;
    label: string;
    value: string;
    children: React.ReactNode;
}

function OptionBubble({ icon, label, value, children }: OptionBubbleProps) {
    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 gap-1.5 bg-background text-xs font-normal hover:bg-muted"
                >
                    {icon}
                    <span className="hidden text-muted-foreground sm:inline">{label}:</span>
                    <span className="max-w-[100px] truncate font-medium">{value}</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-3" align="start">
                <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
                    {children}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export function PromptInput({
    onGenerate,
    isGenerating,
    disabled,
    prompt,
    onPromptChange,
    options,
    onOptionsChange,
    reviewModeEnabled,
    onReviewModeChange,
    apiKey,
}: PromptInputProps) {
    const [showPreview, setShowPreview] = useState(false);
    const [isPdfProcessing, setIsPdfProcessing] = useState(false);
    // TTS voice selection state
    const [availableVoices, setAvailableVoices] = useState<TtsVoice[]>([]);
    const [isLoadingVoices, setIsLoadingVoices] = useState(false);
    const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);
    const [videoStyle, setVideoStyle] = useState<{
        primary_color?: string;
        layout_theme?: string;
        heading_font?: string;
        body_font?: string;
        background_type?: string;
        has_custom_style?: boolean;
    } | null>(null);
    const [videoBranding, setVideoBranding] = useState<{
        intro?: { enabled: boolean; duration_seconds?: number };
        outro?: { enabled: boolean; duration_seconds?: number };
        watermark?: { enabled: boolean; position?: string };
    } | null>(null);
    const [attachments, setAttachments] = useState<
        Array<{ fileId: string; fileName: string; fileType: 'image' | 'pdf'; url: string; previewUrl?: string }>
    >([]);
    const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
    // Input video (indexed source video) state
    type InputVideoItem = { id: string; name: string; mode: string; duration_seconds: number | null; status: string; progress?: number };
    const [indexedVideos, setIndexedVideos] = useState<InputVideoItem[]>([]);
    const [processingVideos, setProcessingVideos] = useState<InputVideoItem[]>([]);
    const [selectedInputVideoIds, setSelectedInputVideoIds] = useState<string[]>([]);
    const [inputVideoAudio, setInputVideoAudio] = useState<'original' | 'tts'>('tts');
    const [isUploadingVideo, setIsUploadingVideo] = useState(false);
    const [pendingVideoFile, setPendingVideoFile] = useState<File | null>(null);
    const [pendingVideoMode, setPendingVideoMode] = useState<'podcast' | 'demo'>('demo');
    const [pendingVideoName, setPendingVideoName] = useState('');
    const videoFileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);
    const attachmentInputRef = useRef<HTMLInputElement>(null);
    const { data: modelsList } = useAIModelsList();
    const { uploadFile, getPublicUrl: getFilePublicUrl } = useFileUpload();
    const { data: credits } = useAiCreditsQuery();
    const { data: costEstimate } = useCreditEstimateQuery(
        'video',
        options.model,
        5000,
        !!options.model
    );
    const currentBalance = credits ? parseFloat(credits.current_balance) : null;
    const isLowBalance = credits?.is_low_balance ?? false;

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [prompt, showPreview]);

    // Fetch indexed input videos — completed + processing
    const refreshInputVideos = useRef<() => void>();
    refreshInputVideos.current = () => {
        if (!apiKey) return;
        import('../-services/input-video').then(({ listInputVideos }) => {
            listInputVideos(apiKey)
                .then((videos) => {
                    const toItem = (v: { id: string; name: string; mode: string; duration_seconds: number | null; status: string; progress: number }) => ({
                        id: v.id, name: v.name, mode: v.mode,
                        duration_seconds: v.duration_seconds, status: v.status,
                        progress: v.progress,
                    });
                    setIndexedVideos(videos.filter((v) => v.status === 'COMPLETED').map(toItem));
                    setProcessingVideos(videos.filter((v) =>
                        v.status === 'QUEUED' || v.status === 'PROCESSING' || v.status === 'PENDING'
                    ).map(toItem));
                })
                .catch(() => {});
        });
    };
    useEffect(() => { refreshInputVideos.current?.(); }, [apiKey]);

    // Poll processing videos every 5s, auto-add when complete
    useEffect(() => {
        if (processingVideos.length === 0) return;
        const timer = setInterval(() => {
            refreshInputVideos.current?.();
        }, 5000);
        return () => clearInterval(timer);
    }, [processingVideos.length]);

    // Auto-add newly completed videos to selection
    const prevCompletedIds = useRef(new Set<string>());
    useEffect(() => {
        const currentIds = new Set(indexedVideos.map((v) => v.id));
        for (const id of currentIds) {
            if (!prevCompletedIds.current.has(id) && prevCompletedIds.current.size > 0) {
                // New completion — auto-add if under limit
                setSelectedInputVideoIds((prev) => {
                    if (prev.includes(id) || prev.length >= 5) return prev;
                    const next = [...prev, id];
                    if (next.length > 1) setInputVideoAudio('tts');
                    return next;
                });
            }
        }
        prevCompletedIds.current = currentIds;
    }, [indexedVideos]);

    // Auto-select model based on quality tier
    useEffect(() => {
        if (!modelsList?.models || modelsList.models.length === 0) return;
        const tier = options.quality_tier || 'ultra';

        // If user has explicitly picked a model that exists, keep it
        if (options.model && modelsList.models.some((m) => m.model_id === options.model)) {
            return;
        }

        // Find best model for the selected tier
        const tierModels = modelsList.models.filter((m) => m.tier === tier);
        const defaultForTier =
            tierModels.find((m) => m.is_default) ||
            tierModels[0] ||
            modelsList.models.find((m) => m.is_default) ||
            modelsList.models[0];
        if (defaultForTier) {
            onOptionsChange({ ...options, model: defaultForTier.model_id });
        }
    }, [modelsList, options.quality_tier]); // eslint-disable-line react-hooks/exhaustive-deps

    // Fetch current video style & branding for the style preview chip
    useEffect(() => {
        const instituteId = getInstituteId();
        if (!instituteId) return;
        authenticatedAxiosInstance
            .get(GET_VIDEO_STYLE(instituteId))
            .then((res) => {
                if (res.data?.style) {
                    setVideoStyle({ ...res.data.style, has_custom_style: res.data.has_custom_style });
                } else if (res.data) {
                    setVideoStyle(res.data);
                }
            })
            .catch(() => {});
        authenticatedAxiosInstance
            .get(GET_VIDEO_BRANDING(instituteId))
            .then((res) => {
                if (res.data?.branding) {
                    setVideoBranding(res.data.branding);
                }
            })
            .catch(() => {});
    }, []);

    // Fetch available TTS voices when language, gender, or tier changes
    useEffect(() => {
        setIsLoadingVoices(true);
        fetchTtsVoices(options.language, options.voice_gender, options.tts_provider)
            .then((res) => {
                setAvailableVoices(res.voices);
                // Clear voice_id if it's not in the new voice list
                if (options.voice_id && !res.voices.some((v) => v.id === options.voice_id)) {
                    onOptionsChange({ ...options, voice_id: undefined });
                }
            })
            .catch(() => setAvailableVoices([]))
            .finally(() => setIsLoadingVoices(false));
    }, [options.language, options.voice_gender, options.tts_provider]); // eslint-disable-line react-hooks/exhaustive-deps

    // Cleanup audio preview on unmount
    useEffect(() => {
        return () => {
            if (previewAudioRef.current) {
                previewAudioRef.current.pause();
                previewAudioRef.current = null;
            }
        };
    }, []);

    const handlePlayPreview = (voice: TtsVoice) => {
        // Stop current preview if playing
        if (previewAudioRef.current) {
            previewAudioRef.current.pause();
            previewAudioRef.current = null;
        }
        if (playingVoiceId === voice.id) {
            setPlayingVoiceId(null);
            return;
        }
        const audio = new Audio(voice.sample_url);
        audio.onended = () => setPlayingVoiceId(null);
        audio.onerror = () => {
            setPlayingVoiceId(null);
            toast.error('Sample audio not available yet');
        };
        audio.play().catch(() => {
            setPlayingVoiceId(null);
            toast.error('Sample audio not available yet');
        });
        previewAudioRef.current = audio;
        setPlayingVoiceId(voice.id);
    };

    // Step 1: Validate file and show mode selector
    const handleVideoFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;

        const ACCEPTED = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
        if (!ACCEPTED.includes(file.type)) {
            toast.error('Unsupported format. Use MP4, WebM, or MOV.');
            return;
        }
        if (file.size > 500 * 1024 * 1024) {
            toast.error('File too large. Max 500MB.');
            return;
        }

        setPendingVideoFile(file);
        setPendingVideoName(file.name.replace(/\.[^.]+$/, ''));
        setPendingVideoMode('demo');
    };

    // Step 2: Upload + create indexing job with user-chosen mode
    const handleVideoUploadConfirm = async () => {
        if (!pendingVideoFile || !apiKey || !pendingVideoName.trim()) return;

        setIsUploadingVideo(true);
        try {
            const fileId = await uploadFile({
                file: pendingVideoFile,
                setIsUploading: () => {},
                userId: getUserId(),
                source: 'AI_INPUT_VIDEO',
                sourceId: 'ADMIN',
                publicUrl: true,
            });
            if (!fileId) throw new Error('Upload failed');

            const sourceUrl = await getFilePublicUrl(fileId);
            if (!sourceUrl) throw new Error('Failed to get URL');

            const { createInputVideo } = await import('../-services/input-video');
            await createInputVideo(apiKey, {
                name: pendingVideoName.trim(),
                mode: pendingVideoMode,
                source_url: sourceUrl,
            });

            toast.success(`"${pendingVideoName}" uploaded — indexing started`);
            setPendingVideoFile(null);
            setPendingVideoName('');
            refreshInputVideos.current?.();
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Upload failed');
        } finally {
            setIsUploadingVideo(false);
        }
    };

    const handleSubmit = () => {
        if (!prompt.trim() || isGenerating || disabled) return;
        const referenceFiles: ReferenceFile[] = attachments.map((a) => ({
            url: a.url,
            name: a.fileName,
            type: a.fileType,
        }));
        onGenerate({
            prompt: prompt.trim(),
            ...options,
            ...(referenceFiles.length > 0 ? { reference_files: referenceFiles } : {}),
            ...(selectedInputVideoIds.length > 0
                ? { input_video_ids: selectedInputVideoIds, input_video_audio: inputVideoAudio }
                : {}),
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input
        e.target.value = '';

        setIsPdfProcessing(true);
        try {
            // Step 1: Upload to S3
            const fileId = await uploadFile({
                file,
                setIsUploading: () => {},
                userId: getUserId(),
            });
            if (!fileId) throw new Error('Failed to upload PDF');

            // Step 2: Start processing → get pdf_id
            const processResult = await handleStartProcessUploadedFile(fileId);
            const pdfId = processResult?.pdf_id;
            if (!pdfId) throw new Error('Failed to process PDF');

            // Step 3: Convert PDF to HTML
            const taskName = `Task_${new Date().toLocaleDateString('en-GB')}_${new Date().toLocaleTimeString('en-GB')}`;
            const htmlResult = await handleConvertPDFToHTML(pdfId, taskName);
            const html = htmlResult?.html;
            if (!html) throw new Error('Failed to extract content from PDF');

            // Step 4: Set as prompt
            onPromptChange(html);
            toast.success('PDF content extracted successfully');
        } catch (error) {
            console.error('PDF upload error:', error);
            toast.error('Failed to extract content from PDF');
        } finally {
            setIsPdfProcessing(false);
        }
    };

    const MAX_ATTACHMENTS = 10;
    const MAX_FILE_SIZE_MB = 50;
    const ACCEPTED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'webp'];
    const [isDraggingOver, setIsDraggingOver] = useState(false);

    // Shared upload logic for both file input and drag-drop
    const processFiles = async (fileList: File[]) => {
        if (fileList.length === 0) return;

        // Filter to accepted types
        const validFiles = fileList.filter((f) => {
            const ext = f.name.split('.').pop()?.toLowerCase() || '';
            return ACCEPTED_EXTENSIONS.includes(ext);
        });
        if (validFiles.length < fileList.length) {
            const rejected = fileList.length - validFiles.length;
            toast.warning(`${rejected} file(s) skipped (only images and PDFs accepted)`);
        }
        if (validFiles.length === 0) return;

        const remaining = MAX_ATTACHMENTS - attachments.length;
        if (remaining <= 0) {
            toast.error(`Maximum ${MAX_ATTACHMENTS} files allowed`);
            return;
        }

        const filesToProcess = validFiles.slice(0, remaining);
        if (filesToProcess.length < validFiles.length) {
            toast.warning(`Only ${remaining} more file(s) can be added (max ${MAX_ATTACHMENTS})`);
        }

        setIsUploadingAttachment(true);
        let successCount = 0;
        let failCount = 0;

        try {
            for (const file of filesToProcess) {
                if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
                    toast.error(`${file.name} exceeds ${MAX_FILE_SIZE_MB}MB limit`);
                    failCount++;
                    continue;
                }

                const ext = file.name.split('.').pop()?.toLowerCase() || '';
                const fileType: 'image' | 'pdf' = ext === 'pdf' ? 'pdf' : 'image';

                try {
                    const fileId = await uploadFile({
                        file,
                        setIsUploading: () => {},
                        userId: getUserId(),
                        source: 'AI_VIDEO_REFERENCE',
                        sourceId: 'ADMIN',
                        publicUrl: true,
                    });
                    if (!fileId) {
                        failCount++;
                        continue;
                    }

                    const url = await getFilePublicUrl(fileId);
                    if (!url) {
                        failCount++;
                        continue;
                    }

                    const previewUrl = fileType === 'image' ? URL.createObjectURL(file) : undefined;

                    setAttachments((prev) => [
                        ...prev,
                        { fileId, fileName: file.name, fileType, url, previewUrl },
                    ]);
                    successCount++;
                } catch {
                    failCount++;
                }
            }

            if (successCount > 0 && failCount === 0) {
                toast.success(`${successCount} file(s) attached`);
            } else if (successCount > 0 && failCount > 0) {
                toast.warning(`${successCount} attached, ${failCount} failed`);
            } else if (failCount > 0) {
                toast.error(`Failed to upload ${failCount} file(s)`);
            }
        } catch (error) {
            console.error('Attachment upload error:', error);
            toast.error('Failed to upload attachments');
        } finally {
            setIsUploadingAttachment(false);
        }
    };

    const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        e.target.value = '';
        await processFiles(Array.from(files));
    };

    // Drag-and-drop handlers for the prompt area
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            setIsDraggingOver(true);
        }
    };
    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    };
    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        if (isGenerating || disabled || isUploadingAttachment) return;
        const files = Array.from(e.dataTransfer.files);
        await processFiles(files);
    };

    const removeAttachment = (fileId: string) => {
        setAttachments((prev) => {
            const removed = prev.find((a) => a.fileId === fileId);
            if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
            return prev.filter((a) => a.fileId !== fileId);
        });
    };

    const updateOption = <K extends keyof typeof options>(key: K, value: (typeof options)[K]) => {
        onOptionsChange({ ...options, [key]: value });
    };

    const models = modelsList?.models || [];
    const selectedContentType = CONTENT_TYPES.find((c) => c.value === options.content_type);

    return (
        <div className="border-t bg-background/95 p-1.5 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:p-2">
            <div className="mx-auto max-w-4xl space-y-1.5">
                {/* Option Bubbles */}
                <div className="flex flex-wrap items-center gap-1.5">
                    {/* Content Type Selector - First */}
                    <OptionBubble
                        icon={<Layers className="size-3" />}
                        label="Type"
                        value={selectedContentType?.label || '📹 Video'}
                    >
                        <Select
                            value={options.content_type || 'VIDEO'}
                            onValueChange={(v) => updateOption('content_type', v as ContentType)}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-80">
                                {CONTENT_TYPES.map((type) => (
                                    <SelectItem
                                        key={type.value}
                                        value={type.value}
                                        className="text-xs"
                                    >
                                        <div className="flex flex-col">
                                            <span>{type.label}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {type.description}
                                            </span>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </OptionBubble>

                    {/* Orientation Selector */}
                    <OptionBubble
                        icon={(options.orientation || 'landscape') === 'landscape' ? <Monitor className="size-3" /> : <Smartphone className="size-3" />}
                        label="Orientation"
                        value={(options.orientation || 'landscape') === 'landscape' ? 'Landscape' : 'Portrait'}
                    >
                        <div className="inline-flex w-full rounded-lg border bg-muted p-0.5">
                            {([
                                { value: 'landscape' as VideoOrientation, label: 'Landscape', icon: Monitor },
                                { value: 'portrait' as VideoOrientation, label: 'Portrait', icon: Smartphone },
                            ] as const).map(({ value, label, icon: Icon }) => (
                                <button
                                    key={value}
                                    onClick={() => updateOption('orientation', value)}
                                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                        (options.orientation || 'landscape') === value
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    <Icon className="size-3.5" />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </OptionBubble>

                    {/* Source Video — Add / Upload popover */}
                    <OptionBubble
                        icon={<Film className="size-3" />}
                        label="Source Videos"
                        value={
                            selectedInputVideoIds.length > 0
                                ? `${selectedInputVideoIds.length} added`
                                : processingVideos.length > 0
                                  ? `${processingVideos.length} processing`
                                  : 'Add'
                        }
                    >
                        {/* Processing videos — with progress bars */}
                        {processingVideos.length > 0 && (
                            <div className="mb-2 space-y-1.5">
                                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Processing</p>
                                {processingVideos.map((v) => (
                                    <div key={v.id} className="rounded-md border bg-muted/30 px-2 py-1.5 text-xs">
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="size-3 shrink-0 animate-spin text-indigo-500" />
                                            <span className="flex-1 truncate">{v.name}</span>
                                            <span className="shrink-0 text-muted-foreground">{v.progress || 0}%</span>
                                        </div>
                                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
                                            <div
                                                className="h-full rounded-full bg-indigo-500 transition-all"
                                                style={{ width: `${v.progress || 0}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Ready videos — click to add */}
                        {indexedVideos.filter((v) => !selectedInputVideoIds.includes(v.id)).length > 0 && (
                            <div className="mb-2">
                                {processingVideos.length > 0 && (
                                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Ready</p>
                                )}
                                <div className="max-h-36 space-y-0.5 overflow-y-auto">
                                    {indexedVideos
                                        .filter((v) => !selectedInputVideoIds.includes(v.id))
                                        .map((v) => (
                                            <button
                                                key={v.id}
                                                onClick={() => {
                                                    if (selectedInputVideoIds.length < 5) {
                                                        const next = [...selectedInputVideoIds, v.id];
                                                        setSelectedInputVideoIds(next);
                                                        if (next.length > 1) setInputVideoAudio('tts');
                                                    }
                                                }}
                                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted"
                                            >
                                                <span className="text-muted-foreground">+</span>
                                                <span className="flex-1 truncate">{v.name}</span>
                                                <span className="shrink-0 text-muted-foreground">
                                                    {v.mode} · {v.duration_seconds ? `${Math.round(v.duration_seconds)}s` : '?'}
                                                </span>
                                            </button>
                                        ))}
                                </div>
                            </div>
                        )}

                        {indexedVideos.filter((v) => !selectedInputVideoIds.includes(v.id)).length === 0
                            && processingVideos.length === 0 && indexedVideos.length > 0 && (
                            <p className="mb-2 py-1 text-center text-xs text-muted-foreground">All videos added</p>
                        )}

                        {selectedInputVideoIds.length >= 5 && (
                            <p className="mb-2 text-xs text-muted-foreground">Max 5 videos</p>
                        )}

                        {/* Upload new video — two-step: pick file → choose mode → confirm */}
                        <div className="border-t pt-2">
                            <input
                                ref={videoFileInputRef}
                                type="file"
                                accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                                className="hidden"
                                onChange={handleVideoFilePick}
                            />

                            {pendingVideoFile ? (
                                <div className="space-y-2">
                                    {/* File name (editable) */}
                                    <input
                                        type="text"
                                        value={pendingVideoName}
                                        onChange={(e) => setPendingVideoName(e.target.value)}
                                        className="w-full rounded-md border px-2 py-1 text-xs focus:border-indigo-400 focus:outline-none"
                                        placeholder="Video name"
                                    />
                                    {/* Mode selector */}
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-muted-foreground">Type:</span>
                                        <button
                                            onClick={() => setPendingVideoMode('demo')}
                                            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                                                pendingVideoMode === 'demo'
                                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                                    : 'text-muted-foreground hover:bg-muted'
                                            }`}
                                        >
                                            <Monitor className="size-3" />
                                            Demo
                                        </button>
                                        <button
                                            onClick={() => setPendingVideoMode('podcast')}
                                            className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
                                                pendingVideoMode === 'podcast'
                                                    ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                                                    : 'text-muted-foreground hover:bg-muted'
                                            }`}
                                        >
                                            <Mic className="size-3" />
                                            Podcast
                                        </button>
                                    </div>
                                    {/* Confirm / Cancel */}
                                    <div className="flex gap-1.5">
                                        <button
                                            onClick={handleVideoUploadConfirm}
                                            disabled={isUploadingVideo || !pendingVideoName.trim()}
                                            className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                                        >
                                            {isUploadingVideo ? (
                                                <Loader2 className="size-3 animate-spin" />
                                            ) : (
                                                <Upload className="size-3" />
                                            )}
                                            {isUploadingVideo ? 'Uploading...' : 'Upload & Index'}
                                        </button>
                                        <button
                                            onClick={() => { setPendingVideoFile(null); setPendingVideoName(''); }}
                                            disabled={isUploadingVideo}
                                            className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => videoFileInputRef.current?.click()}
                                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-950/30"
                                >
                                    <Upload className="size-3.5" />
                                    Upload New Video
                                </button>
                            )}
                        </div>
                    </OptionBubble>

                    {/* Audio Source Toggle (visible when source video(s) selected) */}
                    {selectedInputVideoIds.length > 0 && (
                        <OptionBubble
                            icon={<Mic className="size-3" />}
                            label="Audio"
                            value={inputVideoAudio === 'original' ? 'Original' : 'AI Narration'}
                        >
                            <div className="inline-flex w-full rounded-lg border bg-muted p-0.5">
                                <button
                                    onClick={() => {
                                        if (selectedInputVideoIds.length <= 1) setInputVideoAudio('original');
                                    }}
                                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                        inputVideoAudio === 'original'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    } ${selectedInputVideoIds.length > 1 ? 'opacity-40 cursor-not-allowed' : ''}`}
                                    title={selectedInputVideoIds.length > 1 ? 'Original audio only available with single video' : ''}
                                >
                                    Original Audio
                                </button>
                                <button
                                    onClick={() => setInputVideoAudio('tts')}
                                    className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                        inputVideoAudio === 'tts'
                                            ? 'bg-background text-foreground shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    AI Narration
                                </button>
                            </div>
                            {selectedInputVideoIds.length > 1 && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Multiple videos require AI narration
                                </p>
                            )}
                        </OptionBubble>
                    )}

                    {/* Quality Tier Selector */}
                    <OptionBubble
                        icon={<Sparkles className="size-3" />}
                        label="Quality"
                        value={
                            QUALITY_TIERS.find((t) => t.value === options.quality_tier)?.label ||
                            'Ultra'
                        }
                    >
                        <Select
                            value={options.quality_tier || 'ultra'}
                            onValueChange={(v) => {
                                // Update both at once to avoid stale-closure race
                                onOptionsChange({ ...options, quality_tier: v as QualityTier, model: '' });
                            }}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {QUALITY_TIERS.map((tier) => (
                                    <SelectItem
                                        key={tier.value}
                                        value={tier.value}
                                        className="text-xs"
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-medium">{tier.label}</span>
                                            {tier.badge && (
                                                <Badge
                                                    variant="secondary"
                                                    className="h-4 px-1 text-[9px]"
                                                >
                                                    {tier.badge}
                                                </Badge>
                                            )}
                                        </div>
                                        <span className="text-[10px] text-muted-foreground">
                                            {tier.description}
                                        </span>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {/* Advanced: Override Model */}
                        <div className="mt-2 border-t pt-2">
                            <Label className="text-[10px] text-muted-foreground">
                                Override Model
                            </Label>
                            <Select
                                value={options.model || ''}
                                onValueChange={(v) => updateOption('model', v)}
                            >
                                <SelectTrigger className="mt-1 h-7 text-[11px]">
                                    <SelectValue placeholder="Auto (recommended)" />
                                </SelectTrigger>
                                <SelectContent className="max-h-60">
                                    {models.map((model) => (
                                        <SelectItem
                                            key={model.model_id}
                                            value={model.model_id}
                                            className="text-xs"
                                        >
                                            <span>{model.name}</span>
                                            {model.is_free && (
                                                <Badge
                                                    variant="outline"
                                                    className="ml-1 h-3.5 px-1 text-[9px]"
                                                >
                                                    Free
                                                </Badge>
                                            )}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </OptionBubble>

                    <OptionBubble
                        icon={<Globe className="size-3" />}
                        label="Language"
                        value={options.language}
                    >
                        <Select
                            value={options.language}
                            onValueChange={(v) => updateOption('language', v)}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                                <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                                    Global
                                </div>
                                {LANGUAGES.filter((l) => l.group === 'Global').map((lang) => (
                                    <SelectItem
                                        key={lang.value}
                                        value={lang.value}
                                        className="text-xs"
                                    >
                                        {lang.label}
                                    </SelectItem>
                                ))}
                                <div className="mt-2 px-2 py-1 text-xs font-semibold text-muted-foreground">
                                    Indian
                                </div>
                                {LANGUAGES.filter((l) => l.group === 'Indian').map((lang) => (
                                    <SelectItem
                                        key={lang.value}
                                        value={lang.value}
                                        className="text-xs"
                                    >
                                        {lang.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </OptionBubble>

                    <OptionBubble
                        icon={<Mic className="size-3" />}
                        label="Voice"
                        value={
                            VOICE_GENDERS.find((v) => v.value === options.voice_gender)?.label ||
                            'Female'
                        }
                    >
                        <Select
                            value={options.voice_gender}
                            onValueChange={(v) => updateOption('voice_gender', v as VoiceGender)}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {VOICE_GENDERS.map((gender) => (
                                    <SelectItem
                                        key={gender.value}
                                        value={gender.value}
                                        className="text-xs"
                                    >
                                        {gender.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </OptionBubble>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1.5 bg-background text-xs font-normal hover:bg-muted"
                            >
                                <Volume2 className="size-3" />
                                <span className="hidden text-muted-foreground sm:inline">Audio:</span>
                                <span className="max-w-[120px] truncate font-medium">
                                    {TTS_PROVIDERS.find((p) => p.value === options.tts_provider)?.label || 'Standard'}
                                    {options.voice_id && ` · ${availableVoices.find((v) => v.id === options.voice_id)?.name || options.voice_id}`}
                                </span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-3" align="start">
                            <div className="space-y-3">
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-muted-foreground">Audio Quality</Label>
                                    <Select
                                        value={options.tts_provider}
                                        onValueChange={(v) => updateOption('tts_provider', v as TtsProvider)}
                                    >
                                        <SelectTrigger className="h-8 text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TTS_PROVIDERS.map((provider) => (
                                                <SelectItem
                                                    key={provider.value}
                                                    value={provider.value}
                                                    className="text-xs"
                                                >
                                                    <div className="flex flex-col">
                                                        <span>{provider.label}</span>
                                                        <span className="text-[10px] text-muted-foreground">{provider.description}</span>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Voice selection — show for all tiers */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-muted-foreground">
                                        Voice {isLoadingVoices && <Loader2 className="ml-1 inline size-3 animate-spin" />}
                                    </Label>
                                    {availableVoices.length > 0 && (
                                        <div className="max-h-48 space-y-1 overflow-y-auto">
                                            {availableVoices.map((voice) => {
                                                const isSelected =
                                                    options.tts_provider === 'standard'
                                                        ? !options.voice_id // standard has one voice, always selected
                                                        : options.voice_id === voice.id;
                                                const isPlaying = playingVoiceId === voice.id;
                                                return (
                                                    <div
                                                        key={voice.id}
                                                        className={`flex items-center justify-between rounded-md border px-2 py-1.5 text-xs transition-colors ${
                                                            isSelected
                                                                ? 'border-primary bg-primary/5'
                                                                : 'border-transparent hover:bg-muted'
                                                        }`}
                                                    >
                                                        <button
                                                            type="button"
                                                            className="flex-1 text-left"
                                                            onClick={() => {
                                                                if (options.tts_provider === 'premium') {
                                                                    onOptionsChange({ ...options, voice_id: voice.id });
                                                                }
                                                            }}
                                                        >
                                                            <span className="font-medium">{voice.name}</span>
                                                            <span className="ml-1 text-[10px] text-muted-foreground">
                                                                {voice.provider === 'sarvam' ? 'Sarvam' : voice.provider === 'google' ? 'Google' : 'Edge'}
                                                            </span>
                                                        </button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="size-6 p-0"
                                                            onClick={() => handlePlayPreview(voice)}
                                                        >
                                                            {isPlaying ? (
                                                                <Pause className="size-3" />
                                                            ) : (
                                                                <Play className="size-3" />
                                                            )}
                                                        </Button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {availableVoices.length === 0 && !isLoadingVoices && (
                                        <p className="text-[10px] text-muted-foreground">No voices available for this combination.</p>
                                    )}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <OptionBubble
                        icon={<Users className="size-3" />}
                        label="Audience"
                        value={options.target_audience.split(' ')[0] ?? ''}
                    >
                        <Select
                            value={options.target_audience}
                            onValueChange={(v) => updateOption('target_audience', v)}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TARGET_AUDIENCES.map((aud) => (
                                    <SelectItem key={aud} value={aud} className="text-xs">
                                        {aud}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </OptionBubble>

                    <OptionBubble
                        icon={<Clock className="size-3" />}
                        label="Duration"
                        value={options.target_duration}
                    >
                        <Select
                            value={options.target_duration}
                            onValueChange={(v) => updateOption('target_duration', v)}
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TARGET_DURATIONS.map((dur) => (
                                    <SelectItem key={dur} value={dur} className="text-xs">
                                        {dur}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </OptionBubble>

                    <OptionBubble
                        icon={<Wand2 className="size-3" />}
                        label="Quality"
                        value={options.html_quality}
                    >
                        <Select
                            value={options.html_quality}
                            onValueChange={(v) =>
                                updateOption('html_quality', v as 'classic' | 'advanced')
                            }
                        >
                            <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="classic" className="text-xs">
                                    Classic
                                </SelectItem>
                                <SelectItem value="advanced" className="text-xs">
                                    Advanced
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </OptionBubble>

                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1.5 bg-background text-xs font-normal hover:bg-muted"
                            >
                                <Captions className="size-3" />
                                <span className="hidden text-muted-foreground lg:inline">
                                    Captions:
                                </span>
                                <Badge
                                    variant={options.captions_enabled ? 'default' : 'secondary'}
                                    className="h-4 px-1 text-[10px]"
                                >
                                    {options.captions_enabled ? 'On' : 'Off'}
                                </Badge>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-3" align="start">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs">Enable Captions</Label>
                                <Switch
                                    checked={options.captions_enabled}
                                    onCheckedChange={(v) => updateOption('captions_enabled', v)}
                                />
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Review Script Toggle */}
                    {onReviewModeChange && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1.5 bg-background text-xs font-normal hover:bg-muted"
                                >
                                    <FileText className="size-3" />
                                    <span className="hidden text-muted-foreground lg:inline">
                                        Review:
                                    </span>
                                    <Badge
                                        variant={reviewModeEnabled ? 'default' : 'secondary'}
                                        className="h-4 px-1 text-[10px]"
                                    >
                                        {reviewModeEnabled ? 'On' : 'Off'}
                                    </Badge>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-3" align="start">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs">Review script first</Label>
                                        <Switch
                                            checked={reviewModeEnabled}
                                            onCheckedChange={onReviewModeChange}
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground">
                                        When enabled, you can review and edit the AI-generated
                                        script before audio and visuals are created.
                                    </p>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}

                    {/* Style Preview Chip */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 gap-1.5 bg-background text-xs font-normal hover:bg-muted"
                                title="Current video style — click to preview"
                            >
                                {videoStyle?.primary_color ? (
                                    <span
                                        className="inline-block size-3 rounded-full border border-border"
                                        style={{ backgroundColor: videoStyle.primary_color }}
                                    />
                                ) : (
                                    <Palette className="size-3" />
                                )}
                                <span className="hidden text-muted-foreground sm:inline">Style:</span>
                                <span className="max-w-[80px] truncate font-medium">
                                    {videoStyle?.has_custom_style
                                        ? (videoStyle.layout_theme
                                              ?.replace(/_/g, ' ')
                                              .replace(/\b\w/g, (c) => c.toUpperCase()) ?? 'Custom')
                                        : 'Default'}
                                </span>
                                <Settings2 className="size-2.5 text-muted-foreground" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-0" align="start">
                            <div className="space-y-3 p-3">
                                <Label className="text-xs font-medium text-muted-foreground">
                                    Video Style & Branding
                                </Label>

                                {/* Theme */}
                                <div className="flex items-center gap-2">
                                    <Palette className="size-3.5 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">Theme:</span>
                                    <span className="text-xs font-medium">
                                        {videoStyle?.layout_theme
                                            ? videoStyle.layout_theme
                                                  .replace(/_/g, ' ')
                                                  .replace(/\b\w/g, (c) => c.toUpperCase())
                                            : 'Default'}
                                    </span>
                                    <Badge variant="outline" className="ml-auto h-4 px-1 text-[9px]">
                                        {videoStyle?.background_type === 'black' ? 'Dark' : 'Light'}
                                    </Badge>
                                </div>

                                {/* Colors */}
                                <div className="flex items-center gap-2">
                                    <span
                                        className="inline-block size-3.5 rounded-full border border-border"
                                        style={{
                                            backgroundColor:
                                                videoStyle?.primary_color || '#6366f1',
                                        }}
                                    />
                                    <span className="text-xs text-muted-foreground">Color:</span>
                                    <span className="font-mono text-xs font-medium">
                                        {videoStyle?.primary_color || '#6366f1'}
                                    </span>
                                </div>

                                {/* Fonts */}
                                <div className="flex items-center gap-2">
                                    <Type className="size-3.5 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">Fonts:</span>
                                    <span className="text-xs font-medium">
                                        {videoStyle?.heading_font || 'Inter'}
                                        {videoStyle?.body_font &&
                                            videoStyle.body_font !== videoStyle.heading_font &&
                                            ` / ${videoStyle.body_font}`}
                                    </span>
                                </div>

                                {/* Branding — Intro / Outro */}
                                <div className="space-y-1.5 border-t pt-2">
                                    <div className="flex items-center gap-2">
                                        <Film className="size-3.5 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">Intro:</span>
                                        {videoBranding?.intro?.enabled ? (
                                            <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                                                <Check className="size-3" />
                                                {videoBranding.intro.duration_seconds}s
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <X className="size-3" />
                                                Off
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Film className="size-3.5 text-muted-foreground" />
                                        <span className="text-xs text-muted-foreground">Outro:</span>
                                        {videoBranding?.outro?.enabled ? (
                                            <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                                                <Check className="size-3" />
                                                {videoBranding.outro.duration_seconds}s
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <X className="size-3" />
                                                Off
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="size-3.5 text-center text-[10px] text-muted-foreground">W</span>
                                        <span className="text-xs text-muted-foreground">Watermark:</span>
                                        {videoBranding?.watermark?.enabled ? (
                                            <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                                                <Check className="size-3" />
                                                {videoBranding.watermark.position?.replace('-', ' ')}
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                                <X className="size-3" />
                                                Off
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Edit link */}
                            <div className="border-t px-3 py-2">
                                <Link
                                    to="/settings"
                                    search={{ selectedTab: 'aiSettings' }}
                                    className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:underline"
                                >
                                    <ExternalLink className="size-3" />
                                    Edit in AI Settings
                                </Link>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Credit Balance */}
                    {currentBalance !== null && (
                        <div
                            className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                                isLowBalance
                                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            }`}
                            title={
                                costEstimate?.estimated_cost
                                    ? `Estimated cost: ~${costEstimate.estimated_cost.toFixed(1)} credits`
                                    : 'AI Credits balance'
                            }
                        >
                            <Sparkles className="size-3" />
                            <span>{currentBalance.toFixed(1)}</span>
                            {costEstimate?.estimated_cost ? (
                                <span className="text-[10px] opacity-70">
                                    (~{costEstimate.estimated_cost.toFixed(1)}/gen)
                                </span>
                            ) : null}
                        </div>
                    )}

                    {/* Preview Toggle */}
                    <Button
                        variant={showPreview ? 'secondary' : 'outline'}
                        size="sm"
                        onClick={() => setShowPreview(!showPreview)}
                        className="h-7 gap-1.5 bg-background text-xs font-normal hover:bg-muted"
                        title="Toggle Markdown/LaTeX Preview"
                    >
                        {showPreview ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                        <span className="hidden sm:inline">Preview</span>
                    </Button>
                </div>

                {/* Attachments bar */}
                {attachments.length > 0 && (
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
                                            <img src={a.previewUrl} alt={a.fileName} className="size-6 rounded object-cover" />
                                        ) : (
                                            <ImageIcon className="size-4 text-blue-500" />
                                        )
                                    ) : (
                                        <FileText className="size-4 text-red-500" />
                                    )}
                                    <span className="max-w-[100px] truncate">{a.fileName}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeAttachment(a.fileId)}
                                        className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                                        aria-label={`Remove ${a.fileName}`}
                                    >
                                        <X className="size-3.5" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Selected source videos — shown as removable chips with letter labels */}
                {selectedInputVideoIds.length > 0 && (
                    <div className="flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50/30 px-2 py-1.5 dark:border-indigo-800 dark:bg-indigo-950/20">
                        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-indigo-500">
                            Sources ({selectedInputVideoIds.length})
                        </span>
                        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto">
                            {selectedInputVideoIds.map((id, idx) => {
                                const video = indexedVideos.find((v) => v.id === id);
                                const label = String.fromCharCode(65 + idx); // A, B, C...
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
                                        <span className="text-muted-foreground">
                                            {video?.mode}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const next = selectedInputVideoIds.filter((x) => x !== id);
                                                setSelectedInputVideoIds(next);
                                                if (next.length <= 1 && inputVideoAudio === 'tts') {
                                                    // Don't auto-switch back; user can choose
                                                }
                                            }}
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
                )}

                {/* Prompt Input — supports drag-and-drop for images/PDFs */}
                <div
                    className={`relative flex items-end gap-2 rounded-lg border p-1.5 shadow-sm transition-all focus-within:border-ring/50 focus-within:ring-1 focus-within:ring-ring ${
                        isDraggingOver
                            ? 'border-blue-400 bg-blue-50/50 ring-1 ring-blue-300'
                            : 'bg-muted/30'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    {/* Drag overlay */}
                    {isDraggingOver && (
                        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-blue-400 bg-blue-50/80">
                            <div className="flex flex-col items-center gap-1 text-blue-600">
                                <Paperclip className="size-5" />
                                <span className="text-xs font-medium">Drop images or PDFs here</span>
                            </div>
                        </div>
                    )}
                    <div className="flex shrink-0 flex-col items-center justify-end gap-0.5 pb-1">
                        {/* Hidden file inputs */}
                        <input
                            ref={pdfInputRef}
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={handlePdfUpload}
                            disabled={isPdfProcessing || isGenerating || disabled}
                        />
                        <input
                            ref={attachmentInputRef}
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg,.webp"
                            multiple
                            className="hidden"
                            onChange={handleAttachmentUpload}
                            disabled={isUploadingAttachment || isGenerating || disabled}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-blue-600"
                            onClick={() => attachmentInputRef.current?.click()}
                            disabled={isUploadingAttachment || isGenerating || disabled}
                            title="Attach reference images or PDFs (used as context + visuals)"
                            aria-label="Attach reference files"
                        >
                            {isUploadingAttachment ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Paperclip className="size-4" />
                            )}
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-orange-600"
                            onClick={() => pdfInputRef.current?.click()}
                            disabled={isPdfProcessing || isGenerating || disabled}
                            title="Extract PDF text and use as prompt (replaces current text)"
                            aria-label="Extract PDF as prompt"
                        >
                            {isPdfProcessing ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <FileText className="size-4" />
                            )}
                        </Button>
                    </div>

                    {showPreview ? (
                        <div className="min-h-[36px] min-w-0 flex-1 p-2">
                            <div className="max-h-[200px] overflow-y-auto">
                                {prompt ? (
                                    <LatexRenderer
                                        text={prompt}
                                        className="whitespace-pre-wrap text-sm leading-relaxed"
                                    />
                                ) : (
                                    <span className="italic text-muted-foreground">
                                        Nothing to preview
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : (
                        <Textarea
                            ref={textareaRef}
                            value={prompt}
                            onChange={(e) => onPromptChange(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Describe what you want to create... (attach images/PDFs with the clip icon)"
                            className="max-h-[160px] min-h-[36px] min-w-0 flex-1 resize-none border-0 bg-transparent p-0 text-sm placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0"
                            disabled={isGenerating || disabled}
                            rows={1}
                        />
                    )}

                    {!showPreview && (
                        <Button
                            onClick={handleSubmit}
                            disabled={!prompt.trim() || isGenerating || disabled}
                            size="icon"
                            className="size-10 shrink-0 rounded-md shadow-sm sm:size-12"
                        >
                            <Send className="size-10 sm:size-10" />
                        </Button>
                    )}
                </div>

                <div className="flex w-full justify-end px-1 pb-1">
                    <Link
                        to="/study-library/ai-copilot"
                        className="group flex items-center gap-1.5 text-[10px] text-muted-foreground transition-colors hover:text-violet-600"
                    >
                        <Sparkles className="size-3 transition-colors group-hover:text-violet-600" />
                        <span>Want to create an entire course via AI?</span>
                        <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
