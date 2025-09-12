package vacademy.io.admin_core_service.features.institute.dto.template;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TemplateUpdateRequest {

    @NotBlank(message = "Template ID is required")
    private String id;

    private String type; // EMAIL, WHATSAPP, SMS, etc.

    private String vendorId;

    private String name;

    private String subject;

    private String content;

    private String contentType; // HTML, TEXT, JSON, etc.

    private String settingJson;

    private Boolean canDelete;

    private String updatedBy;
}
