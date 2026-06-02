package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.annotation.JsonFormat;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;

@Data
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
@JsonInclude(JsonInclude.Include.NON_NULL)
public class GroupedSessionsByDateDTO {
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd", timezone = "UTC")
    private Date date;
    private List<LiveSessionListDTO> sessions;
    private LiveSessionStep1RequestDTO.LearnerButtonConfigDTO learnerButtonConfig;
    private String defaultClassLink;
    private String defaultClassName;

    public GroupedSessionsByDateDTO(Date date, List<LiveSessionListDTO> sessions) {
        this.date = date;
        this.sessions = sessions;
    }
}
