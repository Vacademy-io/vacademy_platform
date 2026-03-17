package vacademy.io.auth_service.feature.institute.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.util.Date;

@Entity
@Table(name = "institute_settings")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InstituteSettings {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false)
    private String id;

    @Column(name = "institute_id", nullable = false, unique = true)
    private String instituteId;

    @Column(name = "user_identifier")
    private String userIdentifier;

    @Column(name = "settings_json", columnDefinition = "text")
    private String settingsJson;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;
}
