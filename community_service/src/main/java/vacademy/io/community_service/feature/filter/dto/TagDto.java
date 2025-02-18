package vacademy.io.community_service.feature.filter.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class TagDto {

    @NotBlank(message = "Tag ID is required")
    private String tagId;

    @NotBlank(message = "Tag Source is required")
    private String tagSource;
}

