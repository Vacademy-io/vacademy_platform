package vacademy.io.assessment_service.features.assessment.dto;


import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class RegistrationFieldDto {
    /**
     * Row id of an already-saved field. Renaming rewrites field_key server-side, so the key the
     * client still holds goes stale — matching on the id keeps a second rename from silently
     * finding nothing. Null/unknown for fields the client created locally.
     */
    private String id;
    private String name;
    private String type;
    private String defaultValue;
    private String description;
    private Integer orderField;
    private Boolean isMandatory = true;
    private String key;
    private String commaSeparatedOptions;
}
