package vacademy.io.community_service.feature.filter.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

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

    private List<TagDto> tags; // Can be null or empty

    private String commaSeparatedTags; // Renamed to camelCase
}
