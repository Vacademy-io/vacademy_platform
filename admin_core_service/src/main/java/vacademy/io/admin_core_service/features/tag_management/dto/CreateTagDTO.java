package vacademy.io.admin_core_service.features.tag_management.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CreateTagDTO {
    
    @NotBlank(message = "Tag name is required")
    @Size(max = 255, message = "Tag name must not exceed 255 characters")
    private String tagName;
    
    @Size(max = 1000, message = "Description must not exceed 1000 characters")
    private String description;
}
