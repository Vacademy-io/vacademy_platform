package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class GuestRegistrationRequestDTO {

    private String sessionId;
    private String email;

    private List<CustomFieldValueDTO> customFields;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class CustomFieldValueDTO {
        private String customFieldId; // FK to custom_fields
        private String value;          // actual value filled by guest
    }
}
