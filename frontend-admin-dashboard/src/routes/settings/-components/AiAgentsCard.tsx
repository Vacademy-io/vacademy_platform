import { useState } from 'react';
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
import { PencilSimple, Plus, Robot, Trash } from '@phosphor-icons/react';
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
                                <Input
                                    value={editing.voice ?? ''}
                                    placeholder="Sarvam voice id, e.g. priya"
                                    onChange={(e) => patch({ voice: e.target.value })}
                                />
                            </div>
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
