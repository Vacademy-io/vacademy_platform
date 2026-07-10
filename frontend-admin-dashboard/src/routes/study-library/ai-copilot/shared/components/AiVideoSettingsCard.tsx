import { useQuery } from '@tanstack/react-query';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { useAIModelsList } from '@/hooks/useAiModels';
import { AI_SERVICE_BASE_URL } from '@/constants/urls';
import { VideoCamera } from '@phosphor-icons/react';

/**
 * Course-level AI-video settings, applied to every AI Video / AI Slides /
 * AI Storybook page of the generated course. Sent to the backend as the
 * content request's `video_settings` (snake_case keys) where they are
 * injected into each video todo's metadata.
 */
export interface AiVideoSettings {
    model: string; // 'auto' → let the backend registry pick
    voiceGender: 'female' | 'male';
    ttsProvider: 'standard' | 'premium';
    voiceId: string; // '' → auto-pick by language + gender
    targetDuration: string;
    qualityTier: string;
}

export const DEFAULT_AI_VIDEO_SETTINGS: AiVideoSettings = {
    model: 'auto',
    voiceGender: 'female',
    ttsProvider: 'standard',
    voiceId: '',
    targetDuration: '2-3 minutes',
    qualityTier: 'ultra',
};

/** Map wizard settings to the backend `video_settings` payload (omit autos). */
export function toVideoSettingsPayload(
    settings: AiVideoSettings | undefined
): Record<string, string> {
    if (!settings) return {};
    const payload: Record<string, string> = {
        voice_gender: settings.voiceGender,
        tts_provider: settings.ttsProvider,
        quality_tier: settings.qualityTier,
        target_duration: settings.targetDuration,
    };
    if (settings.model && settings.model !== 'auto') payload.model = settings.model;
    if (settings.voiceId) payload.voice_id = settings.voiceId;
    return payload;
}

interface TtsVoice {
    id: string;
    name: string;
    provider: string;
    sample_url: string;
}

async function fetchVoices(
    language: string,
    gender: string,
    tier: string
): Promise<{ voices: TtsVoice[] }> {
    // The voices endpoint keys English by region ("English (US)"), while the
    // wizard's language is plain "English" — without this the premium list
    // degrades to a single Edge voice that the Google TTS path can't play.
    const normalizedLanguage =
        language.trim().toLowerCase() === 'english' ? 'English (US)' : language;
    const params = new URLSearchParams({ language: normalizedLanguage, gender, tier });
    const resp = await fetch(`${AI_SERVICE_BASE_URL}/external/video/v1/tts/voices?${params}`);
    if (!resp.ok) throw new Error(`Failed to fetch voices: ${resp.status}`);
    return resp.json();
}

const DURATIONS = ['1-2 minutes', '2-3 minutes', '3-5 minutes', '5-8 minutes'];
const QUALITY_TIERS = [
    { value: 'free', label: 'Free (fastest, basic quality)' },
    { value: 'standard', label: 'Standard' },
    { value: 'premium', label: 'Premium' },
    { value: 'ultra', label: 'Ultra (best quality)' },
];

interface AiVideoSettingsCardProps {
    value: AiVideoSettings;
    onChange: (value: AiVideoSettings) => void;
    language: string;
}

export function AiVideoSettingsCard({ value, onChange, language }: AiVideoSettingsCardProps) {
    const { data: modelsList, isLoading: modelsLoading } = useAIModelsList({ use_case: 'video' });
    const { data: voicesData, isLoading: voicesLoading } = useQuery({
        queryKey: ['tts-voices', language, value.voiceGender, value.ttsProvider],
        queryFn: () => fetchVoices(language, value.voiceGender, value.ttsProvider),
        staleTime: 1000 * 60 * 10,
    });

    const set = (patch: Partial<AiVideoSettings>) => onChange({ ...value, ...patch });

    return (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
            <div className="mb-3 flex items-center gap-2">
                <VideoCamera className="size-4 text-neutral-500" />
                <span className="text-sm font-semibold text-neutral-900">AI Video Settings</span>
                <span className="text-xs text-neutral-500">
                    applies to AI Video, AI Slides &amp; Storybook pages
                </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                    <Label className="mb-1 block text-xs text-neutral-600">Video model</Label>
                    <Select value={value.model} onValueChange={(v) => set({ model: v })}>
                        <SelectTrigger className="h-9 bg-white text-xs">
                            <SelectValue placeholder="Auto (recommended)" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="auto">Auto (recommended)</SelectItem>
                            {modelsLoading ? (
                                <div className="px-2 py-1.5 text-xs text-neutral-500">
                                    Loading...
                                </div>
                            ) : (
                                modelsList?.models.map((model) => (
                                    <SelectItem key={model.model_id} value={model.model_id}>
                                        {model.name}
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label className="mb-1 block text-xs text-neutral-600">Audio quality</Label>
                    <Select
                        value={value.ttsProvider}
                        onValueChange={(v) =>
                            set({ ttsProvider: v as AiVideoSettings['ttsProvider'], voiceId: '' })
                        }
                    >
                        <SelectTrigger className="h-9 bg-white text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="standard">Standard (included)</SelectItem>
                            <SelectItem value="premium">Premium (2x credits)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label className="mb-1 block text-xs text-neutral-600">Voice gender</Label>
                    <Select
                        value={value.voiceGender}
                        onValueChange={(v) =>
                            set({ voiceGender: v as AiVideoSettings['voiceGender'], voiceId: '' })
                        }
                    >
                        <SelectTrigger className="h-9 bg-white text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="male">Male</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label className="mb-1 block text-xs text-neutral-600">Voice</Label>
                    <Select
                        value={value.voiceId || 'auto'}
                        onValueChange={(v) => set({ voiceId: v === 'auto' ? '' : v })}
                    >
                        <SelectTrigger className="h-9 bg-white text-xs">
                            <SelectValue placeholder="Auto" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="auto">Auto (best for language)</SelectItem>
                            {voicesLoading ? (
                                <div className="px-2 py-1.5 text-xs text-neutral-500">
                                    Loading...
                                </div>
                            ) : (
                                voicesData?.voices.map((voice) => (
                                    <SelectItem key={voice.id} value={voice.id}>
                                        {voice.name}
                                    </SelectItem>
                                ))
                            )}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label className="mb-1 block text-xs text-neutral-600">Video duration</Label>
                    <Select
                        value={value.targetDuration}
                        onValueChange={(v) => set({ targetDuration: v })}
                    >
                        <SelectTrigger className="h-9 bg-white text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {DURATIONS.map((duration) => (
                                <SelectItem key={duration} value={duration}>
                                    {duration}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label className="mb-1 block text-xs text-neutral-600">Quality tier</Label>
                    <Select
                        value={value.qualityTier}
                        onValueChange={(v) => set({ qualityTier: v })}
                    >
                        <SelectTrigger className="h-9 bg-white text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {QUALITY_TIERS.map((tier) => (
                                <SelectItem key={tier.value} value={tier.value}>
                                    {tier.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}
