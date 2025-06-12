package vacademy.io.admin_core_service.features.packages.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LearnerPackageFilterDTO {
    private List<String>levelIds;
    private List<String>facultyIds;
    private List<String>tag;
    private double minPercentageCompleted;
    private double maxPercentageCompleted;
}
