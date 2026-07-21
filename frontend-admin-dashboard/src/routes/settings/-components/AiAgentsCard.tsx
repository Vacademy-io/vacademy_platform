import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { MyButton } from '@/components/design-system/button';
import { PencilSimple, Play, Plus, Robot, SpinnerGap, Stop, Trash } from '@phosphor-icons/react';
import { fetchBookingPages } from '@/routes/meetings/-services/meetings-services';
import { toast } from 'sonner';
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import type { Campaign } from './AiCallingSettings';

/** Wire shape of an AI agent (Vacademy AI persona) — mirrors backend AiAgentDTO. */
export interface AiAgent {
    id?: string;
    instituteId: string;
    name: string;
    enabled?: boolean;
    direction?: 'OUTBOUND' | 'INBOUND' | 'BOTH';
    language?: string;
    voice?: string;
    openingLine?: string;
    systemPrompt?: string;
    extractionQuestions?: string[];
    dispositions?: string[];
    handoffNumbers?: string[];
    maxCallMinutes?: number;
    /** Speaking rate 0.5–2.0 (1.0 native); empty = platform default. */
    pace?: number;
    /** Expressiveness 0.01–2.0 (~0.6 model default); empty = model default. */
    temperature?: number;
    /** Optional booking page this agent auto-books on when a call yields a meeting request. */
    bookingPageId?: string;
}

interface VoiceOption {
    id: string;
    gender: string;
    model: string;
}

/** Fallback when the catalog endpoint is unreachable — Bulbul v3 speakers. */
const FALLBACK_VOICES: VoiceOption[] = [
    ...['ritu', 'priya', 'neha', 'pooja', 'simran', 'kavya', 'ishita', 'shreya',
        'roopa', 'tanya', 'shruti', 'suhani', 'kavitha', 'rupali']
        .map((id) => ({ id, gender: 'female', model: 'bulbul:v3' })),
    ...['shubh', 'aditya', 'rahul', 'rohan', 'amit', 'dev', 'ratan', 'varun', 'manan',
        'sumit', 'kabir', 'aayan', 'ashutosh', 'advait', 'anand', 'tarun', 'sunny',
        'mani', 'gokul', 'vijay', 'mohit', 'rehan', 'soham']
        .map((id) => ({ id, gender: 'male', model: 'bulbul:v3' })),
];

/** Expressiveness presets → Bulbul v3 temperature. */
const EXPRESSIVENESS_OPTIONS: { label: string; value: string; temperature?: number }[] = [
    { label: 'Model default', value: 'default' },
    { label: 'Calm & steady', value: 'calm', temperature: 0.3 },
    { label: 'Natural', value: 'natural', temperature: 0.6 },
    { label: 'Expressive', value: 'expressive', temperature: 0.9 },
];

const DEFAULT_SAMPLE_TEXT =
    'Namaste! Main Aarushi bol rahi hoon. Kya main aapse do minute baat kar sakti hoon?';

/** The agent's Language field → Sarvam TTS language code for the voice tester. */
function previewLang(language?: string): string {
    const l = (language || '').trim().toLowerCase();
    if (l === 'english' || l === 'en' || l === 'en-in') return 'en-IN';
    return 'hi-IN';
}

const AI_AGENTS_URL = `${BASE_URL}/admin-core-service/v1/telephony/ai-agents`;

const fetchAgents = async (instituteId: string): Promise<AiAgent[]> => {
    const { data } = await authenticatedAxiosInstance.get<AiAgent[]>(AI_AGENTS_URL, {
        params: { instituteId },
    });
    return data ?? [];
};

const saveAgent = async (agent: AiAgent): Promise<AiAgent> => {
    const { data } = await authenticatedAxiosInstance.post<AiAgent>(AI_AGENTS_URL, agent);
    return data;
};

const deleteAgent = async (agentId: string, instituteId: string): Promise<void> => {
    await authenticatedAxiosInstance.delete(`${AI_AGENTS_URL}/${encodeURIComponent(agentId)}`, {
        params: { instituteId },
    });
};

function blankAgent(instituteId: string): AiAgent {
    return {
        instituteId,
        name: '',
        enabled: true,
        direction: 'OUTBOUND',
        language: 'hinglish',
        voice: 'priya',
        openingLine: '',
        systemPrompt: '',
        extractionQuestions: [],
        handoffNumbers: [],
        maxCallMinutes: 6,
    };
}

/**
 * The Vacademy AI agent registry editor. Saving an agent auto-registers it in
 * the campaigns list server-side (campaignId = agent id, provider VACADEMY_AI) —
 * the `onBridged`/`onRemoved` callbacks mirror that into the parent settings
 * screen's unsaved local state so a later "Save changes" doesn't clobber it.
 */
export function AiAgentsCard({
    onBridged,
    onRemoved,
}: {
    onBridged: (campaign: Campaign) => void;
    onRemoved: (agentId: string) => void;
}) {
    const instituteId = getCurrentInstituteId() ?? '';
    const queryClient = useQueryClient();

    const agentsQuery = useQuery({
        queryKey: ['ai-agents', instituteId],
        queryFn: () => fetchAgents(instituteId),
        enabled: !!instituteId,
    });

    const [editing, setEditing] = useState<AiAgent | null>(null);

    // Voice tester: short sample text spoken by the currently-selected voice at the
    // chosen pace/expressiveness, via the voice-bot's cached /preview.mp3 (same TTS
    // stack as live calls, so what you hear is what callers get — minus telephony's
    // 8 kHz narrowband, which always sounds slightly crisper here than on a phone).
    const [sampleText, setSampleText] = useState(DEFAULT_SAMPLE_TEXT);
    const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'playing'>('idle');
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const bookingPagesQuery = useQuery({
        queryKey: ['ai-agent-booking-pages', instituteId],
        queryFn: () => fetchBookingPages({ instituteId }),
        staleTime: 60_000,
    });
    const bookingPages = bookingPagesQuery.data ?? [];

    const voicesQuery = useQuery({
        queryKey: ['ai-agent-voices'],
        queryFn: async (): Promise<VoiceOption[]> => {
            const { data } = await authenticatedAxiosInstance.get<VoiceOption[]>(
                `${AI_AGENTS_URL}/voices`
            );
            return data?.length ? data : FALLBACK_VOICES;
        },
        staleTime: 24 * 60 * 60 * 1000,
    });
    const voices = voicesQuery.data ?? FALLBACK_VOICES;

    const stopPreview = () => {
        audioRef.current?.pause();
        audioRef.current = null;
        setPreviewState('idle');
    };

    const playPreview = (agent: AiAgent) => {
        stopPreview();
        const voice = (agent.voice || 'priya').trim().toLowerCase();
        const params = new URLSearchParams({
            text: sampleText.trim() || DEFAULT_SAMPLE_TEXT,
            voice,
            lang: previewLang(agent.language),
            pace: String(agent.pace ?? 1.0),
        });
        if (agent.temperature != null) params.set('temperature', String(agent.temperature));
        const audio = new Audio(`${BASE_URL}/voice-bot-service/preview.mp3?${params.toString()}`);
        audioRef.current = audio;
        setPreviewState('loading');
        audio.onplaying = () => setPreviewState('playing');
        audio.onended = stopPreview;
        audio.onerror = () => {
            stopPreview();
            toast.error('Could not synthesize the sample — try again in a moment');
        };
        void audio.play().catch(() => {
            stopPreview();
            toast.error('Could not play the sample');
        });
    };

    const saveMutation = useMutation({
        mutationFn: saveAgent,
        onSuccess: (saved) => {
            toast.success('Agent saved');
            setEditing(null);
            queryClient.invalidateQueries({ queryKey: ['ai-agents', instituteId] });
            queryClient.invalidateQueries({ queryKey: ['ai-calling-campaign-options', instituteId] });
            if (saved.id) {
                if (saved.enabled === false) {
                    onRemoved(saved.id);
                } else {
                    onBridged({
                        campaignId: saved.id,
                        name: saved.name,
                        direction: saved.direction === 'INBOUND' ? 'INBOUND' : 'OUTBOUND',
                        provider: 'VACADEMY_AI',
                    });
                }
            }
        },
        onError: (err: unknown) => {
            const msg = (err as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? 'Failed to save agent');
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (agentId: string) => deleteAgent(agentId, instituteId),
        onSuccess: (_res, agentId) => {
            toast.success('Agent deleted');
            queryClient.invalidateQueries({ queryKey: ['ai-agents', instituteId] });
            queryClient.invalidateQueries({ queryKey: ['ai-calling-campaign-options', instituteId] });
            onRemoved(agentId);
        },
        onError: () => toast.error('Failed to delete agent'),
    });

    const agents = agentsQuery.data ?? [];
    const patch = (p: Partial<AiAgent>) => setEditing((prev) => (prev ? { ...prev, ...p } : prev));

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Robot className="size-5" /> AI Agents (Vacademy AI)
                </CardTitle>
                <CardDescription>
                    Author the personas our own AI caller speaks with — the prompt, opening line,
                    language, voice and what to find out. Saving an agent automatically registers it
                    under Campaigns / Agents above, so workflows and the IVR can pick it by name.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                {agentsQuery.isLoading && (
                    <p className="text-xs text-muted-foreground">Loading agents…</p>
                )}
                {!agentsQuery.isLoading && agents.length === 0 && !editing && (
                    <p className="text-xs text-muted-foreground">
                        No agents yet. Create one — e.g. an “Admissions Qualifier” that greets new
                        leads and finds out the student’s class and course interest.
                    </p>
                )}

                {agents.map((a) => (
                    <div
                        key={a.id}
                        className="flex items-center justify-between gap-3 rounded-md border p-3"
                    >
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                                {a.name}
                                {a.enabled === false && (
                                    <span className="ml-2 text-xs text-muted-foreground">
                                        (disabled)
                                    </span>
                                )}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                                {a.direction ?? 'OUTBOUND'} · {a.language ?? 'hinglish'} · voice{' '}
                                {a.voice ?? 'priya'}
                                {a.maxCallMinutes ? ` · max ${a.maxCallMinutes} min` : ''}
                            </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                            <MyButton
                                buttonType="secondary"
                                scale="medium"
                                onClick={() => setEditing({ ...blankAgent(instituteId), ...a })}
                            >
                                <PencilSimple className="size-4" />
                            </MyButton>
                            <MyButton
                                buttonType="secondary"
                                scale="medium"
                                onClick={() => a.id && deleteMutation.mutate(a.id)}
                            >
                                <Trash className="size-4" />
                            </MyButton>
                        </div>
                    </div>
                ))}

                {editing ? (
                    <div className="space-y-3 rounded-md border border-dashed p-4">
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                            <div className="space-y-1.5">
                                <Label>Agent name</Label>
                                <Input
                                    value={editing.name}
                                    placeholder="e.g. Admissions Qualifier"
                                    onChange={(e) => patch({ name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Direction</Label>
                                <Select
                                    value={editing.direction ?? 'OUTBOUND'}
                                    onValueChange={(v) =>
                                        patch({ direction: v as AiAgent['direction'] })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="OUTBOUND">Outbound</SelectItem>
                                        <SelectItem value="INBOUND">Inbound</SelectItem>
                                        <SelectItem value="BOTH">Both</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex items-end justify-between gap-3">
                                <div className="flex-1 space-y-1.5">
                                    <Label>Max call minutes</Label>
                                    <Input
                                        type="number"
                                        value={editing.maxCallMinutes ?? ''}
                                        onChange={(e) =>
                                            patch({
                                                maxCallMinutes: e.target.value
                                                    ? Number(e.target.value)
                                                    : undefined,
                                            })
                                        }
                                    />
                                </div>
                                <div className="flex items-center gap-2 pb-2">
                                    <Label className="text-xs">Enabled</Label>
                                    <Switch
                                        checked={editing.enabled !== false}
                                        onCheckedChange={(v) => patch({ enabled: v })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Language</Label>
                                <Input
                                    value={editing.language ?? ''}
                                    placeholder="hinglish | hi | en"
                                    onChange={(e) => patch({ language: e.target.value })}
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Voice</Label>
                                <Select
                                    value={editing.voice ?? ''}
                                    onValueChange={(v) => patch({ voice: v })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Pick a voice…" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {voices.map((v) => (
                                            <SelectItem key={v.id} value={v.id}>
                                                {v.id.charAt(0).toUpperCase() + v.id.slice(1)} ·{' '}
                                                {v.gender === 'male' ? 'Male' : 'Female'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    The bot matches its Hindi grammar (kar rahi/raha hoon) to the
                                    voice&apos;s gender automatically.
                                </p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Speaking pace</Label>
                                <Input
                                    type="number"
                                    min={0.5}
                                    max={2}
                                    step={0.05}
                                    value={editing.pace ?? ''}
                                    placeholder="Platform default · 1.0 natural, 1.1 brisk"
                                    onChange={(e) =>
                                        patch({
                                            pace: e.target.value
                                                ? Number(e.target.value)
                                                : undefined,
                                        })
                                    }
                                />
                                <p className="text-xs text-muted-foreground">
                                    0.5–2.0. Sarvam recommends 1.0–1.1 for sales calls; above 1.2
                                    starts to sound rushed.
                                </p>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Expressiveness</Label>
                                <Select
                                    value={
                                        EXPRESSIVENESS_OPTIONS.find(
                                            (o) => o.temperature === editing.temperature
                                        )?.value ?? 'default'
                                    }
                                    onValueChange={(v) =>
                                        patch({
                                            temperature: EXPRESSIVENESS_OPTIONS.find(
                                                (o) => o.value === v
                                            )?.temperature,
                                        })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {EXPRESSIVENESS_OPTIONS.map((o) => (
                                            <SelectItem key={o.value} value={o.value}>
                                                {o.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    How much the voice varies its intonation and emotion.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-1.5 rounded-md border p-3">
                            <Label>Test this voice</Label>
                            <div className="flex items-center gap-2">
                                <Input
                                    value={sampleText}
                                    maxLength={300}
                                    placeholder={DEFAULT_SAMPLE_TEXT}
                                    onChange={(e) => setSampleText(e.target.value)}
                                />
                                <MyButton
                                    buttonType="secondary"
                                    scale="medium"
                                    disable={previewState === 'loading'}
                                    onClick={() =>
                                        previewState === 'playing'
                                            ? stopPreview()
                                            : playPreview(editing)
                                    }
                                >
                                    {previewState === 'loading' ? (
                                        <SpinnerGap className="size-4 animate-spin" />
                                    ) : previewState === 'playing' ? (
                                        <Stop className="size-4" />
                                    ) : (
                                        <Play className="size-4" />
                                    )}
                                    {previewState === 'playing' ? 'Stop' : 'Play'}
                                </MyButton>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Speaks the sample with the selected voice, pace and expressiveness —
                                change the voice above and play again to compare. Phone calls sound
                                slightly warmer/narrower than this (telephony is 8 kHz audio).
                            </p>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Opening line</Label>
                            <Textarea
                                rows={2}
                                value={editing.openingLine ?? ''}
                                placeholder="What the agent says the moment the call connects…"
                                onChange={(e) => patch({ openingLine: e.target.value })}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label>System prompt</Label>
                            <Textarea
                                rows={5}
                                value={editing.systemPrompt ?? ''}
                                placeholder="Who the agent is, its goal, tone, and rules…"
                                onChange={(e) => patch({ systemPrompt: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Questions to find out (one per line)</Label>
                                <Textarea
                                    rows={3}
                                    value={(editing.extractionQuestions ?? []).join('\n')}
                                    placeholder={
                                        'What class is the student in?\nWhich course are they interested in?'
                                    }
                                    onChange={(e) =>
                                        patch({
                                            extractionQuestions: e.target.value
                                                .split('\n')
                                                .map((s) => s.trim())
                                                .filter(Boolean),
                                        })
                                    }
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Handoff numbers (comma separated)</Label>
                                <Input
                                    value={(editing.handoffNumbers ?? []).join(', ')}
                                    placeholder="+9198xxxxxxxx — who gets the call when the caller asks for a human"
                                    onChange={(e) =>
                                        patch({
                                            handoffNumbers: e.target.value
                                                .split(',')
                                                .map((s) => s.trim())
                                                .filter(Boolean),
                                        })
                                    }
                                />
                                <p className="text-xs text-muted-foreground">
                                    Blank = the voicemail/fallback number from Calling settings.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label>Auto-book meetings on</Label>
                            <Select
                                value={editing.bookingPageId || 'NONE'}
                                onValueChange={(v) =>
                                    patch({ bookingPageId: v === 'NONE' ? undefined : v })
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="No booking page" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="NONE">
                                        Don&apos;t auto-book meetings
                                    </SelectItem>
                                    {bookingPages.map((bp) => (
                                        <SelectItem key={bp.id} value={bp.id ?? ''}>
                                            {bp.title}
                                            {bp.audience_id
                                                ? ' · adds lead to its audience list'
                                                : ' · not linked to a list'}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                                When a call agrees on a demo/visit time, a meeting is booked on
                                this page (Google Meet link + reminders sent). If the page is
                                linked to an audience list, the lead is added there too.
                                {bookingPages.length === 0 &&
                                    ' Create a booking page first in CRM → Meetings → Share Booking Link.'}
                            </p>
                        </div>

                        <div className="flex justify-end gap-2">
                            <MyButton
                                buttonType="secondary"
                                scale="medium"
                                onClick={() => setEditing(null)}
                            >
                                Cancel
                            </MyButton>
                            <MyButton
                                buttonType="primary"
                                scale="medium"
                                disable={saveMutation.isPending || !editing.name.trim()}
                                onClick={() => saveMutation.mutate(editing)}
                            >
                                {saveMutation.isPending ? 'Saving…' : 'Save agent'}
                            </MyButton>
                        </div>
                    </div>
                ) : (
                    <div>
                        <MyButton
                            buttonType="secondary"
                            scale="medium"
                            onClick={() => setEditing(blankAgent(instituteId))}
                        >
                            <Plus className="size-4" /> New agent
                        </MyButton>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
