package vacademy.io.common.ai.dto;

import lombok.Data;

import java.util.List;

@Data
public class AiEvaluationMetadata {
    private String assessmentName;
    private String assessmentId;
    private RichTextDataDTO instruction;
    private List<AiEvaluationSectionDTO> sections;
}
