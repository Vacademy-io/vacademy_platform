package vacademy.io.admin_core_service.features.telephony.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * Maps a counsellor to their per-provider endpoint (extension + DID) for
 * providers without a number pool (Airtel/Vonage VBC). See V341.
 */
@Entity
@Table(name = "telephony_counsellor_endpoint")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TelephonyCounsellorEndpoint {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false, length = 36)
    private String instituteId;

    @Column(name = "counsellor_user_id", nullable = false, length = 36)
    private String counsellorUserId;

    @Column(name = "provider_type", nullable = false, length = 32)
    private String providerType;

    @Column(name = "extension", length = 32)
    private String extension;

    @Column(name = "provider_user_id", length = 64)
    private String providerUserId;

    @Column(name = "did", length = 20)
    private String did;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
