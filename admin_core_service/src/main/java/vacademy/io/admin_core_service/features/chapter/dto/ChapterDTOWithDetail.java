package vacademy.io.admin_core_service.features.chapter.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.slide.dto.SlideCountProjection;

import java.util.List;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
@AllArgsConstructor
@NoArgsConstructor
public class ChapterDTOWithDetail {
    private ChapterDTO chapter;
    private SlideCountProjection slidesCount;
    private List<String> chapterInPackageSessions;


}
