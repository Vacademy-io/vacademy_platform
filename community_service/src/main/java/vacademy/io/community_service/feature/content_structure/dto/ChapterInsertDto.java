package vacademy.io.community_service.feature.content_structure.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class ChapterInsertDto {
    List<ChapterDto> chapters;
    String subjectId;

    @Data
    @NoArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ChapterDto {
        String chapterName;
        Integer chapterOrder;
        List<TopicInsertDto.TopicDto> topics = new ArrayList<>();
    }
}
