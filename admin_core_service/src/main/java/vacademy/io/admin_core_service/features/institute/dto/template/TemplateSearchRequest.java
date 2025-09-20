package vacademy.io.admin_core_service.features.institute.dto.template;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TemplateSearchRequest {

    private String instituteId;
    private String type;
    private String vendorId;
    private String searchText; // Search in name or content
    private Boolean canDelete;
    private String contentType;
    private String status; // ACTIVE, INACTIVE, DRAFT, etc.
    private String templateCategory; // NOTIFICATION, MARKETING, SYSTEM, etc.
    @Builder.Default
    private Integer page = 0;
    @Builder.Default
    private Integer size = 20;
    @Builder.Default
    private String sortBy = "createdAt";
    @Builder.Default
    private String sortDirection = "DESC"; // ASC or DESC
}
