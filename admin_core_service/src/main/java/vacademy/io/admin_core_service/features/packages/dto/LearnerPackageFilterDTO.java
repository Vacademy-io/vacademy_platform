package vacademy.io.admin_core_service.features.packages.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;
import java.util.Map;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class LearnerPackageFilterDTO {

    private List<String>status;
    private List<String>levelIds;
    private List<String>facultyIds;
    private List<String>packageTypes;
    private String searchByName;
    private List<String>tag;
    /** When set, only packages created by this user are returned. Optional. */
    private String createdByUserId;
    private double minPercentageCompleted;
    private double maxPercentageCompleted;
    private Map<String, String> sortColumns;
    private String type;
}
