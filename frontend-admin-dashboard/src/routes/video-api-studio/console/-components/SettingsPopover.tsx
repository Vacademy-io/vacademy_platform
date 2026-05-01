import { useState } from 'react';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Settings2,
    Layers,
    Monitor,
    Smartphone,
    Clock,
    Users,
    Globe,
    Mic,
    Volume2,
    Wand2,
    Captions,
    FileText,
    Scissors,
    Palette,
    Type as TypeIcon,
    Film,
    ExternalLink,
    Check,
    X,
    Play,
    Pause,
    Loader2,
    Sparkles as SparklesIcon,
} from 'lucide-react';
import { Link } from '@tanstack/react-router';
import {
    GenerateVideoRequest,
    LANGUAGES,
    VOICE_GENDERS,
    TTS_PROVIDERS,
    TARGET_AUDIENCES,
    TARGET_DURATIONS,
    CONTENT_TYPES,
    QUALITY_TIERS,
    ContentType,
    VoiceGender,
    TtsProvider,
    QualityTier,
    VideoOrientation,
    TtsVoice,
    DEFAULT_OPTIONS,
} from '../../-services/video-generation';

export interface VideoStyleInfo {
    primary_color?: string;
    layout_theme?: string;
    heading_font?: string;
    body_font?: string;
    background_type?: string;
    has_custom_style?: boolean;
}

export interface VideoBrandingInfo {
    intro?: { enabled: boolean; duration_seconds?: number };
    outro?: { enabled: boolean; duration_seconds?: number };
    watermark?: { enabled: boolean; position?: string };
}

interface AiModel {
    model_id: string;
    name: string;
    is_free?: boolean;
}

interface SettingsPopoverProps {
    options: Omit<GenerateVideoRequest, 'prompt'>;
    onOptionsChange: (options: Omit<GenerateVideoRequest, 'prompt'>) => void;
    reviewModeEnabled?: boolean;
    onReviewModeChange?: (enabled: boolean) => void;
    /** Voice metadata — fetched in Composer; passed in here. */
    availableVoices: TtsVoice[];
    isLoadingVoices: boolean;
    playingVoiceId: string | null;
    onPlayPreview: (voice: TtsVoice) => void;
    /** Style + branding (read-only here; edited in Settings page). */
    videoStyle: VideoStyleInfo | null;
    videoBranding: VideoBrandingInfo | null;
    /** AI model list (filtered by quality_tier). */
    models: AiModel[];
}

/**
 * Settings keys whose divergence from {@link DEFAULT_OPTIONS} we surface as the
 * badge count on the ⚙ trigger. We intentionally **exclude**:
 *  - `model` — auto-selected by quality_tier; not a user-driven choice
 *  - `voice_id` — undefined by default; gets populated automatically when the
 *    voice list loads, which would inflate the badge for everyone
 *  - `visual_style` — deprecated; kept for historical metadata
 *  - `target_audience` — almost always edited per institute; setting it once
 *    shouldn't read as "active"
 *
 * `sub_shots_enabled` isn't in DEFAULT_OPTIONS (optional with implicit default
 * false), so it's tracked separately. `reviewModeEnabled` lives outside options.
 */
const TRACKED_KEYS = [
    'content_type',
    'orientation',
    'target_duration',
    'quality_tier',
    'language',
    'voice_gender',
    'tts_provider',
    'captions_enabled',
    'html_quality',
] as const;

/** Count options that diverge from defaults — surfaced as a badge on the trigger. */
function computeNonDefaultCount(
    options: Omit<GenerateVideoRequest, 'prompt'>,
    reviewModeEnabled: boolean | undefined
): number {
    let n = 0;
    for (const key of TRACKED_KEYS) {
        if (options[key] !== DEFAULT_OPTIONS[key]) n++;
    }
    if (options.sub_shots_enabled) n++; // implicit default is false
    if (reviewModeEnabled) n++; // implicit default is false
    return n;
}

function SettingsBody({
    options,
    onOptionsChange,
    reviewModeEnabled,
    onReviewModeChange,
    availableVoices,
    isLoadingVoices,
    playingVoiceId,
    onPlayPreview,
    videoStyle,
    videoBranding,
    models,
}: SettingsPopoverProps) {
    const update = <K extends keyof GenerateVideoRequest>(
        key: K,
        value: GenerateVideoRequest[K]
    ) => {
        onOptionsChange({ ...options, [key]: value });
    };

    return (
        <Tabs defaultValue="output" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="output" className="text-xs">
                    Output
                </TabsTrigger>
                <TabsTrigger value="voice" className="text-xs">
                    Voice
                </TabsTrigger>
                <TabsTrigger value="visuals" className="text-xs">
                    Visuals
                </TabsTrigger>
                <TabsTrigger value="advanced" className="text-xs">
                    Advanced
                </TabsTrigger>
            </TabsList>

            {/* ============================================================ */}
            {/* OUTPUT — Type, Orientation, Duration, Quality, Model         */}
            {/* ============================================================ */}
            <TabsContent value="output" className="mt-3 space-y-3">
                <Field icon={<Layers className="size-3.5" />} label="Content type">
                    <Select
                        value={options.content_type || 'VIDEO'}
                        onValueChange={(v) => update('content_type', v as ContentType)}
                    >
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                            {CONTENT_TYPES.map((t) => (
                                <SelectItem key={t.value} value={t.value} className="text-xs">
                                    <div className="flex flex-col">
                                        <span>{t.label}</span>
                                        <span className="text-[10px] text-muted-foreground">
                                            {t.description}
                                        </span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                <Field
                    icon={
                        (options.orientation || 'landscape') === 'landscape' ? (
                            <Monitor className="size-3.5" />
                        ) : (
                            <Smartphone className="size-3.5" />
                        )
                    }
                    label="Orientation"
                >
                    <div className="inline-flex w-full rounded-lg border bg-muted p-0.5">
                        {(
                            [
                                {
                                    value: 'landscape' as VideoOrientation,
                                    label: 'Landscape',
                                    icon: Monitor,
                                },
                                {
                                    value: 'portrait' as VideoOrientation,
                                    label: 'Portrait',
                                    icon: Smartphone,
                                },
                            ] as const
                        ).map(({ value, label, icon: Icon }) => (
                            <button
                                key={value}
                                type="button"
                                onClick={() => update('orientation', value)}
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
                </Field>

                <Field icon={<Clock className="size-3.5" />} label="Duration">
                    <Select
                        value={options.target_duration}
                        onValueChange={(v) => update('target_duration', v)}
                    >
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {TARGET_DURATIONS.map((d) => (
                                <SelectItem key={d} value={d} className="text-xs">
                                    {d}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                <Field icon={<SparklesIcon className="size-3.5" />} label="Quality tier">
                    <Select
                        value={options.quality_tier || 'ultra'}
                        onValueChange={(v) =>
                            onOptionsChange({
                                ...options,
                                quality_tier: v as QualityTier,
                                model: '',
                            })
                        }
                    >
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {QUALITY_TIERS.map((tier) => (
                                <SelectItem key={tier.value} value={tier.value} className="text-xs">
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
                </Field>

                <Field
                    icon={<Wand2 className="size-3.5" />}
                    label="Model override"
                    helper="Pinned automatically by tier; override only if needed."
                >
                    <Select value={options.model || ''} onValueChange={(v) => update('model', v)}>
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Auto (recommended)" />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                            {models.map((m) => (
                                <SelectItem key={m.model_id} value={m.model_id} className="text-xs">
                                    <span>{m.name}</span>
                                    {m.is_free && (
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
                </Field>
            </TabsContent>

            {/* ============================================================ */}
            {/* VOICE — Language, Gender, Provider, Voice ID, Audience       */}
            {/* ============================================================ */}
            <TabsContent value="voice" className="mt-3 space-y-3">
                <Field icon={<Globe className="size-3.5" />} label="Language">
                    <Select value={options.language} onValueChange={(v) => update('language', v)}>
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-60">
                            {Array.from(new Set(LANGUAGES.map((l) => l.group))).map(
                                (group, idx) => (
                                    <div key={group}>
                                        <div
                                            className={`${
                                                idx === 0 ? '' : 'mt-2 '
                                            }px-2 py-1 text-xs font-semibold text-muted-foreground`}
                                        >
                                            {group}
                                        </div>
                                        {LANGUAGES.filter((l) => l.group === group).map((lang) => (
                                            <SelectItem
                                                key={lang.value}
                                                value={lang.value}
                                                className="text-xs"
                                            >
                                                {lang.label}
                                            </SelectItem>
                                        ))}
                                    </div>
                                )
                            )}
                        </SelectContent>
                    </Select>
                </Field>

                <Field icon={<Mic className="size-3.5" />} label="Voice gender">
                    <Select
                        value={options.voice_gender}
                        onValueChange={(v) => update('voice_gender', v as VoiceGender)}
                    >
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {VOICE_GENDERS.map((g) => (
                                <SelectItem key={g.value} value={g.value} className="text-xs">
                                    {g.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                <Field icon={<Volume2 className="size-3.5" />} label="Audio quality">
                    <Select
                        value={options.tts_provider}
                        onValueChange={(v) => update('tts_provider', v as TtsProvider)}
                    >
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {TTS_PROVIDERS.map((p) => (
                                <SelectItem key={p.value} value={p.value} className="text-xs">
                                    <div className="flex flex-col">
                                        <span>{p.label}</span>
                                        <span className="text-[10px] text-muted-foreground">
                                            {p.description}
                                        </span>
                                    </div>
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>

                {/* Voice ID picker — premium only; standard has one fixed voice */}
                <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Mic className="size-3.5" />
                        Voice {isLoadingVoices && <Loader2 className="size-3 animate-spin" />}
                    </Label>
                    {availableVoices.length > 0 ? (
                        <div className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-1">
                            {availableVoices.map((voice) => {
                                const isSelected =
                                    options.tts_provider === 'standard'
                                        ? !options.voice_id
                                        : options.voice_id === voice.id;
                                const isPlaying = playingVoiceId === voice.id;
                                return (
                                    <div
                                        key={voice.id}
                                        className={`flex items-center justify-between rounded-md px-2 py-1.5 text-xs transition-colors ${
                                            isSelected
                                                ? 'bg-violet-50 dark:bg-violet-950/40'
                                                : 'hover:bg-muted'
                                        }`}
                                    >
                                        <button
                                            type="button"
                                            className="flex-1 text-left"
                                            onClick={() => {
                                                if (options.tts_provider === 'premium') {
                                                    onOptionsChange({
                                                        ...options,
                                                        voice_id: voice.id,
                                                    });
                                                }
                                            }}
                                        >
                                            <span className="font-medium">{voice.name}</span>
                                            <span className="ml-1 text-[10px] text-muted-foreground">
                                                {voice.provider === 'sarvam'
                                                    ? 'Sarvam'
                                                    : voice.provider === 'google'
                                                      ? 'Google'
                                                      : 'Edge'}
                                            </span>
                                        </button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="size-6 p-0"
                                            onClick={() => onPlayPreview(voice)}
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
                    ) : !isLoadingVoices ? (
                        <p className="text-[10px] text-muted-foreground">
                            No voices available for this combination.
                        </p>
                    ) : null}
                </div>

                <Field icon={<Users className="size-3.5" />} label="Audience">
                    <Select
                        value={options.target_audience}
                        onValueChange={(v) => update('target_audience', v)}
                    >
                        <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {TARGET_AUDIENCES.map((a) => (
                                <SelectItem key={a} value={a} className="text-xs">
                                    {a}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </Field>
            </TabsContent>

            {/* ============================================================ */}
            {/* VISUALS — HTML quality, Captions, Style, Branding            */}
            {/* ============================================================ */}
            <TabsContent value="visuals" className="mt-3 space-y-3">
                <Field icon={<Wand2 className="size-3.5" />} label="Visual quality">
                    <Select
                        value={options.html_quality}
                        onValueChange={(v) => update('html_quality', v as 'classic' | 'advanced')}
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
                </Field>

                <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5 text-xs">
                        <Captions className="size-3.5 text-muted-foreground" />
                        Captions
                    </Label>
                    <Switch
                        checked={options.captions_enabled}
                        onCheckedChange={(v) => update('captions_enabled', v)}
                    />
                </div>

                {/* Style — read-only, with link to AI Settings */}
                <div className="space-y-2 rounded-md border bg-muted/30 p-2.5">
                    <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-1.5 text-xs font-medium">
                            <Palette className="size-3.5 text-muted-foreground" />
                            Style
                        </Label>
                        <Link
                            to="/settings"
                            search={{ selectedTab: 'aiSettings' }}
                            className="flex items-center gap-1 text-[10px] text-violet-600 hover:underline"
                        >
                            <ExternalLink className="size-2.5" />
                            Edit
                        </Link>
                    </div>
                    <div className="space-y-1 text-[11px]">
                        <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">Theme:</span>
                            <span className="font-medium">
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
                        <div className="flex items-center gap-1.5">
                            <span
                                className="inline-block size-3 rounded-full border border-border"
                                style={{
                                    backgroundColor: videoStyle?.primary_color || '#6366f1',
                                }}
                            />
                            <span className="text-muted-foreground">Color:</span>
                            <span className="font-mono font-medium">
                                {videoStyle?.primary_color || '#6366f1'}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <TypeIcon className="size-3 text-muted-foreground" />
                            <span className="text-muted-foreground">Fonts:</span>
                            <span className="font-medium">
                                {videoStyle?.heading_font || 'Inter'}
                                {videoStyle?.body_font &&
                                    videoStyle.body_font !== videoStyle.heading_font &&
                                    ` / ${videoStyle.body_font}`}
                            </span>
                        </div>
                    </div>

                    <div className="space-y-1 border-t pt-2 text-[11px]">
                        <BrandingRow
                            icon={<Film className="size-3 text-muted-foreground" />}
                            label="Intro"
                            enabled={videoBranding?.intro?.enabled}
                            extra={
                                videoBranding?.intro?.duration_seconds
                                    ? `${videoBranding.intro.duration_seconds}s`
                                    : undefined
                            }
                        />
                        <BrandingRow
                            icon={<Film className="size-3 text-muted-foreground" />}
                            label="Outro"
                            enabled={videoBranding?.outro?.enabled}
                            extra={
                                videoBranding?.outro?.duration_seconds
                                    ? `${videoBranding.outro.duration_seconds}s`
                                    : undefined
                            }
                        />
                        <BrandingRow
                            icon={
                                <span className="size-3 text-center text-[9px] text-muted-foreground">
                                    W
                                </span>
                            }
                            label="Watermark"
                            enabled={videoBranding?.watermark?.enabled}
                            extra={videoBranding?.watermark?.position?.replace('-', ' ')}
                        />
                    </div>
                </div>
            </TabsContent>

            {/* ============================================================ */}
            {/* ADVANCED — Sub-shots, Review script, etc                     */}
            {/* ============================================================ */}
            <TabsContent value="advanced" className="mt-3 space-y-3">
                {onReviewModeChange && (
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-1.5 text-xs">
                                <FileText className="size-3.5 text-muted-foreground" />
                                Review script first
                            </Label>
                            <Switch
                                checked={!!reviewModeEnabled}
                                onCheckedChange={onReviewModeChange}
                            />
                        </div>
                        <p className="pl-5 text-[10px] text-muted-foreground">
                            Edit the AI-generated script before audio and visuals are created.
                        </p>
                    </div>
                )}

                <div className="space-y-1">
                    <div className="flex items-center justify-between">
                        <Label className="flex items-center gap-1.5 text-xs">
                            <Scissors className="size-3.5 text-muted-foreground" />
                            Sub-shot split
                            <Badge
                                variant="outline"
                                className="h-4 px-1 text-[9px] uppercase tracking-wide"
                            >
                                Exp
                            </Badge>
                        </Label>
                        <Switch
                            checked={!!options.sub_shots_enabled}
                            onCheckedChange={(v) => update('sub_shots_enabled', v)}
                        />
                    </div>
                    <p className="pl-5 text-[10px] text-muted-foreground">
                        Splits dense, motion-heavy shots into 2 focused sub-shots before HTML
                        generation. Better visual precision; small extra LLM cost.
                    </p>
                </div>
            </TabsContent>
        </Tabs>
    );
}

function Field({
    icon,
    label,
    helper,
    children,
}: {
    icon: React.ReactNode;
    label: string;
    helper?: string;
    children: React.ReactNode;
}) {
    return (
        <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {icon}
                {label}
            </Label>
            {children}
            {helper && <p className="text-[10px] text-muted-foreground">{helper}</p>}
        </div>
    );
}

function BrandingRow({
    icon,
    label,
    enabled,
    extra,
}: {
    icon: React.ReactNode;
    label: string;
    enabled?: boolean;
    extra?: string;
}) {
    return (
        <div className="flex items-center gap-1.5">
            {icon}
            <span className="text-muted-foreground">{label}:</span>
            {enabled ? (
                <span className="flex items-center gap-1 font-medium text-green-600">
                    <Check className="size-3" />
                    {extra || 'On'}
                </span>
            ) : (
                <span className="flex items-center gap-1 text-muted-foreground">
                    <X className="size-3" />
                    Off
                </span>
            )}
        </div>
    );
}

export function SettingsPopover(props: SettingsPopoverProps) {
    const [open, setOpen] = useState(false);
    const count = computeNonDefaultCount(props.options, props.reviewModeEnabled);

    // Settings render in a slide-up Sheet rather than a Popover. Popovers were
    // getting clipped because the trigger sits low on the page and the panel
    // is tall (4 tabs × multiple fields). A Sheet from the bottom always has
    // 85vh of room, scrolls cleanly, and feels native on touch devices.
    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 bg-background text-xs font-normal hover:bg-muted"
                    title="Generation settings"
                >
                    <Settings2 className="size-3.5" />
                    <span className="hidden sm:inline">Settings</span>
                    {count > 0 && (
                        <Badge
                            variant="default"
                            className="h-4 min-w-4 justify-center px-1 text-[10px]"
                        >
                            {count}
                        </Badge>
                    )}
                </Button>
            </SheetTrigger>
            <SheetContent
                side="bottom"
                className="flex max-h-[85vh] flex-col gap-0 rounded-t-xl p-0"
            >
                <SheetTitle className="border-b px-4 py-3 text-sm font-semibold">
                    Generation settings
                </SheetTitle>
                <div className="mx-auto w-full max-w-[520px] flex-1 overflow-y-auto p-4">
                    <SettingsBody {...props} />
                </div>
            </SheetContent>
        </Sheet>
    );
}
