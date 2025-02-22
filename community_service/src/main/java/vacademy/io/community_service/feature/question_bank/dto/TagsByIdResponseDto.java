package vacademy.io.community_service.feature.question_bank.dto;

import lombok.Builder;
import lombok.Data;


@Data
@Builder
public class TagsByIdResponseDto {
    private String tagId;
    private String tagSource;
    private String tagName;
}


