package vacademy.io.admin_core_service.features.live_session.dto;




import lombok.AllArgsConstructor;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Data
@AllArgsConstructor
public class RegistrationFromResponseDTO {
    private String sessionId;
    private String sessionTitle;
    private LocalDateTime startTime;
    private LocalDateTime lastEntryTime;
    private String accessLevel;
    private String instituteId;
    private String subject;
    private List<CustomFieldDTO> customFields;

    @Data
    @AllArgsConstructor
    public static class CustomFieldDTO {
        private String id;
        private String fieldKey;
        private String fieldName;
        private String fieldType;
        private String defaultValue;
        private String config;
        private int formOrder;
        private boolean isMandatory;
        private boolean isFilter;
        private boolean isSortable;
    }
}

