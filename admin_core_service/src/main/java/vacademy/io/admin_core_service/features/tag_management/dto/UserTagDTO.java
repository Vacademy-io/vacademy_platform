package vacademy.io.admin_core_service.features.tag_management.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import vacademy.io.admin_core_service.features.tag_management.entity.UserTag;
import vacademy.io.admin_core_service.features.tag_management.enums.TagStatus;

import java.sql.Timestamp;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserTagDTO {
    private String id;
    private String userId;
    private String tagId;
    private String instituteId;
    private TagStatus status;
    private Timestamp createdAt;
    private Timestamp updatedAt;
    private String createdByUserId;
    
    // Tag details for convenience
    private String tagName;
    private String tagDescription;
    private boolean isDefaultTag;
    
    public static UserTagDTO fromEntity(UserTag userTag) {
        UserTagDTO dto = new UserTagDTO();
        dto.setId(userTag.getId());
        dto.setUserId(userTag.getUserId());
        dto.setTagId(userTag.getTagId());
        dto.setInstituteId(userTag.getInstituteId());
        dto.setStatus(userTag.getStatus());
        dto.setCreatedAt(userTag.getCreatedAt());
        dto.setUpdatedAt(userTag.getUpdatedAt());
        dto.setCreatedByUserId(userTag.getCreatedByUserId());
        
        // Set tag details if available
        if (userTag.getTag() != null) {
            dto.setTagName(userTag.getTag().getTagName());
            dto.setTagDescription(userTag.getTag().getDescription());
            dto.setDefaultTag(userTag.getTag().isDefaultTag());
        }
        
        return dto;
    }
}
