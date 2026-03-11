package vacademy.io.admin_core_service.features.super_admin.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class InstituteCourseDTO {
    private String id;
    private String packageName;
    private String status;
    private String thumbnailFileId;
    private Date createdAt;
    private Long chapterCount;
    private Long studentCount;
    private Long batchCount;
}
