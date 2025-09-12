package vacademy.io.admin_core_service.features.institute.dto.template;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

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
    private String settingJson;
    private Boolean canDelete;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;
    private String updatedBy;
}
