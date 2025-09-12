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
    private Integer page = 0;
    private Integer size = 20;
    private String sortBy = "createdAt";
    private String sortDirection = "DESC"; // ASC or DESC
}
