package vacademy.io.admin_core_service.features.telephony.enums;

/**
 * Loose string-y constants for the supported provider types. Kept as plain
 * String values (not an enum) on the wire so a new provider can be added
 * without a code change in shared modules — we just register a new adapter.
 */
public final class ProviderType {
    public static final String EXOTEL = "EXOTEL";
    /** Aavtaar.ai autonomous AI voice agent (Plivo-backed). End-of-call webhook only. */
    public static final String AAVTAAR = "AAVTAAR";
    /** Airtel IQ Business Connect — a white-labeled Vonage Business Cloud (VBC). */
    public static final String AIRTEL = "AIRTEL";
    /**
     * A call a counsellor made off-platform and uploaded the recording for
     * manually. No live provider integration — the recording is supplied by the
     * counsellor, a telephony_call_log row is created from their input, and it
     * flows through the same intelligence pipeline as provider calls.
     */
    public static final String MANUAL = "MANUAL";
    /**
     * Synthetic AI provider for testing / pre-integration. No real dial: AiCallService
     * short-circuits, fabricates a completed AiCallResult (canned extracted Q&A) and runs
     * it through the SAME outcome pipeline a real webhook would — so cohort → call →
     * outcome → action can be exercised end-to-end without any provider credentials.
     */
    public static final String MOCK = "MOCK";
    /**
     * Vacademy Voice — our first-party Plivo-backed voice product. Unlike the
     * other providers (which are integrations into an account the institute owns
     * elsewhere), institutes are onboarded onto OUR master Plivo account, each
     * isolated in its own Plivo subaccount. Carries outbound bridge click-to-call,
     * inbound multi-level IVR, recording, transfer, prepaid billing and an India
     * compliance gate — all behind the per-institute VOICE_CALLING_SETTING flag.
     */
    public static final String PLIVO = "PLIVO";
    /**
     * Vacademy AI Agent — our first-party AI voice bot (dedicated Pipecat+Sarvam
     * voice-bot service streaming over the institute's Vacademy Voice Plivo
     * subaccount). Registered as an AI-voice provider (AiOutboundCaller +
     * AiCallReportParser), peer of AAVTAAR; selectable per institute in
     * AI_CALLING_SETTING.provider.
     */
    public static final String VACADEMY_AI = "VACADEMY_AI";
    // Future: TWILIO, KNOWLARITY, KALEYRA, …

    private ProviderType() {}
}
