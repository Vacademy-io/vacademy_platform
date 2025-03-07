package vacademy.io.admin_core_service.features.level.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.common.institute.dto.LevelDTO;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.Date;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
@AllArgsConstructor
@NoArgsConstructor
public class LevelDTOWithPackageSession {
    private LevelDTO levelDTO;
    private String packageSessionId;
    private String packageSessionStatus;
    private Date startDate;

    public LevelDTOWithPackageSession(Level level, PackageSession packageSession) {
        this.levelDTO = new LevelDTO(level);
        this.packageSessionStatus = packageSession.getStatus();
        this.packageSessionId = String.valueOf(packageSession.getId());
        this.startDate = packageSession.getStartTime();
    }
}
