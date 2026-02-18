package vacademy.io.admin_core_service.features.live_session.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Date;
import java.util.List;

// GroupedSessionsByDateDTO.java
@Data
@AllArgsConstructor
@NoArgsConstructor
public class GroupedSessionsByDateDTO {
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
