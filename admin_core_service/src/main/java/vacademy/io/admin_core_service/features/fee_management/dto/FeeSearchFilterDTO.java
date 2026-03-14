package vacademy.io.admin_core_service.features.fee_management.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class FeeSearchFilterDTO {

    private int page = 0;
    private int size = 20;
    private String sortBy = "dueDate";
    private String sortDirection = "DESC";
    private Filters filters;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class Filters {
        private List<String> packageSessionIds;
        private List<String> cpoIds;
        private List<String> feeTypeIds;
        private List<String> statuses;
        private DueDateRange dueDateRange;
        private String studentSearchQuery;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class DueDateRange {
        private String startDate; // YYYY-MM-DD
        private String endDate;   // YYYY-MM-DD
    }
}
