package vacademy.io.admin_core_service.features.presentation_mode.learner.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.Date;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class ParticipantDto {
    private String username;
    private String userId;
    private String name;
    private String email;
    private String status;
    private Date joinedAt;
}