package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CounsellorAllocationSettingDTO {

    @JsonProperty("autoAssignEnabled")
    private Boolean autoAssignEnabled;

    @JsonProperty("assignmentStrategy")
    private String assignmentStrategy; // RANDOM, ROUND_ROBIN, WEIGHTED_ROUND_ROBIN, PERFORMANCE_BASED, LEAST_LOADED

    @JsonProperty("allowParentSelection")
    private Boolean allowParentSelection;

    @JsonProperty("counsellorIds")
    private List<String> counsellorIds;

    /** Weights per counselor for WEIGHTED_ROUND_ROBIN. Example: {"userId1": 3, "userId2": 2} */
    @JsonProperty("counsellorWeights")
    private Map<String, Integer> counsellorWeights;

    /** Max number of active leads a counselor can hold. Exceeding this skips to next. */
    @JsonProperty("maxActiveLeadsPerCounselor")
    private Integer maxActiveLeadsPerCounselor;

    /** For PERFORMANCE_BASED: "ENQUIRY_TO_APPLICATION" or "ENQUIRY_TO_ADMITTED" */
    @JsonProperty("conversionMetric")
    private String conversionMetric;
}
