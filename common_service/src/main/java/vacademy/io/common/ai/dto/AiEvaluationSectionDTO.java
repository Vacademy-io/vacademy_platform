package vacademy.io.common.ai.dto;

import lombok.Data;
import lombok.Getter;
import lombok.Setter;

import java.util.List;


@Getter
@Setter
@Data
public class AiEvaluationSectionDTO {
    private List<AiEvaluationQuestionDTO>questions;
    private Double cutoffMarks;
    private String name;
}
