package vacademy.io.admin_core_service.features.learner_reports.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

import java.util.List;

@Data
public class LearnerChapterSlideProgressDTO {
    @JsonProperty("chapter_id")
    private String chapterId;

    @JsonProperty("chapter_name")
    private String chapterName;

    private List<LearnerChapterSlideProgressDTO.SlideProgressDTO> slides;

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

        @JsonProperty("avg_time_spent_by_batch")
        private String avgTimeSpentByBatch;

        @JsonProperty("avg_concentration_score_by_batch")
        private String avgConcentrationScoreByBatch;

        @JsonProperty("last_active_date")
        private String lastActiveDate; // based on created at of actvity log
    }
}
