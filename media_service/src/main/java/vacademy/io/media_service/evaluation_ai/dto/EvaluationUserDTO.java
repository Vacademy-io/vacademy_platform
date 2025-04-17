package vacademy.io.media_service.evaluation_ai.dto;

import lombok.Data;

@Data
public class EvaluationUserDTO {
    private String id;
    private String responseId;
    private String fullName;
    private String email;
    private String contactNumber;
}
