package vacademy.io.admin_core_service.features.learner_access;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.learner_access.dto.LearnerAccessChangeRequestDTO;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Guards the request DTO's opt-out defaults. Lombok's {@code @Builder.Default} moves the
 * field initializer into the builder, so a Jackson-deserialized instance — which is how
 * every real request arrives — does not necessarily get it. These two flags default to
 * ON, and silently flipping to OFF would extend expired learners into the past and leave
 * them locked out, with nothing in the response to show it.
 */
class LearnerAccessChangeRequestDTOTest {

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("a JSON body omitting the flags still gets extend-from-today and reactivate ON")
    void jsonOmittingFlagsKeepsDefaultsOn() throws Exception {
        String json = """
                {
                  "institute_id": "inst-1",
                  "user_ids": ["user-1"],
                  "extend_by_days": 30
                }
                """;

        LearnerAccessChangeRequestDTO request =
                objectMapper.readValue(json, LearnerAccessChangeRequestDTO.class);

        assertTrue(Boolean.TRUE.equals(request.getExtendFromToday()),
                "extend_from_today must default to true for JSON bodies that omit it");
        assertTrue(Boolean.TRUE.equals(request.getReactivateExpired()),
                "reactivate_expired must default to true for JSON bodies that omit it");
        assertEquals(30, request.getExtendByDays());
    }

    @Test
    @DisplayName("an explicit false in the body is honoured, not overwritten by the default")
    void explicitFalseIsHonoured() throws Exception {
        String json = """
                {
                  "institute_id": "inst-1",
                  "user_ids": ["user-1"],
                  "extend_by_days": 30,
                  "extend_from_today": false,
                  "reactivate_expired": false
                }
                """;

        LearnerAccessChangeRequestDTO request =
                objectMapper.readValue(json, LearnerAccessChangeRequestDTO.class);

        assertEquals(Boolean.FALSE, request.getExtendFromToday());
        assertEquals(Boolean.FALSE, request.getReactivateExpired());
    }

    @Test
    @DisplayName("the builder applies the same defaults as the JSON path")
    void builderKeepsDefaultsOn() {
        LearnerAccessChangeRequestDTO request = LearnerAccessChangeRequestDTO.builder()
                .instituteId("inst-1")
                .build();

        assertEquals(Boolean.TRUE, request.getExtendFromToday());
        assertEquals(Boolean.TRUE, request.getReactivateExpired());
    }
}
