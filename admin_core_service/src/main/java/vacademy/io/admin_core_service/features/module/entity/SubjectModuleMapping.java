package vacademy.io.admin_core_service.features.module.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.common.institute.entity.module.Module;
import vacademy.io.common.institute.entity.student.Subject;

import java.sql.Timestamp;

@Entity
@Table(name = "subject_module_mapping")
@Getter
@Setter
public class SubjectModuleMapping {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @ManyToOne
    @JoinColumn(name = "subject_id", referencedColumnName = "id", nullable = false)
    private Subject subject;

    @ManyToOne
    @JoinColumn(name = "module_id", referencedColumnName = "id", nullable = false)
    private Module module;

    @Column(name = "module_order")
    private Integer moduleOrder;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    public SubjectModuleMapping() {}

    public SubjectModuleMapping(Subject subject, Module module) {
        this.subject = subject;
        this.module = module;
    }
}
