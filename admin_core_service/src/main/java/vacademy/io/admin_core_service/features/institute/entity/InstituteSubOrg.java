package vacademy.io.admin_core_service.features.institute.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

@Entity
@Table(name = "institute_suborg")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InstituteSubOrg {
    @Id
    @UuidGenerator
    private String id;

    @Column(name = "institute_id")
    private String instituteId;

    @Column(name = "suborg_id")
    private String suborgId;

    @Column(name = "name")
    private String name;

    @Column(name = "description")
    private String description;

    @Column(name = "status")
    private String status;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
