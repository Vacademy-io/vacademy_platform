package vacademy.io.admin_core_service.features.learner_reports.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
public class ChapterSlideProgressDTO {

    @JsonProperty("chapter_id")
    private String chapterId;

    @JsonProperty("chapter_name")
    private String chapterName;

    private List<SlideProgressDTO> slides;

    @Data
    public static class SlideProgressDTO {
        @JsonProperty("slide_id")
        private String slideId;

        @JsonProperty("slide_title")
        private String slideTitle;

        @JsonProperty("slide_source_type")
        private String slideSourceType;

        @JsonProperty("avg_time_spent")
        private Double avgTimeSpent;

        @JsonProperty("avg_concentration_score")
        private Double avgConcentrationScore;
    }
}