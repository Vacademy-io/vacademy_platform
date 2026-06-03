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
    // Group key is a meeting DATE (java.sql.Date, midnight in the IST-forced JVM zone).
    // Serialize in Asia/Kolkata; UTC would print the previous day and break the FE's
    // date-grouped Upcoming/Past tabs (sessions silently dropped as "before today").
    @JsonFormat(shape = JsonFormat.Shape.STRING, pattern = "yyyy-MM-dd", timezone = "Asia/Kolkata")
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
