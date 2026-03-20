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
} from '../-services/video-generation';
import { useAIModelsList } from '@/hooks/useAiModels';
import { LatexRenderer } from './LatexRenderer';

interface PromptInputProps {
    onGenerate: (request: GenerateVideoRequest) => void;
    isGenerating: boolean;
    disabled?: boolean;
    prompt: string;
    onPromptChange: (value: string) => void;
    options: Omit<GenerateVideoRequest, 'prompt'>;
    onOptionsChange: (options: Omit<GenerateVideoRequest, 'prompt'>) => void;
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
}: PromptInputProps) {
    const [showPreview, setShowPreview] = useState(false);
    const [isPdfProcessing, setIsPdfProcessing] = useState(false);
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
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const pdfInputRef = useRef<HTMLInputElement>(null);
    const { data: modelsList } = useAIModelsList();
    const { uploadFile } = useFileUpload();

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
        }
    }, [prompt, showPreview]);

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

    const handleSubmit = () => {
        if (!prompt.trim() || isGenerating || disabled) return;
        onGenerate({ prompt: prompt.trim(), ...options });
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

                    <OptionBubble
                        icon={<Volume2 className="size-3" />}
                        label="Audio"
                        value={
                            TTS_PROVIDERS.find(
                                (p) => p.value === options.tts_provider
                            )?.label.split(' ')[0] || 'Standard'
                        }
                    >
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
                                        {provider.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </OptionBubble>

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

                {/* Prompt Input */}
                <div className="relative flex items-end gap-2 rounded-lg border bg-muted/30 p-1.5 shadow-sm transition-all focus-within:border-ring/50 focus-within:ring-1 focus-within:ring-ring">
                    <div className="flex shrink-0 flex-col items-center justify-end pb-1">
                        <input
                            ref={pdfInputRef}
                            type="file"
                            accept=".pdf"
                            className="hidden"
                            onChange={handlePdfUpload}
                            disabled={isPdfProcessing || isGenerating || disabled}
                        />
                        <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-muted-foreground hover:text-foreground"
                            onClick={() => pdfInputRef.current?.click()}
                            disabled={isPdfProcessing || isGenerating || disabled}
                            title="Upload PDF as prompt"
                        >
                            {isPdfProcessing ? (
                                <Loader2 className="size-4 animate-spin" />
                            ) : (
                                <Paperclip className="size-4" />
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
                            placeholder="Describe the video you want to create..."
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
