package vacademy.io.community_service.feature.question_bank.dto;


import lombok.*;
import vacademy.io.community_service.feature.filter.entity.QuestionPaper;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TagsWithQuestionPaperResponseDto {
    private QuestionPaper questionPaper; // Only included once
    private List<TagsByIdResponseDto> tags; // List of tags
}
