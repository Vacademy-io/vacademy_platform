package vacademy.io.media_service.dto.lecture;

import lombok.Data;

import java.util.List;

@Data
public class LecturePlanDto {
    private String heading;
    private String mode;
    private String duration;
    private String language;
    private String level;
    private List<TimeSplitSection> timeWiseSplit;
    private Assignment assignment;
    private List<String> summary;

    @Data
    public static class TimeSplitSection {
        private String sectionHeading;
        private String timeSplit;
        private String content;
        private List<String> topicCovered;
        private List<String> questionToStudents;
        private List<String> activity;
    }

    @Data
    public static class Assignment {
        private List<String> topicCovered;
        private List<String> tasks;
    }
}

