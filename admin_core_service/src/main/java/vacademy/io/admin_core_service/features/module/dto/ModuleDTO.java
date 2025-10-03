package vacademy.io.admin_core_service.features.module.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;
import vacademy.io.common.institute.entity.module.Module;

@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
@Data
public class ModuleDTO {
    private String id;
    private String moduleName;
    private String status;
    private String description;
    private String thumbnailId;
    private String parentId;
    private String thumbnailLink;

    public ModuleDTO(Module module) {
        this.id = module.getId();
        this.parentId = module.getParentId();
        this.moduleName = module.getModuleName();
        this.status = module.getStatus();
        this.description = module.getDescription();
        this.thumbnailId = module.getThumbnailId();
    }

    public ModuleDTO() {
    }
}
