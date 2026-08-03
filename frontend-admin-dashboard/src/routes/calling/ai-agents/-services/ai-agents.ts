/**
 * AI agent registry (Vacademy AI personas) — the data layer behind
 * CRM → Calling → AI Agents.
 *
 * Same endpoints the Settings → AI Calling card talks to; saving an agent
 * auto-registers it as a VACADEMY_AI campaign server-side (campaignId = agent
 * id), which is why every mutation invalidates the campaign-options cache too.
 */
import authenticatedAxiosInstance from '@/lib/auth/axiosInstance';
import { BASE_URL } from '@/constants/urls';

/** Wire shape of an AI agent — mirrors backend AiAgentDTO. */
export type { AiAgent } from '@/routes/settings/-components/AiAgentsCard';
import type { AiAgent } from '@/routes/settings/-components/AiAgentsCard';

export interface VoiceOption {
    id: string;
    gender: string;
    model: string;
}

export const AI_AGENTS_URL = `${BASE_URL}/admin-core-service/v1/telephony/ai-agents`;

/** Fallback when the catalog endpoint is unreachable — Bulbul v3 speakers. */
export const FALLBACK_VOICES: VoiceOption[] = [
    ...[
        'ritu',
        'priya',
        'neha',
        'pooja',
        'simran',
        'kavya',
        'ishita',
        'shreya',
        'roopa',
        'tanya',
        'shruti',
        'suhani',
        'kavitha',
        'rupali',
    ].map((id) => ({ id, gender: 'female', model: 'bulbul:v3' })),
    ...[
        'shubh',
        'aditya',
        'rahul',
        'rohan',
        'amit',
        'dev',
        'ratan',
        'varun',
        'manan',
        'sumit',
        'kabir',
        'aayan',
        'ashutosh',
        'advait',
        'anand',
        'tarun',
        'sunny',
        'mani',
        'gokul',
        'vijay',
        'mohit',
        'rehan',
        'soham',
    ].map((id) => ({ id, gender: 'male', model: 'bulbul:v3' })),
];

/** Expressiveness presets → Bulbul v3 temperature. */
export const EXPRESSIVENESS_OPTIONS: { label: string; value: string; temperature?: number }[] = [
    { label: 'Model default', value: 'default' },
    { label: 'Calm & steady', value: 'calm', temperature: 0.3 },
    { label: 'Natural', value: 'natural', temperature: 0.6 },
    { label: 'Expressive', value: 'expressive', temperature: 0.9 },
];

export const DEFAULT_SAMPLE_TEXT =
    'Namaste! Main Aarushi bol rahi hoon. Kya main aapse do minute baat kar sakti hoon?';

/** The agent's Language field → Sarvam TTS language code for the voice tester. */
export function previewLang(language?: string): string {
    const l = (language || '').trim().toLowerCase();
    if (l === 'english' || l === 'en' || l === 'en-in') return 'en-IN';
    return 'hi-IN';
}

/** URL of the cached TTS sample for a given voice/pace/expressiveness. */
export function voicePreviewUrl(agent: AiAgent, text: string): string {
    const params = new URLSearchParams({
        text: text.trim() || DEFAULT_SAMPLE_TEXT,
        voice: (agent.voice || 'priya').trim().toLowerCase(),
        lang: previewLang(agent.language),
        pace: String(agent.pace ?? 1.0),
    });
    if (agent.temperature != null) params.set('temperature', String(agent.temperature));
    return `${BASE_URL}/voice-bot-service/preview.mp3?${params.toString()}`;
}

export function blankAgent(instituteId: string): AiAgent {
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

export const fetchAgents = async (instituteId: string): Promise<AiAgent[]> => {
    const { data } = await authenticatedAxiosInstance.get<AiAgent[]>(AI_AGENTS_URL, {
        params: { instituteId },
    });
    return Array.isArray(data) ? data : [];
};

export const saveAgent = async (agent: AiAgent): Promise<AiAgent> => {
    const { data } = await authenticatedAxiosInstance.post<AiAgent>(AI_AGENTS_URL, agent);
    return data;
};

export const deleteAgent = async (agentId: string, instituteId: string): Promise<void> => {
    await authenticatedAxiosInstance.delete(`${AI_AGENTS_URL}/${encodeURIComponent(agentId)}`, {
        params: { instituteId },
    });
};

export const fetchVoices = async (): Promise<VoiceOption[]> => {
    const { data } = await authenticatedAxiosInstance.get<VoiceOption[]>(`${AI_AGENTS_URL}/voices`);
    return data?.length ? data : FALLBACK_VOICES;
};
