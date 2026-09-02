package vacademy.io.admin_core_service.features.white_label.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pins the wire names of the status payload.
 *
 * <p>Lombok names the getter for a {@code boolean isPrimary} field {@code isPrimary()},
 * from which Jackson infers the property "primary" — a different name than the
 * {@code @JsonProperty} on the field. If those two ever split, the admin dashboard's
 * badges read {@code undefined} and silently stop rendering, with nothing failing
 * loudly enough to notice. So assert the exact keys the frontend indexes by.
 */
class WhiteLabelStatusResponseJsonTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    @SuppressWarnings("unchecked")
    private static Map<String, Object> serialize(Object value) throws Exception {
        return MAPPER.readValue(MAPPER.writeValueAsString(value), Map.class);
    }

    @Test
    @DisplayName("A routing entry exposes is_primary and is_portal_url as the frontend reads them")
    void routingEntryUsesSnakeCaseBooleanKeys() throws Exception {
        Map<String, Object> json = serialize(WhiteLabelStatusResponse.RoutingEntry.builder()
                .id("row-1")
                .role("LEARNER")
                .domain("myschool.com")
                .subdomain("learn")
                .isPrimary(true)
                .isPortalUrl(false)
                .build());

        assertTrue(json.containsKey("is_primary"), "keys were: " + json.keySet());
        assertTrue(json.containsKey("is_portal_url"), "keys were: " + json.keySet());
        assertEquals(Boolean.TRUE, json.get("is_primary"));
        assertEquals(Boolean.FALSE, json.get("is_portal_url"));
    }

    @Test
    @DisplayName("The status envelope exposes roles_adopted_now")
    void envelopeExposesAdoptedRoles() throws Exception {
        Map<String, Object> json = serialize(WhiteLabelStatusResponse.builder()
                .cloudflareEnabled(true)
                .isConfigured(true)
                .rolesAdoptedNow(List.of("LEARNER"))
                .routingEntries(List.of())
                .build());

        assertTrue(json.containsKey("roles_adopted_now"), "keys were: " + json.keySet());
        assertEquals(List.of("LEARNER"), json.get("roles_adopted_now"));
        // The pre-existing key the page keys its whole "configured" branch off.
        assertTrue(json.containsKey("is_configured"), "keys were: " + json.keySet());
    }
}
