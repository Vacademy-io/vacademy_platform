/**
 * Create / edit dialog for a Vacademy AI agent. Same field set the Settings →
 * AI Calling card exposes, laid out as a focused full-height dialog so the
 * prompt work has room to breathe.
 */
import type { TtsModelId } from '@/routes/calling/ai-agents/-services/tts-catalog';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Play, SpinnerGap, Stop } from '@phosphor-icons/react';
import { MyButton } from '@/components/design-system/button';
import { MyDialog } from '@/components/design-system/dialog';
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
import { getCurrentInstituteId } from '@/lib/auth/instituteUtils';
import { fetchBookingPages } from '@/routes/meetings/-services/meetings-services';
import { AiAgentPromptAssistant } from '@/routes/settings/-components/AiAgentPromptAssistant';
import type { AssistDerived } from '@/routes/settings/-services/ai-agent-assist';
import {
    DEFAULT_SAMPLE_TEXT,
    EXPRESSIVENESS_OPTIONS,
    FALLBACK_VOICES,
    TTS_MODELS,
    resolveTtsModel,
    voicesForModel,
    patchForModelChange,

    fetchVoices,
    saveAgent,
    voicePreviewUrl,
    type AiAgent,
} from '../-services/ai-agents';

export function AiAgentEditorDialog({
    agent,
    open,
    onOpenChange,
}: {
    /** The agent being edited, or a blank one for "new". Null while closed. */
    agent: AiAgent | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const instituteId = getCurrentInstituteId() ?? '';
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState<AiAgent | null>(agent);

    // Re-seed the draft whenever a different agent is opened.
    useEffect(() => setDraft(agent), [agent]);

    const [sampleText, setSampleText] = useState(DEFAULT_SAMPLE_TEXT);
    const [previewState, setPreviewState] = useState<'idle' | 'loading' | 'playing'>('idle');
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const voicesQuery = useQuery({
        queryKey: ['ai-agent-voices'],
        queryFn: fetchVoices,
        staleTime: 24 * 60 * 60 * 1000,
    });
    const allVoices = voicesQuery.data ?? FALLBACK_VOICES;
    // The engine decides the palette: the two share no voice names, so showing the
    // full list would let someone pick a voice that mutes every call.
    const ttsModel = draft ? resolveTtsModel(draft) : 'rumik';
    const voices = voicesForModel(allVoices, ttsModel);

    const bookingPagesQuery = useQuery({
        queryKey: ['ai-agent-booking-pages', instituteId],
        queryFn: () => fetchBookingPages({ instituteId }),
        staleTime: 60_000,
        enabled: open,
    });
    const bookingPages = bookingPagesQuery.data ?? [];

    const stopPreview = () => {
        audioRef.current?.pause();
        audioRef.current = null;
        setPreviewState('idle');
    };

    // Stop any sample still playing when the dialog closes.
    useEffect(() => {
        if (!open) stopPreview();
    }, [open]);

    const playPreview = (a: AiAgent) => {
        stopPreview();
        const audio = new Audio(voicePreviewUrl(a, sampleText));
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
        onSuccess: () => {
            toast.success('Agent saved');
            queryClient.invalidateQueries({ queryKey: ['ai-agents', instituteId] });
            queryClient.invalidateQueries({
                queryKey: ['ai-calling-campaign-options', instituteId],
            });
            onOpenChange(false);
        },
        onError: (err: unknown) => {
            const msg = (err as { response?: { data?: { ex?: string } } })?.response?.data?.ex;
            toast.error(msg ?? 'Failed to save agent');
        },
    });

    const patch = (p: Partial<AiAgent>) => setDraft((prev) => (prev ? { ...prev, ...p } : prev));

    if (!draft) return null;

    return (
        <MyDialog
            open={open}
            onOpenChange={onOpenChange}
            heading={draft.id ? `Edit ${draft.name || 'agent'}` : 'New AI agent'}
            dialogWidth="max-w-3xl"
            footer={
                <div className="flex w-full justify-end gap-2">
                    <MyButton
                        buttonType="secondary"
                        scale="medium"
                        onClick={() => onOpenChange(false)}
                    >
                        Cancel
                    </MyButton>
                    <MyButton
                        buttonType="primary"
                        scale="medium"
                        disable={saveMutation.isPending || !draft.name.trim()}
                        onClick={() => saveMutation.mutate(draft)}
                    >
                        {saveMutation.isPending ? 'Saving…' : 'Save agent'}
                    </MyButton>
                </div>
            }
        >
            <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="space-y-1.5">
                        <Label>Agent name</Label>
                        <Input
                            value={draft.name}
                            placeholder="e.g. Admissions Qualifier"
                            onChange={(e) => patch({ name: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Direction</Label>
                        <Select
                            value={draft.direction ?? 'OUTBOUND'}
                            onValueChange={(v) => patch({ direction: v as AiAgent['direction'] })}
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
                                value={draft.maxCallMinutes ?? ''}
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
                            <Label className="text-caption">Enabled</Label>
                            <Switch
                                checked={draft.enabled !== false}
                                onCheckedChange={(v) => patch({ enabled: v })}
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Language</Label>
                        <Input
                            value={draft.language ?? ''}
                            placeholder="hinglish | hi | en"
                            onChange={(e) => patch({ language: e.target.value })}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Voice engine</Label>
                        <Select
                            value={ttsModel}
                            onValueChange={(v) =>
                                patch(
                                    patchForModelChange(v as TtsModelId, draft.voice, allVoices)
                                )
                            }
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {TTS_MODELS.map((m) => (
                                    <SelectItem key={m.id} value={m.id}>
                                        {m.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-caption text-neutral-500">
                            {TTS_MODELS.find((m) => m.id === ttsModel)?.note}
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Voice</Label>
                        <Select
                            value={draft.voice ?? ''}
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
                        <p className="text-caption text-neutral-500">
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
                            value={draft.pace ?? ''}
                            placeholder="Platform default · 1.0 natural, 1.1 brisk"
                            onChange={(e) =>
                                patch({ pace: e.target.value ? Number(e.target.value) : undefined })
                            }
                        />
                        <p className="text-caption text-neutral-500">
                            0.5–2.0. 1.0–1.1 suits sales calls; above 1.2 starts to sound rushed.
                            {ttsModel === 'rumik'
                                ? ' Rumik has no numeric speed control, so this steers its delivery in words — the average pace lands where you set it, but individual sentences vary a little.'
                                : ''}
                        </p>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Expressiveness</Label>
                        <Select
                            value={
                                EXPRESSIVENESS_OPTIONS.find(
                                    (o) => o.temperature === draft.temperature
                                )?.value ?? 'default'
                            }
                            onValueChange={(v) =>
                                patch({
                                    temperature: EXPRESSIVENESS_OPTIONS.find((o) => o.value === v)
                                        ?.temperature,
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
                        <p className="text-caption text-neutral-500">
                            How much the voice varies its intonation and emotion.
                        </p>
                    </div>
                </div>

                <div className="space-y-1.5 rounded-md border border-neutral-200 p-3">
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
                                previewState === 'playing' ? stopPreview() : playPreview(draft)
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
                    <p className="text-caption text-neutral-500">
                        Speaks the sample with the selected voice, pace and expressiveness — change
                        the voice above and play again to compare. Phone calls sound slightly
                        warmer/narrower than this (telephony is 8 kHz audio).
                    </p>
                </div>

                <div className="space-y-1.5">
                    <Label>Opening line</Label>
                    <Textarea
                        rows={2}
                        value={draft.openingLine ?? ''}
                        placeholder="What the agent says the moment the call connects…"
                        onChange={(e) => patch({ openingLine: e.target.value })}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label>System prompt</Label>
                    <Textarea
                        rows={6}
                        value={draft.systemPrompt ?? ''}
                        placeholder="Who the agent is, its goal, tone, and rules…"
                        onChange={(e) => patch({ systemPrompt: e.target.value })}
                    />
                </div>
                <AiAgentPromptAssistant
                    instituteId={instituteId}
                    agentId={draft.id}
                    prompt={draft.systemPrompt ?? ''}
                    language={draft.language}
                    onPromptChange={(p) => patch({ systemPrompt: p })}
                    onApplyDerived={(d: AssistDerived) =>
                        patch({
                            ...(d.opening_line ? { openingLine: d.opening_line } : {}),
                            ...(d.extraction_questions?.length
                                ? { extractionQuestions: d.extraction_questions }
                                : {}),
                            ...(d.dispositions?.length ? { dispositions: d.dispositions } : {}),
                        })
                    }
                />

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                        <Label>Questions to find out (one per line)</Label>
                        <Textarea
                            rows={3}
                            value={(draft.extractionQuestions ?? []).join('\n')}
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
                            value={(draft.handoffNumbers ?? []).join(', ')}
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
                        <p className="text-caption text-neutral-500">
                            Blank = the voicemail/fallback number from Calling settings.
                        </p>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label>Auto-book meetings on</Label>
                    <Select
                        value={draft.bookingPageId || 'NONE'}
                        onValueChange={(v) =>
                            patch({ bookingPageId: v === 'NONE' ? undefined : v })
                        }
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="No booking page" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="NONE">Don&apos;t auto-book meetings</SelectItem>
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
                    <p className="text-caption text-neutral-500">
                        When a call agrees on a demo/visit time, a meeting is booked on this page
                        (Google Meet link + reminders sent). If the page is linked to an audience
                        list, the lead is added there too.
                        {bookingPages.length === 0 &&
                            ' Create a booking page first in CRM → Meetings → Share Booking Link.'}
                    </p>
                </div>
            </div>
        </MyDialog>
    );
}
