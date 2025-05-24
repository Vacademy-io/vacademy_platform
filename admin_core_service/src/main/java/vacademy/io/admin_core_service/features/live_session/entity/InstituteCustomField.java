package vacademy.io.admin_core_service.features.live_session.entity;

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
@Table(name = "institute_custom_fields")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InstituteCustomField {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "custom_field_id", nullable = false)
    private String customFieldId;

    @Column(name = "type", nullable = false)
    private String type; // e.g., "session"

    @Column(name = "type_id", nullable = false)
    private String typeId; // session id

    @Column(name = "created_at")
    private Timestamp createdAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;
}

