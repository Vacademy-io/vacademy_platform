package vacademy.io.community_service.feature.filter.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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

