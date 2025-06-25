package vacademy.io.admin_core_service.features.common.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class RatingDTO {
    private String id;
    private double points;
    private String userId;
    private long likes;
    private long dislikes;
    private String sourceId;
    private String sourceType;
    private String text;
    private String status;

}
