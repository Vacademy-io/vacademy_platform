package vacademy.io.admin_core_service.features.institute.dto.template;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TemplateResponse {

    private String id;
    private String type;
    private String vendorId;
    private String instituteId;
    private String name;
    private String subject;
    private String content;
    private String contentType;
    // Generic settings JSON as Map (can be used for any template type)
    private Map<String, Object> settingJson;
    // Generic dynamic parameters for content replacement based on contentType
    private Map<String, Object> dynamicParameters;
    private Boolean canDelete;
    private String status; // ACTIVE, INACTIVE, DRAFT, etc.
    private String templateCategory; // NOTIFICATION, MARKETING, SYSTEM, etc.
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;
    private String updatedBy;
}
