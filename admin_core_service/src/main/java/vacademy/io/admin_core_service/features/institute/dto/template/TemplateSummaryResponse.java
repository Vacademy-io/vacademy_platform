package vacademy.io.admin_core_service.features.institute.dto.template;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Lightweight template response DTO for list operations.
 * Excludes large fields like content, settingJson, and dynamicParameters
 * to prevent memory issues when fetching multiple templates.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TemplateSummaryResponse {

    private String id;
    private String type;
    private String vendorId;
    private String instituteId;
    private String name;
    private String subject;
    private String contentType;
    private Boolean canDelete;
    private String status; // ACTIVE, INACTIVE, DRAFT, etc.
    private String templateCategory; // NOTIFICATION, MARKETING, SYSTEM, etc.
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String createdBy;
    private String updatedBy;
}

