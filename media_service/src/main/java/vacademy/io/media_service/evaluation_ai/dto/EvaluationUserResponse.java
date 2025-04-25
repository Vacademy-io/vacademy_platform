package vacademy.io.media_service.evaluation_ai.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import org.springframework.stereotype.Service;


@Data
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class EvaluationUserResponse {
    private String id;
    private String responseJson;
    private String fullName;
    private String email;
    private String contactNumber;
    private String userId;
}
