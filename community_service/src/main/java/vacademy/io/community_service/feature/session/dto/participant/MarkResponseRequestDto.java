package vacademy.io.community_service.feature.session.dto.participant;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class MarkResponseRequestDto {
    @NotBlank
    private String username;
    @NotNull
    private Long timeToResponseMillis;
    @NotBlank
    private String responseType; // e.g., "MCQS", "ONE_WORD"
    private List<String> selectedOptionIds;
    private String textAnswer;
}