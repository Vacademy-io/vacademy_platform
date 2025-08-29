package vacademy.io.admin_core_service.features.tag_management.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserTagsResponseDTO {
    private String userId;
    private List<TagDTO> activeTags;
    private List<TagDTO> inactiveTags;
    private int totalTagCount;
    
    public UserTagsResponseDTO(String userId, List<TagDTO> activeTags) {
        this.userId = userId;
        this.activeTags = activeTags;
        this.totalTagCount = activeTags.size();
    }
}
