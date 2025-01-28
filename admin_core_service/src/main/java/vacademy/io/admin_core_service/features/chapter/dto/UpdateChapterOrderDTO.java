package vacademy.io.admin_core_service.features.chapter.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Getter
@Setter
public class UpdateChapterOrderDTO {
    private String chapterId;
    private String packageSessionId;
    private Integer chapterOrder;
}
