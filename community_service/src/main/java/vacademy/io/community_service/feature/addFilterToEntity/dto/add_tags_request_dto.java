package vacademy.io.community_service.feature.addFilterToEntity.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class add_tags_request_dto {

    @NotBlank(message = "Entity ID is required")
    private String entityId;

    @NotBlank(message = "Entity Name is required")
    private String entityName;

    @NotEmpty(message = "At least one tag is required")
    private List<tag_dto> tags;
}
