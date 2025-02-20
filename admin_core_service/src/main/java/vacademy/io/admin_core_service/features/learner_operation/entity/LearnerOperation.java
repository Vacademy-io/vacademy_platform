package vacademy.io.admin_core_service.features.learner_operation.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

@Entity
@Table(name = "learner_operation")
@Getter
@Setter
@NoArgsConstructor
public class LearnerOperation {

    @Id
    @Column(length = 255, nullable = false, unique = true)
    @UuidGenerator
    private String id;

    @Column(length = 255)
    private String userId;

    @Column(length = 255)
    private String source;

    @Column(name = "source_id", length = 255)
    private String sourceId;

    @Column(length = 255)
    private String operation;

    @Column(length = 255)
    private String value;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public LearnerOperation(String userId, String source, String sourceId, String operation, String value) {
        this.userId = userId;
        this.source = source;
        this.sourceId = sourceId;
        this.operation = operation;
        this.value = value;
    }
}
