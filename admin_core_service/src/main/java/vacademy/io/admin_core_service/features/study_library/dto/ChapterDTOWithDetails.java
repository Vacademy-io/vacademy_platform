package vacademy.io.admin_core_service.features.study_library.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDTO;
import vacademy.io.admin_core_service.features.slide.dto.SlideDTO;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class ChapterDTOWithDetails {
    private ChapterDTO chapter;
    private List<SlideDTO>slides;
}
