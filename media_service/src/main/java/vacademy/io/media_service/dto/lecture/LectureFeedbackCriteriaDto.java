package vacademy.io.media_service.dto.lecture;

import lombok.Data;

import java.util.List;

@Data
public class LectureFeedbackCriteriaDto {
    private String name;
    private String score;
    private List<LectureFeedbackPointDto> points;
    private List<String> scopeOfImprovement;
}
