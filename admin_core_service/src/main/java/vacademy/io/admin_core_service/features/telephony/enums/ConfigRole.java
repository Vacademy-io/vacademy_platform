package vacademy.io.admin_core_service.features.telephony.enums;

/**
 * What an {@code institute_telephony_config} row is FOR (V448). Plain String
 * constants, same convention as {@link ProviderType}.
 *
 * <p>An institute holds exactly one {@link #PRIMARY} row — the provider its
 * counsellors click-to-call and receive inbound on — and optionally one
 * {@link #AI_VOICE} row.
 *
 * <p>{@code AI_VOICE} exists because Vacademy AI is a media application on top of
 * Plivo, not a carrier of its own: the bot needs Plivo's {@code <Stream>} websocket
 * for the call audio. Airtel IQ and Exotel expose no media fork, so an institute on
 * those providers has no way to place an AI call on its own trunk. A dedicated
 * AI_VOICE row lets it dial the AI leg on a Plivo line while every human call keeps
 * running, untouched, on the PRIMARY provider.
 *
 * <p>No AI_VOICE row ⇒ AI calls fall back to PRIMARY, which is exactly what the
 * institutes already running Vacademy Voice do today.
 */
public final class ConfigRole {

    /** The institute's human calling provider. Every pre-V448 row is this. */
    public static final String PRIMARY = "PRIMARY";

    /** Dedicated Plivo line used ONLY by {@link ProviderType#VACADEMY_AI} calls. */
    public static final String AI_VOICE = "AI_VOICE";

    private ConfigRole() {}
}
