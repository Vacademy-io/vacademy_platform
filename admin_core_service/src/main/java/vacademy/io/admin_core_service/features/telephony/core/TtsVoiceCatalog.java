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
     * Google Cloud TTS, Chirp3-HD tier — the founder picked it BY EAR on 2026-08-05
     * over Sarvam, Rumik and Google's own Neural2/WaveNet/Standard tiers, after Rumik
     * garbled core Hindi on the phone leg (a caller asked what "प्रतिलत" meant; the
     * model had written "प्रतिशत").
     *
     * <p>Economics, measured from our OWN calls rather than assumed — 779 characters
     * per CALL-minute across 13 production calls: $30/1M chars works out to
     * ~Rs 2.06/call-minute against Sarvam's Rs 2.34. It is CHEAPER than what we ship
     * today, and Chirp3-HD carries 1M free characters a month (~1,280 call-minutes).
     * Neural2/WaveNet ($16/1M ≈ Rs 1.10) are the cheaper fallback tiers.
     *
     * <p>No new vendor: it authenticates with the SAME service account as the Vertex
     * LLM. Voice ids are locale-prefixed ({@code hi-IN-Chirp3-HD-Achird}), so a
     * cross-vendor name is impossible to confuse with the other palettes.
     */
    public static final String MODEL_EDGE = "edge";
    public static final String MODEL_GOOGLE = "google";
    /**
     * Smallest.ai Lightning — Indian-language specialist (146 of its 234
     * lightning_v3.1 voices are Hindi-capable), added alongside Google on the
     * founder's instruction so the two can be compared on real calls.
     *
     * <p>⚠️ Its palettes are PER-MODEL and do not overlap: the API hard-rejects a
     * cross-model voice ("Voice 'devansh' is not available on the lightning_v3.1_pro
     * model"), which on a live call means silence. Only the lightning_v3.1 (standard)
     * palette is exposed here; that is what the bot defaults to.
     */
    public static final String MODEL_SMALLEST = "smallest";

    /**
     * Smallest.ai Lightning v3.1 <b>Pro</b> — a SEPARATE engine id on purpose, not a
     * variant of {@link #MODEL_SMALLEST}. The two share no voices: the API hard-rejects
     * a cross-model name ("Voice 'devansh' is not available on the lightning_v3.1_pro
     * model"), which on a live call is silence. Collapsing them into one id would put
     * both palettes behind one picker entry and make that silent call reachable in two
     * clicks, so they stay distinct all the way down to bot.py's _engine_palette.
     *
     * <p>Cost is $0.195/10K chars (~Rs 1.34/call-min) against standard's $0.175
     * (~Rs 1.20) — both well under Google's Rs 2.06, so neither carries a surcharge.
     */
    public static final String MODEL_SMALLEST_PRO = "smallest_pro";

    /**
     * Deepgram Aura-2 — <b>ENGLISH ONLY</b>. Verified against the live
     * {@code /v1/models} catalog on 2026-08-13: 102 TTS models across
     * en/es/de/fr/nl/it/ja and <b>no Hindi at any tier</b>, nor any announced.
     *
     * <p>So this engine is selectable only for English-speaking agents. Pointing a
     * Hinglish agent at it makes the voice read Devanagari as English letters —
     * the same class of failure Rumik produced, but total rather than partial.
     * Accent is American; Deepgram publishes no en-IN voice.
     */
    public static final String MODEL_DEEPGRAM = "deepgram";

    /**
     * Engine stamped on a NEW agent. Existing agents are untouched — V421 pinned all
     * 17 of them to Sarvam, and they stay there until somebody changes them by hand.
     *
     * <p>Google Chirp3-HD as of 2026-08-05, replacing Rumik. Rumik was chosen for
     * cost (Rs 0.50/1k characters against Sarvam's Rs 3.00) but lost the argument on
     * the phone: it garbled core Hindi, and a live caller asked what "प्रतिलत" meant
     * when the model had written "प्रतिशत". Chirp3-HD was picked BY EAR over every
     * other engine AND is cheaper per call-minute than Sarvam (~Rs 2.06 vs Rs 2.34
     * at our measured 779 characters per call-minute), with ~1,280 free minutes a
     * month. Rumik stays selectable for anyone who wants the floor price.
     *
     * <p>It was held at Sarvam for several hours while four P0s from an adversarial
     * review were fixed — reply truncation from pipecat's one-message-per-sentence
     * streaming against Rumik's request/response socket; an idle-socket close that
     * starved the event loop for every concurrent call on the box; a barge-in cancel
     * that never reached the wire; and a fault-detection layer that was silently
     * unplugged. All four are fixed and proven by runtime traces against the live
     * API rather than by tests, since the tests were green throughout.
     *
     * <p>STILL NOT PROVEN: no Rumik call has ever been placed over a real phone line.
     * The first agent created after this ships is that call.
     */
    public static final String NEW_AGENT_DEFAULT = MODEL_GOOGLE;

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

    /**
     * Google Cloud hi-IN voices, curated from the live {@code list_voices} API
     * (46 available; 30 of them Chirp3-HD). Genders are Google's own
     * {@code ssml_gender} — NOT guessed from the name, because nothing in
     * "Achird" (male) or "Achernar" (female) says which is which, and a wrong
     * gender here makes a male voice speak feminine Hindi.
     *
     * <p>Chirp3-HD leads because the founder chose it by ear; the Neural2 and
     * WaveNet entries are the ~half-price tiers, kept selectable for volume.
     */
    /**
     * Microsoft Edge read-aloud — FREE, no API key. Only these five exist for
     * India: two Hindi, three English. Names are locale-prefixed and end in
     * Neural, which is also how the bot distinguishes them from another
     * vendor's palette when a stale voice is stored.
     */
    private static final List<Map<String, String>> EDGE_VOICES = List.of(
            v("hi-IN-SwaraNeural", "female", MODEL_EDGE),
            v("hi-IN-MadhurNeural", "male", MODEL_EDGE),
            v("en-IN-NeerjaNeural", "female", MODEL_EDGE),
            v("en-IN-NeerjaExpressiveNeural", "female", MODEL_EDGE),
            v("en-IN-PrabhatNeural", "male", MODEL_EDGE));

    private static final List<Map<String, String>> GOOGLE_VOICES = List.of(
            v("hi-IN-Chirp3-HD-Achird", "male", MODEL_GOOGLE),
            v("hi-IN-Chirp3-HD-Charon", "male", MODEL_GOOGLE),
            v("hi-IN-Chirp3-HD-Fenrir", "male", MODEL_GOOGLE),
            v("hi-IN-Chirp3-HD-Orus", "male", MODEL_GOOGLE),
            v("hi-IN-Chirp3-HD-Puck", "male", MODEL_GOOGLE),
            v("hi-IN-Chirp3-HD-Schedar", "male", MODEL_GOOGLE),
            v("hi-IN-Chirp3-HD-Achernar", "female", MODEL_GOOGLE),
            v("hi-IN-Chirp3-HD-Aoede", "female", MODEL_GOOGLE),
            v("hi-IN-Chirp3-HD-Kore", "female", MODEL_GOOGLE),
            v("hi-IN-Chirp3-HD-Leda", "female", MODEL_GOOGLE),
            v("hi-IN-Chirp3-HD-Zephyr", "female", MODEL_GOOGLE),
            v("hi-IN-Chirp3-HD-Sulafat", "female", MODEL_GOOGLE),
            v("hi-IN-Neural2-B", "male", MODEL_GOOGLE),
            v("hi-IN-Neural2-C", "male", MODEL_GOOGLE),
            v("hi-IN-Neural2-A", "female", MODEL_GOOGLE),
            v("hi-IN-Neural2-D", "female", MODEL_GOOGLE),
            v("hi-IN-Wavenet-B", "male", MODEL_GOOGLE),
            v("hi-IN-Wavenet-C", "male", MODEL_GOOGLE),
            v("hi-IN-Wavenet-A", "female", MODEL_GOOGLE),
            v("hi-IN-Wavenet-D", "female", MODEL_GOOGLE));

    /**
     * Smallest.ai Lightning v3.1 (standard) Hindi voices with an Indian accent,
     * from the live {@code /waves/v1/lightning-v3.1/get_voices} catalog. Genders
     * are the vendor's own {@code tags.gender}.
     *
     * <p>Only v3.1 voices are listed: mixing in a {@code _pro} name (mandar,
     * manasi, meher…) would be rejected by the API on the standard model and the
     * call would go silent.
     */
    private static final List<Map<String, String>> SMALLEST_VOICES = List.of(
            v("devansh", "male", MODEL_SMALLEST),
            v("kaustubh", "male", MODEL_SMALLEST),
            v("virat", "male", MODEL_SMALLEST),
            v("karan", "male", MODEL_SMALLEST),
            v("yash", "male", MODEL_SMALLEST),
            v("debashis", "male", MODEL_SMALLEST),
            v("imogen", "female", MODEL_SMALLEST),
            v("nirupma", "female", MODEL_SMALLEST),
            v("niharika", "female", MODEL_SMALLEST));

    /**
     * Deepgram Aura-2 American-English voices, curated from the live catalog.
     * Genders are Deepgram's own {@code metadata.tags} (feminine/masculine), NOT
     * inferred from the mythological names — Janus and Juno are both FEMALE there,
     * which no reading of the names would tell you. Must stay in lockstep with
     * bot.py's _DEEPGRAM_MALE_VOICES or a male voice speaks feminine grammar.
     */
    private static final List<Map<String, String>> DEEPGRAM_VOICES = List.of(
            v("aura-2-apollo-en", "male", MODEL_DEEPGRAM),
            v("aura-2-arcas-en", "male", MODEL_DEEPGRAM),
            v("aura-2-atlas-en", "male", MODEL_DEEPGRAM),
            v("aura-2-hermes-en", "male", MODEL_DEEPGRAM),
            v("aura-2-mars-en", "male", MODEL_DEEPGRAM),
            v("aura-2-odysseus-en", "male", MODEL_DEEPGRAM),
            v("aura-2-asteria-en", "female", MODEL_DEEPGRAM),
            v("aura-2-athena-en", "female", MODEL_DEEPGRAM),
            v("aura-2-helena-en", "female", MODEL_DEEPGRAM),
            v("aura-2-hera-en", "female", MODEL_DEEPGRAM),
            v("aura-2-luna-en", "female", MODEL_DEEPGRAM),
            v("aura-2-cordelia-en", "female", MODEL_DEEPGRAM),
            v("aura-2-harmonia-en", "female", MODEL_DEEPGRAM),
            v("aura-2-electra-en", "female", MODEL_DEEPGRAM));

    /**
     * Lightning v3.1 <b>Pro</b> voices. Disjoint from the standard palette above —
     * see {@link #MODEL_SMALLEST_PRO}. Must stay in lockstep with bot.py's
     * _SMALLEST_PRO_MALE / _SMALLEST_PRO_FEMALE.
     */
    private static final List<Map<String, String>> SMALLEST_PRO_VOICES = List.of(
            v("mandar", "male", MODEL_SMALLEST_PRO),
            v("mathan", "male", MODEL_SMALLEST_PRO),
            v("barath", "male", MODEL_SMALLEST_PRO),
            v("manasi", "female", MODEL_SMALLEST_PRO),
            v("mrunal", "female", MODEL_SMALLEST_PRO),
            v("ketaki", "female", MODEL_SMALLEST_PRO),
            v("meher", "female", MODEL_SMALLEST_PRO));

    /**
     * The ONE place every palette is registered. Ordered (LinkedHashMap) because
     * {@link #all()} flattens it and the picker shows voices in this order.
     *
     * <p>Adding an engine means adding it HERE and nowhere else: all(), models(),
     * IDS_BY_MODEL and isVoiceOf() all derive from this map. all() used to keep its
     * own hand-written list of palettes and silently omitted smallest_pro and
     * deepgram — their engines showed in the picker with an EMPTY voice dropdown.
     */
    private static final Map<String, List<Map<String, String>>> BY_MODEL = new LinkedHashMap<>();
    static {
        BY_MODEL.put(MODEL_GOOGLE, GOOGLE_VOICES);
        BY_MODEL.put(MODEL_EDGE, EDGE_VOICES);
        BY_MODEL.put(MODEL_SMALLEST, SMALLEST_VOICES);
        BY_MODEL.put(MODEL_SMALLEST_PRO, SMALLEST_PRO_VOICES);
        BY_MODEL.put(MODEL_DEEPGRAM, DEEPGRAM_VOICES);
        BY_MODEL.put(MODEL_RUMIK, RUMIK_VOICES);
        BY_MODEL.put(MODEL_SARVAM, SARVAM_VOICES);
    }

    private static final Map<String, Set<String>> IDS_BY_MODEL = new LinkedHashMap<>();
    static {
        // LOWERCASED, because isVoiceOf() looks up a lowercased key and calls
        // itself case-insensitive. It was not: the ids went in with their own
        // casing, so every Google voice ('hi-IN-Chirp3-HD-...') failed the check,
        // AiAgentService dutifully "fell back" to defaultVoice — which is MALE —
        // and a female Chirp3-HD voice could not be saved at all. Sarvam, Rumik
        // and Smallest never noticed: their ids are already lowercase.
        BY_MODEL.forEach((model, voices) -> IDS_BY_MODEL.put(model,
                voices.stream().map(m -> m.get("id").toLowerCase(Locale.ROOT))
                        .collect(Collectors.toSet())));
    }

    /** Every voice, model-tagged. The frontend groups by {@code model}. */
    public static List<Map<String, String>> all() {
        // Derived from BY_MODEL on purpose — a hand-written palette list here is
        // exactly what shipped smallest_pro and deepgram with empty dropdowns.
        return BY_MODEL.values().stream().flatMap(List::stream).toList();
    }

    public static List<Map<String, String>> forModel(String model) {
        return BY_MODEL.getOrDefault(normalizeModel(model), SARVAM_VOICES);
    }

    /** Default voice when none is set, or when a cross-vendor name had to be dropped. */
    public static String defaultVoice(String model) {
        String m = normalizeModel(model);
        if (MODEL_RUMIK.equals(m)) return "ira";
        // The founder's pick, and male — agent personas here are predominantly male
        // and Hindi verb gender follows the voice.
        if (MODEL_EDGE.equals(m)) return "hi-IN-SwaraNeural";
        if (MODEL_GOOGLE.equals(m)) return "hi-IN-Chirp3-HD-Achird";
        if (MODEL_SMALLEST.equals(m)) return "devansh";
        if (MODEL_SMALLEST_PRO.equals(m)) return "mandar";
        // English-only engine; Asteria is its clear/confident female voice.
        if (MODEL_DEEPGRAM.equals(m)) return "aura-2-asteria-en";
        return "priya";
    }

    /**
     * The palette's OWN spelling of {@code voice}, or null when it is not in it.
     *
     * <p>Exists because Google voice ids are CASE-SENSITIVE at the vendor
     * ({@code hi-IN-Chirp3-HD-Achernar}) while everything around them is
     * case-insensitive. AiAgentService used to store
     * {@code voice.trim().toLowerCase()}, which is harmless for Sarvam, Rumik and
     * Smallest (their names are lowercase anyway) and silently fatal for Google:
     * {@code hi-in-chirp3-hd-achernar} is rejected by the vendor, the bot falls
     * back to Sarvam, and Sarvam's default voice is MALE. The founder picked a
     * female Chirp3-HD voice on 2026-08-06, saved it, and every call still came
     * out male with nothing anywhere saying why.
     *
     * <p>So: accept any casing from any client, store the catalog's.
     */
    public static String canonicalVoice(String model, String voice) {
        if (voice == null || voice.isBlank()) return null;
        String want = voice.trim().toLowerCase(Locale.ROOT);
        for (Map<String, String> v : forModel(model)) {
            String id = v.get("id");
            if (id != null && id.toLowerCase(Locale.ROOT).equals(want)) return id;
        }
        return null;
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
        if (m.equals(MODEL_EDGE) || m.startsWith("edge") || m.startsWith("microsoft")) return MODEL_EDGE;
        if (m.equals(MODEL_GOOGLE) || m.startsWith("google") || m.startsWith("chirp")) return MODEL_GOOGLE;
        if (m.equals(MODEL_DEEPGRAM) || m.startsWith("deepgram") || m.startsWith("aura")) {
            return MODEL_DEEPGRAM;
        }
        // Pro FIRST: "smallest_pro" also startsWith("smallest"), so the generic test
        // below would swallow it and run pro voices on the standard model = silence.
        if (m.contains("pro") && (m.startsWith("smallest") || m.startsWith("lightning"))) {
            return MODEL_SMALLEST_PRO;
        }
        if (m.equals(MODEL_SMALLEST) || m.startsWith("smallest") || m.startsWith("lightning")) {
            return MODEL_SMALLEST;
        }
        return null;
    }

    /** For the picker: engines with their label and voice list. */
    public static List<Map<String, Object>> models() {
        List<Map<String, Object>> out = new java.util.ArrayList<>();
        out.add(model(MODEL_GOOGLE, "Google Chirp3-HD",
                "Recommended — clearest Hindi; cheaper per minute than Sarvam"));
        out.add(model(MODEL_EDGE, "Microsoft Edge (free)",
                "No vendor cost — billed at a cheaper per-minute rate. Slightly slower to start."));
        out.add(model(MODEL_SMALLEST, "Smallest.ai Lightning v3.1",
                "Indian-language specialist"));
        out.add(model(MODEL_SMALLEST_PRO, "Smallest.ai Lightning v3.1 Pro",
                "Higher-quality Indian voices. Different voice list from v3.1."));
        out.add(model(MODEL_DEEPGRAM, "Deepgram Aura-2 (English only)",
                "English-only \u2014 no Hindi voice exists. Do not use for a Hinglish agent."));
        out.add(model(MODEL_RUMIK, "Rumik Silk Mulberry 1.5",
                "Cheapest, but mispronounces some Hindi words on the phone"));
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
