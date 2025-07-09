package vacademy.io.admin_core_service.features.live_session.dto;

import lombok.Getter;
import lombok.Setter;

import java.sql.Timestamp;

@Getter
@Setter
public class CustomFieldDTO {
    private String guestId;
    private String id;
    private String fieldKey;
    private String fieldName;
    private String fieldType;
    private String defaultValue;
    private String config;
    private Integer formOrder;
    private Boolean isMandatory;
    private Boolean isFilter;
    private Boolean isSortable;
    private Timestamp createdAt;
    private Timestamp updatedAt;
    private String sessionId;
    private String liveSessionId;
    private String customFieldValue;

    // Getters and Setters (or use Lombok @Data/@Getter/@Setter)
}

