package vacademy.io.media_service.enums;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import org.hibernate.annotations.UuidGenerator;

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

    @Column(name = "input_type")
    private String inputType;
}
