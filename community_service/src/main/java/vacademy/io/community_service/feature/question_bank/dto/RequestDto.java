package vacademy.io.community_service.feature.question_bank.dto;

import lombok.*;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RequestDto {
    private String type; // "QUESTION" or "QUESTION_PAPER"
    private List<TagFilterRequestDto> tags;
}
