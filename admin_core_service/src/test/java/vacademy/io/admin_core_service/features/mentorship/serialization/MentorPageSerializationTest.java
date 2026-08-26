package vacademy.io.admin_core_service.features.mentorship.serialization;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorDTO;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Pins the wire shape of the paginated mentorship endpoints.
 *
 * <p>The controllers return a raw Spring {@code Page}, whose envelope Jackson names
 * from the getters — {@code totalElements}, {@code totalPages} — while the DTOs
 * inside {@code content} carry their own {@code @JsonNaming(SnakeCase)}. So one
 * response mixes both conventions. A client reading {@code total_elements} off the
 * envelope silently gets undefined, which is what made a populated mentor list
 * render as "No mentors yet".
 */
class MentorPageSerializationTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    @DisplayName("the Page envelope is camelCase while the DTOs inside it are snake_case")
    void pageEnvelopeIsCamelCaseAndContentIsSnakeCase() throws Exception {
        List<MentorDTO> mentors = List.of(
                MentorDTO.builder().id("m1").displayName("Asha").assignedStudentCount(3).build(),
                MentorDTO.builder().id("m2").displayName("Bhavya").build(),
                MentorDTO.builder().id("m3").displayName("Chetan").build());
        String json = mapper.writeValueAsString(
                new PageImpl<>(mentors, PageRequest.of(0, 20), mentors.size()));

        // Envelope: named from Page's getters.
        assertTrue(json.contains("\"totalElements\":3"), "envelope should expose totalElements: " + json);
        assertTrue(json.contains("\"totalPages\":1"), "envelope should expose totalPages: " + json);
        // ...and NOT the snake_case spelling a client might assume.
        assertFalse(json.contains("\"total_elements\""), "envelope is not snake_case: " + json);
        assertFalse(json.contains("\"total_pages\""), "envelope is not snake_case: " + json);

        // Content: the DTO's own @JsonNaming still applies.
        assertTrue(json.contains("\"display_name\":\"Asha\""), "content should be snake_case: " + json);
        assertTrue(json.contains("\"assigned_student_count\":3"), "content should be snake_case: " + json);
    }
}
