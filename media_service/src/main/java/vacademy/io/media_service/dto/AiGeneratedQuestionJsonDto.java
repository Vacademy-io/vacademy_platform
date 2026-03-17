package vacademy.io.media_service.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonSetter;
import com.fasterxml.jackson.annotation.Nulls;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class AiGeneratedQuestionJsonDto {
    private String questionNumber;
    @JsonSetter(nulls = Nulls.SKIP, contentNulls = Nulls.SKIP)
    private QuestionContent question;
    private List<Option> options;
    private List<String> correctOptions;
    private String ans;
    private String exp;
    private QuestionType questionType;
    private List<String> tags;
    private DifficultyLevel level;

    // Getters and Setters
    public String getQuestionNumber() {
        return questionNumber;
    }

    public void setQuestionNumber(String questionNumber) {
        this.questionNumber = questionNumber;
    }

    public QuestionContent getQuestion() {
        return question;
    }

    public void setQuestion(QuestionContent question) {
        this.question = question;
    }

    public List<Option> getOptions() {
        return options;
    }

    public void setOptions(List<Option> options) {
        this.options = options;
    }

    public List<String> getCorrectOptions() {
        return correctOptions;
    }

    public void setCorrectOptions(List<String> correctOptions) {
        this.correctOptions = correctOptions;
    }

    public String getAns() {
        return ans;
    }

    public void setAns(String ans) {
        this.ans = ans;
    }

    public String getExp() {
        return exp;
    }

    public void setExp(String exp) {
        this.exp = exp;
    }

    public QuestionType getQuestionType() {
        return questionType;
    }

    public void setQuestionType(QuestionType questionType) {
        this.questionType = questionType;
    }

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = tags;
    }

    public DifficultyLevel getLevel() {
        return level;
    }

    public void setLevel(DifficultyLevel level) {
        this.level = level;
    }

    // Enums
    public enum ContentType {
        HTML, TEXT,
    }

    public enum QuestionType {
        MCQS, MCQM, ONE_WORD, LONG_ANSWER, NUMERIC
    }

    public enum DifficultyLevel {
        EASY, MEDIUM, HARD, easy, medium, hard
    }

    // Inner classes
    @JsonIgnoreProperties(ignoreUnknown = true)
    public static class QuestionContent {
        private ContentType type;
        private String content;

        // Getters and Setters
        public ContentType getType() {
            return type;
        }

        public void setType(ContentType type) {
            this.type = type;
        }

        public String getContent() {
            return content;
        }

        public void setContent(String content) {
            this.content = content;
        }
    }

    @Getter
    @Setter
    public static class Option {
        private ContentType type;
        private String content;
        private String preview_id;

    }
}
