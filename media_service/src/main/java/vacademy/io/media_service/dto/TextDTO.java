package vacademy.io.media_service.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Enhanced TextDTO with model selection support.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class TextDTO {

    private String text;
    private Integer num;
    private String classLevel;
    private String topics;
    private String questionLanguage;
    private String taskName;
    private String taskId;
    private String questionType;

    /**
     * Optional: Preferred AI model to use.
     * Examples: "google/gemini-2.5-flash", "openai/gpt-4o-mini"
     */
    private String preferredModel;

    /**
     * Optional: Maximum retry attempts
     */
    private Integer maxRetries;

    // Legacy constructor for backward compatibility
    public TextDTO(String text, Integer num, String classLevel, String topics,
            String questionLanguage, String taskName, String taskId, String questionType) {
        this.text = text;
        this.num = num;
        this.classLevel = classLevel;
        this.topics = topics;
        this.questionLanguage = questionLanguage;
        this.taskName = taskName;
        this.taskId = taskId;
        this.questionType = questionType;
    }
}