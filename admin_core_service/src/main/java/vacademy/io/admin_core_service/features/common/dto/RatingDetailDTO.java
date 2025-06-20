package vacademy.io.admin_core_service.features.common.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.auth.dto.UserDTO;

import java.sql.Time;
import java.sql.Timestamp;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class RatingDetailDTO {
    private String id;
    private double points;
    private long likes = 0;
    private long dislikes = 0;
    private String sourceId;
    private String sourceType;
    private String text;
    private String status;
    private UserDTO user;
    private Timestamp createdAt;
    private Timestamp updatedAt;
}
