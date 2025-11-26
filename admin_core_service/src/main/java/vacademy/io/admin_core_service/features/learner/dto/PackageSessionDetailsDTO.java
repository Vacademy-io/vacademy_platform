package vacademy.io.admin_core_service.features.learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;

/**
 * DTO containing package session (course/batch) details
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PackageSessionDetailsDTO {
    private String id;
    private String name;
    private String packageId;
    private String packageName;
    private String levelId;
    private String levelName;
    private String status;
    private Date startDate;
    private Date endDate;
    private String description;
}
