package vacademy.io.common.institute.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import vacademy.io.common.institute.entity.PackageSession;

import java.time.LocalDate;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PackageSessionDTO {
    private String id;
    private String levelId; // Assuming you want to expose levelId as well
    private String sessionId; // Assuming you want to expose sessionId as well
    private LocalDate startTime;
    private String status;

    // Constructor from PackageSession entity
    public PackageSessionDTO(PackageSession packageSession) {
        this.id = packageSession.getId();
        this.levelId = packageSession.getLevel() != null ? packageSession.getLevel().getId() : null;
        this.sessionId = packageSession.getSession() != null ? packageSession.getSession().getId() : null;
        this.startTime = packageSession.getStartTime();
        this.status = packageSession.getStatus();
    }
}