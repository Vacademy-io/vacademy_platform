package vacademy.io.admin_core_service.features.telephony.core;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * The TTS engines we sell and the voices each one actually has.
 *
 * <p>ONE source of truth on the backend, because the voice list previously existed
 * in three hand-maintained copies (this controller, two frontend files) plus the
 * voice bot's Hindi gender map — and they drift silently. The frontend now reads
 * {@code GET /ai-agents/voices}, which is served from here.
 *
 * <p>Two invariants this class exists to protect:
 *
 * <ol>
 *   <li><b>Palettes do not overlap.</b> Sarvam bulbul:v3 and Rumik Silk Mulberry
 *       share not one voice name, and the wrong one fails differently on each
 *       (both probed live): Sarvam returns 400, i.e. no audio at all; Rumik silently
 *       falls back to a default speaker — {@code priya} yielded 184 KB of clean
 *       audio. The quiet substitution is the more dangerous of the two, because the
 *       call sounds fine while the voice is not the one anyone chose and the Hindi
 *       verb gender was conjugated for the configured voice instead.
 *   <li><b>Gender is load-bearing, not decoration.</b> Hindi first-person verbs are
 *       gendered, so the voice bot conjugates from a speaker-to-gender map. A voice
 *       whose gender is wrong here makes a male voice say {@code kar rahi hoon} —
 *       the single most immersion-breaking defect on these calls. This table and
 *       {@code voice_bot_service/app/bot.py} ({@code _MALE_VOICES},
 *       {@code RUMIK_VOICES}) MUST agree.
 * </ol>
 */
public final class TtsVoiceCatalog {

    private TtsVoiceCatalog() {}

    /** Rumik Silk Mulberry 1.5 — default for new agents. Rs 0.50/1k chars. */
    public static final String MODEL_RUMIK = "rumik";
    /** Sarvam bulbul:v3 — Rs 3.00/1k chars, carries the +4 credits/min surcharge. */
    public static final String MODEL_SARVAM = "sarvam";

    /**
     * Sarvam Bulbul v3 speakers (37, verified against docs.sarvam.ai 2026-07-16).
     * Genders per the voice bot's map.
     */
    private static final List<Map<String, String>> SARVAM_VOICES = List.of(
            v("ritu", "female", MODEL_SARVAM), v("priya", "female", MODEL_SARVAM),
            v("neha", "female", MODEL_SARVAM), v("pooja", "female", MODEL_SARVAM),
            v("simran", "female", MODEL_SARVAM), v("kavya", "female", MODEL_SARVAM),
            v("ishita", "female", MODEL_SARVAM), v("shreya", "female", MODEL_SARVAM),
            v("roopa", "female", MODEL_SARVAM), v("tanya", "female", MODEL_SARVAM),
            v("shruti", "female", MODEL_SARVAM), v("suhani", "female", MODEL_SARVAM),
            v("kavitha", "female", MODEL_SARVAM), v("rupali", "female", MODEL_SARVAM),
            v("niharika", "female", MODEL_SARVAM),
            v("shubh", "male", MODEL_SARVAM), v("aditya", "male", MODEL_SARVAM),
            v("rahul", "male", MODEL_SARVAM), v("rohan", "male", MODEL_SARVAM),
            v("amit", "male", MODEL_SARVAM), v("dev", "male", MODEL_SARVAM),
            v("ratan", "male", MODEL_SARVAM), v("varun", "male", MODEL_SARVAM),
            v("manan", "male", MODEL_SARVAM), v("sumit", "male", MODEL_SARVAM),
            v("kabir", "male", MODEL_SARVAM), v("aayan", "male", MODEL_SARVAM),
            v("ashutosh", "male", MODEL_SARVAM), v("advait", "male", MODEL_SARVAM),
            v("anand", "male", MODEL_SARVAM), v("tarun", "male", MODEL_SARVAM),
            v("sunny", "male", MODEL_SARVAM), v("mani", "male", MODEL_SARVAM),
            v("gokul", "male", MODEL_SARVAM), v("vijay", "male", MODEL_SARVAM),
            v("mohit", "male", MODEL_SARVAM), v("rehan", "male", MODEL_SARVAM),
            v("soham", "male", MODEL_SARVAM));

    /**
     * Rumik Silk Mulberry 1.5 preset studio voices (docs.rumik.ai/mulberry).
     * Handles romanized Hindi correctly — verified by synthesizing both spellings
     * and reading the audio back through Sarvam STT, so no prompt change was needed
     * when switching engines.
     */
    private static final List<Map<String, String>> RUMIK_VOICES = List.of(
            v("ira", "female", MODEL_RUMIK), v("emma", "female", MODEL_RUMIK),
            v("mia", "female", MODEL_RUMIK), v("sophia", "female", MODEL_RUMIK),
            v("ava", "female", MODEL_RUMIK), v("siya", "female", MODEL_RUMIK),
            v("aisha", "female", MODEL_RUMIK), v("zoya", "female", MODEL_RUMIK),
            v("adam", "male", MODEL_RUMIK), v("lucas", "male", MODEL_RUMIK),
            v("noah", "male", MODEL_RUMIK), v("theo", "male", MODEL_RUMIK));

    private static final Map<String, List<Map<String, String>>> BY_MODEL = Map.of(
            MODEL_SARVAM, SARVAM_VOICES,
            MODEL_RUMIK, RUMIK_VOICES);

    private static final Map<String, Set<String>> IDS_BY_MODEL = new LinkedHashMap<>();
    static {
        BY_MODEL.forEach((model, voices) -> IDS_BY_MODEL.put(model,
                voices.stream().map(m -> m.get("id")).collect(Collectors.toSet())));
    }

    /** Every voice, model-tagged. The frontend groups by {@code model}. */
    public static List<Map<String, String>> all() {
        return java.util.stream.Stream.concat(RUMIK_VOICES.stream(), SARVAM_VOICES.stream()).toList();
    }

    public static List<Map<String, String>> forModel(String model) {
        return BY_MODEL.getOrDefault(normalizeModel(model), SARVAM_VOICES);
    }

    /** Default voice when none is set, or when a cross-vendor name had to be dropped. */
    public static String defaultVoice(String model) {
        return MODEL_RUMIK.equals(normalizeModel(model)) ? "ira" : "priya";
    }

    /** True when {@code voice} is in {@code model}'s palette (case-insensitive). */
    public static boolean isVoiceOf(String model, String voice) {
        if (voice == null || voice.isBlank()) return false;
        return IDS_BY_MODEL.getOrDefault(normalizeModel(model), Set.of())
                .contains(voice.trim().toLowerCase(Locale.ROOT));
    }

    /**
     * Canonical engine key, or null when unrecognised.
     *
     * <p>Tolerant of what a client might plausibly send for the same engine
     * ({@code silk}, {@code mulberry}, {@code silk-mulberry}, {@code bulbul}) but
     * NOT of anything that merely looks adjacent. In particular {@code muga} does
     * not resolve to Rumik: Silk Muga 1 is a dearer model we have not wired, and
     * mapping it onto Mulberry would serve one engine while charging for another.
     * Unrecognised values are rejected by the caller rather than defaulted, so a
     * typo can never quietly reprice an agent.
     */
    public static String normalizeModel(String raw) {
        if (raw == null) return null;
        String m = raw.trim().toLowerCase(Locale.ROOT);
        if (m.isEmpty()) return null;
        if (m.equals("muga") || m.startsWith("silk-muga") || m.startsWith("silk_muga")) return null;
        if (m.equals(MODEL_RUMIK) || m.startsWith("rumik") || m.startsWith("silk")
                || m.startsWith("mulberry")) return MODEL_RUMIK;
        if (m.equals(MODEL_SARVAM) || m.startsWith("sarvam") || m.startsWith("bulbul")) return MODEL_SARVAM;
        return null;
    }

    /** For the picker: engines with their label and voice list. */
    public static List<Map<String, Object>> models() {
        List<Map<String, Object>> out = new java.util.ArrayList<>();
        out.add(model(MODEL_RUMIK, "Rumik Silk Mulberry 1.5", "Recommended — fastest and included in the base rate"));
        out.add(model(MODEL_SARVAM, "Sarvam Bulbul v3", "+4 credits per minute"));
        return out;
    }

    private static Map<String, Object> model(String id, String label, String note) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", id);
        m.put("label", label);
        m.put("note", note);
        m.put("defaultVoice", defaultVoice(id));
        m.put("voices", BY_MODEL.get(id));
        return m;
    }

    private static Map<String, String> v(String id, String gender, String model) {
        return Map.of("id", id, "gender", gender, "model", model);
    }
}
