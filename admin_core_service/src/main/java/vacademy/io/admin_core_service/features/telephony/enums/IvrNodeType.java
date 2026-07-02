package vacademy.io.admin_core_service.features.telephony.enums;

/**
 * The node kinds an IVR tree is built from. Stored as a string in
 * {@code ivr_node.node_type}; the renderer maps each to a Plivo XML element.
 */
public enum IvrNodeType {
    /** Speak a prompt, then continue to {@code next_node_id}. */
    PLAY,
    /** Speak a prompt, collect one digit, branch via {@code digit_map}. */
    GATHER,
    /** Ring the numbers in {@code dial_targets} (recording the conversation). */
    DIAL,
    /** Speak a prompt and record a voicemail message, then hang up. */
    VOICEMAIL,
    /** Speak an optional prompt and end the call. */
    HANGUP;

    public static IvrNodeType parseOrNull(String s) {
        if (s == null) return null;
        try { return IvrNodeType.valueOf(s.trim().toUpperCase()); }
        catch (IllegalArgumentException e) { return null; }
    }
}
