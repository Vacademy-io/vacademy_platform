package vacademy.io.admin_core_service.features.chapter.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.admin_core_service.features.slide.dto.SlideCountProjection;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class ChapterDTOWithDetail {
    private ChapterDTO chapter;
    private List<SlideCountProjection> slidesCount;
}
