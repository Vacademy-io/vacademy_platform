package vacademy.io.admin_core_service.features.tag_management.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import vacademy.io.admin_core_service.features.tag_management.entity.Tag;
import vacademy.io.admin_core_service.features.tag_management.enums.TagStatus;

import java.sql.Timestamp;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TagDTO {
    private String id;
    private String tagName;
    private String instituteId;
    private String description;
    private TagStatus status;
    private Timestamp createdAt;
    private Timestamp updatedAt;
    private String createdByUserId;
    private boolean isDefaultTag;
    
    public static TagDTO fromEntity(Tag tag) {
        TagDTO dto = new TagDTO();
        dto.setId(tag.getId());
        dto.setTagName(tag.getTagName());
        dto.setInstituteId(tag.getInstituteId());
        dto.setDescription(tag.getDescription());
        dto.setStatus(tag.getStatus());
        dto.setCreatedAt(tag.getCreatedAt());
        dto.setUpdatedAt(tag.getUpdatedAt());
        dto.setCreatedByUserId(tag.getCreatedByUserId());
        dto.setDefaultTag(tag.isDefaultTag());
        return dto;
    }
}
