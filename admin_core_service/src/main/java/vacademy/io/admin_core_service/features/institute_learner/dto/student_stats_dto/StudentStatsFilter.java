package vacademy.io.admin_core_service.features.institute_learner.dto.student_stats_dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;
import java.util.Map;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class StudentStatsFilter {
    private String instituteId;
    private List<String> packageSessionIds;
    private List<String> userTypes; // NEW_USER, RETAINER
    private Date startDateInUtc;
    private Date endDateInUtc;
    private Map<String, String> sortColumns;
    private String searchName; // Global search across name, email, mobile, username
}
