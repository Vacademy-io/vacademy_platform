package vacademy.io.media_service.dto.lecture;

import lombok.Data;

import java.util.List;

@Data
public class LectureFeedbackDto {
    private String title;
    private String reportTitle;
    private LectureInfoDto lectureInfo;
    private String totalScore;
    private List<LectureFeedbackCriteriaDto> criteria;
    private List<String> summary;
}
