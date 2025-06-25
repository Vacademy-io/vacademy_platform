package vacademy.io.admin_core_service.features.packages.entity;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import lombok.Data;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.admin_core_service.features.packages.dto.CourseStructureChangesLogDTO;

import java.sql.Timestamp;

@Data
@Entity
public class CourseStructureChangesLog {
    @Id
    @UuidGenerator
    private String id;
    private String userId;
    private String sourceId;
    private String sourceType;
    private String parentId;
    private String jsonData;
    private Timestamp createdAt;
    private Timestamp updatedAt;
    private String status;

    public CourseStructureChangesLog(CourseStructureChangesLogDTO dto){
        this.id = dto.getId();
        this.userId = dto.getUserId();
        this.sourceId = dto.getSourceId();
        this.sourceType = dto.getSourceType();
        this.parentId = dto.getParentId();
        this.jsonData = dto.getJsonData();
        this.status = dto.getStatus();
    }

    public CourseStructureChangesLog(){}
}
