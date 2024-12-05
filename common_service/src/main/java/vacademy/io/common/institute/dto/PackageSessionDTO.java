package vacademy.io.common.institute.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.Date;

@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PackageSessionDTO {
    private String id;
    private LevelDTO level; // Assuming you want to expose levelId as well
    private SessionDTO session; // Assuming you want to expose sessionId as well
    private Date startTime;
    private String status;
    private PackageDTO packageDTO;

    // Constructor from PackageSession entity
    public PackageSessionDTO(PackageSession packageSession) {
        this.id = packageSession.getId();
        this.startTime = packageSession.getStartTime();
        this.status = packageSession.getStatus();


        if (packageSession.getLevel() != null) {
            this.level = new LevelDTO(packageSession.getLevel());
        }

        if (packageSession.getPackageEntity() != null) {
            this.packageDTO = new PackageDTO(packageSession.getPackageEntity());
        }

        if (packageSession.getSession() != null) {
            this.session = new SessionDTO(packageSession.getSession());
        }
    }
}