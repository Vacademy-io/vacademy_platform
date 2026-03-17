package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CounsellorAllocationSettingDTO {

    @JsonProperty("autoAssignEnabled")
    private Boolean autoAssignEnabled;

    @JsonProperty("assignmentStrategy")
    private String assignmentStrategy;

    @JsonProperty("allowParentSelection")
    private Boolean allowParentSelection;

    @JsonProperty("counsellorIds")
    private List<String> counsellorIds;
}
