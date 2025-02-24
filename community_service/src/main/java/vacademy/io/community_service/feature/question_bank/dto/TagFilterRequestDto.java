package vacademy.io.community_service.feature.question_bank.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TagFilterRequestDto {
    private String tagId;
    private String tagSource;
}

