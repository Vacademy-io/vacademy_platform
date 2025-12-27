package vacademy.io.admin_core_service.features.chapter.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class ChapterDTO {
    private String id;
    private String chapterName;
    private String status;
    private String fileId;
    private String description;
    private Integer chapterOrder;
    private String parentId;
    private String dripConditionJson;
}
