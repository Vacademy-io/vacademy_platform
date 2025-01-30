package vacademy.io.admin_core_service.features.course.dto;

import lombok.Getter;
import lombok.Setter;
import vacademy.io.common.institute.entity.PackageEntity;

@Getter
@Setter
public class CourseDTO {
    private String id;
    private String packageName;
    private String thumbnailFileId;
    private String status;

    public CourseDTO(PackageEntity packageEntity) {
        this.id = packageEntity.getId();
        this.packageName = packageEntity.getPackageName();
        this.thumbnailFileId = packageEntity.getThumbnailFileId();
//        this.status = status;
    }
}
