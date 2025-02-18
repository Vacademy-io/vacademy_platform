package vacademy.io.community_service.feature.filter.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AddTagsRequestDto {

    @NotBlank(message = "Entity ID is required")
    private String entityId;

    @NotBlank(message = "Entity Name is required")
    private String entityName;

    @NotEmpty(message = "At least one tag is required")
    private List<TagDto> tags;
}
