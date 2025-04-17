package vacademy.io.media_service.evaluation_ai.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class EvaluationUserDTO {
    private String id;
    private String responseId;
    private String fullName;
    private String email;
    private String contactNumber;
}
