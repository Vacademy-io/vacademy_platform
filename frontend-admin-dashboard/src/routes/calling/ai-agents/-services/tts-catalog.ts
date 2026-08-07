/**
 * TTS engines and their voices.
 *
 * Standalone on purpose — imported by both the CRM agent dialog and the older
 * Settings card, and importing nothing from either, so there is no module cycle
 * and no third copy of the voice list. The backend serves the authoritative
 * catalog from `GET /ai-agents/voices`; everything here is the offline fallback
 * plus the rules for combining an engine with a voice.
 */

export type TtsModelId = 'google' | 'edge' | 'smallest' | 'rumik' | 'sarvam';

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
        id: 'google',
        label: 'Google Chirp3-HD',
        // The founder chose this by ear over every other engine, and it is also
        // cheaper per call-minute than Sarvam (measured on our own traffic:
        // 779 characters per call-minute, so $30/1M lands at ~Rs 2.06 against
        // Sarvam's Rs 2.34), with ~1,280 free minutes a month.
        note: 'Recommended — clearest Hindi, and cheaper per minute than Sarvam.',
        defaultVoice: 'hi-IN-Chirp3-HD-Achird',
    },
    {
        id: 'edge',
        label: 'Microsoft Edge (free)',
        // Costs us nothing per character, so it is sold at a flat Rs 2/minute.
        // Slower to first audio than Chirp3-HD (0.27s vs 0.18s, measured), and
        // despite "offline" it calls Microsoft's public endpoint — a network
        // dependency with no SLA behind it.
        note: 'Free to run, so billed at a lower flat rate. Starts ~0.1s slower.',
        defaultVoice: 'hi-IN-SwaraNeural',
    },
    {
        id: 'smallest',
        label: 'Smallest.ai Lightning v3.1',
        note: 'Indian-language specialist. Included in the standard per-minute rate.',
        defaultVoice: 'devansh',
    },
    {
        id: 'rumik',
        label: 'Rumik Silk Mulberry 1.5',
        note: 'Cheapest, but mispronounces some Hindi words over the phone.',
        defaultVoice: 'ira',
    },
    {
        id: 'sarvam',
        label: 'Sarvam Bulbul v3',
        note: 'Adds 4 credits per minute.',
        defaultVoice: 'priya',
    },
];

// Google Cloud hi-IN voices, curated from its live list_voices API. Genders are
// Google's OWN ssml_gender: nothing in "Achird" (male) or "Achernar" (female)
// hints at it, and the bot conjugates Hindi verbs from the gender, so a wrong
// entry makes a male voice say "kar rahi hoon".
// ⚠️ CASE IS SIGNIFICANT — Google voice names are exact resource ids. Never
// lowercase them on the way to the API (see voiceIdOf below).
const GOOGLE_MALE = [
    'hi-IN-Chirp3-HD-Achird', 'hi-IN-Chirp3-HD-Charon', 'hi-IN-Chirp3-HD-Fenrir',
    'hi-IN-Chirp3-HD-Orus', 'hi-IN-Chirp3-HD-Puck', 'hi-IN-Chirp3-HD-Schedar',
    'hi-IN-Neural2-B', 'hi-IN-Neural2-C', 'hi-IN-Wavenet-B', 'hi-IN-Wavenet-C',
];
const GOOGLE_FEMALE = [
    'hi-IN-Chirp3-HD-Achernar', 'hi-IN-Chirp3-HD-Aoede', 'hi-IN-Chirp3-HD-Kore',
    'hi-IN-Chirp3-HD-Leda', 'hi-IN-Chirp3-HD-Zephyr', 'hi-IN-Chirp3-HD-Sulafat',
    'hi-IN-Neural2-A', 'hi-IN-Neural2-D', 'hi-IN-Wavenet-A', 'hi-IN-Wavenet-D',
];

// Smallest.ai Lightning v3.1 (standard) Hindi voices, Indian accent, from its
// live get_voices catalog. Only v3.1 names: the palettes are per-model and the
// API rejects a _pro voice on the standard model outright — a silent call.
const SMALLEST_MALE = ['devansh', 'kaustubh', 'virat', 'karan', 'yash', 'debashis'];
const SMALLEST_FEMALE = ['imogen', 'nirupma', 'niharika'];

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

// Microsoft Edge read-aloud. Only five voices exist for India; names are
// locale-prefixed and end in Neural, which is how the bot spots one that
// belongs to another vendor.
const EDGE_FEMALE = ['hi-IN-SwaraNeural', 'en-IN-NeerjaNeural', 'en-IN-NeerjaExpressiveNeural'];
const EDGE_MALE = ['hi-IN-MadhurNeural', 'en-IN-PrabhatNeural'];

const tag = (ids: string[], gender: string, model: TtsModelId): VoiceOption[] =>
    ids.map((id) => ({ id, gender, model }));

/** Offline fallback for when the catalog endpoint is unreachable. */
export const FALLBACK_VOICES: VoiceOption[] = [
    ...tag(GOOGLE_MALE, 'male', 'google'),
    ...tag(GOOGLE_FEMALE, 'female', 'google'),
    ...tag(EDGE_FEMALE, 'female', 'edge'),
    ...tag(EDGE_MALE, 'male', 'edge'),
    ...tag(SMALLEST_MALE, 'male', 'smallest'),
    ...tag(SMALLEST_FEMALE, 'female', 'smallest'),
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
    if (m === 'google' || m.startsWith('google') || m.startsWith('chirp')) return 'google';
    if (m === 'edge' || m.startsWith('edge') || m.startsWith('microsoft')) return 'edge';
    if (m === 'smallest' || m.startsWith('smallest') || m.startsWith('lightning'))
        return 'smallest';
    return null;
}

/**
 * The id to send to the API for a voice the user picked or an agent has stored.
 *
 * Case matters for Google (`hi-IN-Chirp3-HD-Achird` is an exact resource name —
 * lowercasing it makes Google reject the request, and the bot then falls back to
 * Sarvam, so the admin picks one engine and the caller hears another). Sarvam,
 * Rumik and Smallest ids are already lowercase, so canonicalising against the
 * palette is both safe and enough: match case-insensitively, return the
 * palette's spelling.
 */
export function voiceIdOf(voice: string | undefined, voices: VoiceOption[]): string {
    const raw = (voice ?? '').trim();
    if (!raw) return '';
    const hit = voices.find((v) => v.id.toLowerCase() === raw.toLowerCase());
    return hit ? hit.id : raw;
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
    // A SAVED agent without the field is a stale cache, and the backend and bot
    // both read a missing value as sarvam — so show that, not a cheerier guess.
    // An unsaved draft has no history to preserve and gets the default engine.
    return normalizeTtsModel(agent.ttsModel) ?? (agent.id ? 'sarvam' : 'google');
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
    // Case-insensitive match, but keep the PALETTE's spelling: Google's ids are
    // case-sensitive resource names (see voiceIdOf).
    const hit = currentVoice
        ? palette.find((v) => v.id.toLowerCase() === currentVoice.trim().toLowerCase())
        : undefined;
    return { ttsModel: model, voice: hit ? hit.id : defaultVoiceFor(model) };
}
