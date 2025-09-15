package vacademy.io.admin_core_service.features.institute.dto.template;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TemplateRequest {

    @NotBlank(message = "Type is required")
    private String type; // EMAIL, WHATSAPP, SMS, etc.

    private String vendorId;

    @NotBlank(message = "Institute ID is required")
    private String instituteId;

    @NotBlank(message = "Name is required")
    private String name;

    private String subject;

    private String content;

    private String contentType; // HTML, TEXT, JSON, etc.

    private String settingJson;

    @Builder.Default
    private Boolean canDelete = true;

    private String createdBy;

    private String updatedBy;
}
