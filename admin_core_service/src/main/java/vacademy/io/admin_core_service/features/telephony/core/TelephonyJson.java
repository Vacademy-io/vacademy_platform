package vacademy.io.admin_core_service.features.telephony.core;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Tiny helper for the {@code {key -> value}} JSON used by the generic telephony
 * credential model (provider_config plaintext, and the decrypted
 * provider_secrets_enc blob). Insertion order is preserved (LinkedHashMap) so a
 * saved-then-reloaded form keeps its field order. Parsing is lenient: a
 * null/blank/garbage value yields an empty mutable map rather than throwing —
 * these run on the webhook hot path and must never blow up a live call.
 */
public final class TelephonyJson {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<LinkedHashMap<String, String>> MAP_TYPE = new TypeReference<>() {};

    private TelephonyJson() {}

    public static String write(Map<String, String> map) {
        if (map == null || map.isEmpty()) return null;
        try {
            return MAPPER.writeValueAsString(map);
        } catch (Exception e) {
            // Should never happen for a String->String map; fail soft.
            return null;
        }
    }

    public static Map<String, String> read(String json) {
        if (json == null || json.isBlank()) return new LinkedHashMap<>();
        try {
            Map<String, String> parsed = MAPPER.readValue(json, MAP_TYPE);
            return parsed != null ? parsed : new LinkedHashMap<>();
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }
}
