package vacademy.io.common.ai.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

import java.util.List;

@Data
public class AiEvaluationMetadata {
    private String assessmentName;
    private String assessmentId;
    private RichTextDataDTO instruction;
    private List<AiEvaluationSectionDTO>sections;
}
