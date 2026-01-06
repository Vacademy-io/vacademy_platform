package vacademy.io.admin_core_service.features.slide.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ScormTrackingDTO {

    @JsonProperty("cmi_suspend_data")
    private String cmiSuspendData;

    @JsonProperty("cmi_location")
    private String cmiLocation;

    @JsonProperty("cmi_exit")
    private String cmiExit;

    @JsonProperty("completion_status")
    private String completionStatus;

    @JsonProperty("success_status")
    private String successStatus;

    @JsonProperty("score_raw")
    private Double scoreRaw;

    @JsonProperty("score_min")
    private Double scoreMin;

    @JsonProperty("score_max")
    private Double scoreMax;

    @JsonProperty("total_time")
    private String totalTime;

    @JsonProperty("cmi_json")
    private Map<String, Object> cmiJson;
}
