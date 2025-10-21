package vacademy.io.admin_core_service.features.course_catalogue.dtos;



import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;


@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class CourseCatalogueResponse {
    private String id;
    private String catalogueJson;
    private String tagName;
    private String status;
    private String source;
    private String sourceId;
    private String instituteId;
    private Boolean isDefault;
}
