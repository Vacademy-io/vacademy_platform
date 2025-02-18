package vacademy.io.community_service.feature.addFilterToEntity.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class tag_dto {

    @NotBlank(message = "Tag ID is required")
    private String tagId;

    @NotBlank(message = "Tag Source is required")
    private String tagSource;
}

