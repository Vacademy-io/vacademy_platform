package vacademy.io.admin_core_service.features.session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.admin_core_service.features.level.dto.AddLevelWithSessionDTO;

import java.util.Date;
import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class AddNewSessionDTO {
    private String id;
    private String sessionName;
    private String status;
    private Date startDate;
    private boolean newSession;
    private List<AddLevelWithSessionDTO> levels;
}
