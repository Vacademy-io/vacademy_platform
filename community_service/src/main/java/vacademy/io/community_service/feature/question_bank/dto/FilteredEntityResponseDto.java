package vacademy.io.community_service.feature.question_bank.dto;


import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FilteredEntityResponseDto {
    private String entityId;
    private String entityName;
    private List<TagResponseDto> tags;
    private Object entityData; // Can be Question or QuestionPaper
}
