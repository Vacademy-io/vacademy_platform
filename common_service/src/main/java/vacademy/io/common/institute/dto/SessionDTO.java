package vacademy.io.common.institute.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.institute.entity.session.Session;
import vacademy.io.common.institute.entity.session.SessionProjection;

import java.util.Date;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class SessionDTO {
    private String id;
    private String sessionName;
    private String status;
    private Date startDate;

    // Constructor from Session entity
    public SessionDTO(Session session) {
        this.id = session.getId();
        this.sessionName = session.getSessionName();
        this.status = session.getStatus();
        this.startDate = session.getStartDate();
    }

    public SessionDTO(SessionProjection session) {
        this.id = session.getId();
        this.sessionName = session.getSessionName();
        this.status = session.getStatus();
        this.startDate = session.getStartDate();
    }
}