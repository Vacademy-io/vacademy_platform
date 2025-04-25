package vacademy.io.media_service.dto.lecture;

import lombok.Data;

import java.util.List;

@Data
public class LectureFeedbackPointDto {
    private String title;
    private List<String> description;
}
