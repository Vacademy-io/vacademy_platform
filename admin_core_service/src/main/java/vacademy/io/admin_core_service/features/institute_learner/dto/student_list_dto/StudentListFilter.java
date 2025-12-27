package vacademy.io.admin_core_service.features.institute_learner.dto.student_list_dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentListFilter {
    private String name;
    private List<String> statuses;
    private List<String> instituteIds;
    private List<String> packageSessionIds;
    private List<String> groupIds;
    private List<String> gender;
    private List<String> paymentStatuses;
    private List<String> customFields;
    private Map<String, String> sortColumns;
    private List<String> sources;
    private List<String> types;
    private List<String> typeIds;
    private List<String> destinationPackageSessionIds;
    private List<String> levelIds;
    private List<String> subOrgUserTypes;
    private Map<String, List<String>> customFieldFilters;
    private LocalDate startDate;
    private LocalDate endDate;
}