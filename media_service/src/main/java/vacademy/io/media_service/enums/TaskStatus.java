package vacademy.io.media_service.enums;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.media_service.dto.task_status.TaskStatusDto;

import java.util.Date;

@Entity
@Table(name = "task_status")
@Data
public class TaskStatus {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "type")
    private String type;

    @Column(name = "status")
    private String status;

    @Column(name = "institute_id")
    private String instituteId;

    @Column(name = "result_json", columnDefinition = "TEXT")
    private String resultJson;

    @Column(name = "input_id")
    private String inputId;

    @Column(name = "task_name")
    private String taskName;

    @Column(name = "input_type")
    private String inputType;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;


    public TaskStatusDto getTaskDto(){
        return TaskStatusDto.builder()
                .id(this.id)
                .inputId(this.inputId)
                .inputType(this.inputType)
                .taskName(this.taskName)
                .status(this.status)
                .resultJson(this.resultJson)
                .instituteId(this.instituteId)
                .createdAt(this.createdAt)
                .updatedAt(this.updatedAt).build();
    }
}
