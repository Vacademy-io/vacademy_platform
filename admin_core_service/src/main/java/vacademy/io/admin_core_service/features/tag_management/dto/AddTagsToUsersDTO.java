package vacademy.io.admin_core_service.features.tag_management.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AddTagsToUsersDTO {
    
    @NotEmpty(message = "User IDs list cannot be empty")
    private List<String> userIds;
    
    @NotEmpty(message = "Tag IDs list cannot be empty")
    private List<String> tagIds;
}
