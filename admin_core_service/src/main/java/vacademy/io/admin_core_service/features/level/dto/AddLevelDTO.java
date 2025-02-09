package vacademy.io.admin_core_service.features.level.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;
import vacademy.io.admin_core_service.features.session.dto.AddSessionDTO;
import vacademy.io.common.institute.dto.SessionDTO;

import java.util.Date;
import java.util.List;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class AddLevelDTO {
    private String id;
    private Boolean newLevel;
    private String levelName;
    private Integer durationInDays;
    private String thumbnailFileId;
    private List<AddSessionDTO>sessions;
}
