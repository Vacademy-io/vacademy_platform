/**
 * TTS engines and their voices.
 *
 * Standalone on purpose — imported by both the CRM agent dialog and the older
 * Settings card, and importing nothing from either, so there is no module cycle
 * and no third copy of the voice list. The backend serves the authoritative
 * catalog from `GET /ai-agents/voices`; everything here is the offline fallback
 * plus the rules for combining an engine with a voice.
 */

export type TtsModelId = 'rumik' | 'sarvam';

export interface VoiceOption {
    id: string;
    gender: string;
    /** Which engine this voice belongs to. Palettes do not overlap. */
    model: string;
}

export interface TtsModelMeta {
    id: TtsModelId;
    label: string;
    /** Shown under the picker — the price consequence, in the customer's terms. */
    note: string;
    defaultVoice: string;
}

export const TTS_MODELS: TtsModelMeta[] = [
    {
        id: 'rumik',
        label: 'Rumik Silk Mulberry 1.5',
        note: 'Included in the standard per-minute rate. Fastest to start speaking.',
        defaultVoice: 'ira',
    },
    {
        id: 'sarvam',
        label: 'Sarvam Bulbul v3',
        note: 'Adds 4 credits per minute.',
        defaultVoice: 'priya',
    },
];

const RUMIK_FEMALE = ['ira', 'emma', 'mia', 'sophia', 'ava', 'siya', 'aisha', 'zoya'];
const RUMIK_MALE = ['adam', 'lucas', 'noah', 'theo'];

const SARVAM_FEMALE = [
    'ritu', 'priya', 'neha', 'pooja', 'simran', 'kavya', 'ishita', 'shreya',
    'roopa', 'tanya', 'shruti', 'suhani', 'kavitha', 'rupali', 'niharika',
];
const SARVAM_MALE = [
    'shubh', 'aditya', 'rahul', 'rohan', 'amit', 'dev', 'ratan', 'varun',
    'manan', 'sumit', 'kabir', 'aayan', 'ashutosh', 'advait', 'anand', 'tarun',
    'sunny', 'mani', 'gokul', 'vijay', 'mohit', 'rehan', 'soham',
];

const tag = (ids: string[], gender: string, model: TtsModelId): VoiceOption[] =>
    ids.map((id) => ({ id, gender, model }));

/** Offline fallback for when the catalog endpoint is unreachable. */
export const FALLBACK_VOICES: VoiceOption[] = [
    ...tag(RUMIK_FEMALE, 'female', 'rumik'),
    ...tag(RUMIK_MALE, 'male', 'rumik'),
    ...tag(SARVAM_FEMALE, 'female', 'sarvam'),
    ...tag(SARVAM_MALE, 'male', 'sarvam'),
];

export function normalizeTtsModel(raw?: string | null): TtsModelId | null {
    const m = (raw ?? '').trim().toLowerCase();
    if (!m) return null;
    // "muga" must NOT map to rumik: Silk Muga 1 is a dearer model we do not sell
    // yet, and folding it into Mulberry would serve one engine at another's price.
    if (m === 'muga' || m.startsWith('silk-muga') || m.startsWith('silk_muga')) return null;
    if (m === 'rumik' || m.startsWith('rumik') || m.startsWith('silk') || m.startsWith('mulberry'))
        return 'rumik';
    if (m === 'sarvam' || m.startsWith('sarvam') || m.startsWith('bulbul')) return 'sarvam';
    return null;
}

/**
 * The engine an agent is on.
 *
 * A saved agent always carries one (V421 backfilled every existing row), so a
 * missing value on a SAVED agent means we are looking at a stale cache — and the
 * backend and voice bot both treat missing as `sarvam`, so we must display the
 * same thing rather than a cheerier guess. An unsaved draft has no history to
 * preserve and gets the default engine.
 */
export function resolveTtsModel(agent: { id?: string; ttsModel?: string }): TtsModelId {
    return normalizeTtsModel(agent.ttsModel) ?? 'sarvam';
}

export function voicesForModel(voices: VoiceOption[], model: TtsModelId): VoiceOption[] {
    const own = voices.filter((v) => normalizeTtsModel(v.model) === model);
    // A backend that predates model tagging returns untagged Sarvam voices; better
    // to show that list than an empty dropdown.
    return own.length ? own : voices.filter((v) => !v.model);
}

export function defaultVoiceFor(model: TtsModelId): string {
    return TTS_MODELS.find((m) => m.id === model)?.defaultVoice ?? 'priya';
}

/**
 * Switching engine also has to settle the voice, because the two palettes share no
 * names. Carried across, a voice either kills the audio (Sarvam rejects unknown
 * speakers) or is quietly swapped for a default one (Rumik does that) — and the
 * quiet swap is worse, since the call sounds fine while nobody picked that voice.
 */
export function patchForModelChange(
    model: TtsModelId,
    currentVoice: string | undefined,
    voices: VoiceOption[]
): { ttsModel: TtsModelId; voice: string } {
    const palette = voicesForModel(voices, model);
    const keep = currentVoice && palette.some((v) => v.id === currentVoice.toLowerCase());
    return { ttsModel: model, voice: keep ? currentVoice!.toLowerCase() : defaultVoiceFor(model) };
}
