package vacademy.io.community_service.feature.session.dto.participant;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class SubmittedResponseDataDto {
    private String type; // e.g., "MCQS", "ONE_WORD"
    private List<String> selectedOptionIds; // For MCQS, MCQM
    private String textAnswer; // For ONE_WORD, LONG_ANSWER, NUMERIC
}