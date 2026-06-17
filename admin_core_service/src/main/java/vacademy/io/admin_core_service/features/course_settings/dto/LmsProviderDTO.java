package vacademy.io.admin_core_service.features.course_settings.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * A selectable LMS the institute can connect, with everything the settings UI needs to
 * present it to a non-technical admin: a friendly name, a one-line "what this does", the
 * benefits it enables, and the connection fields to collect ({@link LmsProviderFieldDTO}).
 *
 * <p>{@code requiresConnection == false} (Vacademy) means it's the built-in LMS and needs
 * no setup form.</p>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LmsProviderDTO {
    /** Stable id = LmsSourcesEnum name (VACADEMY, LEARNDASH). */
    private String id;
    private String displayName;
    /** One-line summary shown on the provider card. */
    private String tagline;
    private String description;
    /** Bullet points describing what connecting this LMS enables. */
    private List<String> enables;
    /** Optional link to setup docs. */
    private String docsUrl;
    private boolean requiresConnection;
    private List<LmsProviderFieldDTO> fields;
}
