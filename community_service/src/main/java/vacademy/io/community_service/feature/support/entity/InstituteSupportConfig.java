package vacademy.io.community_service.feature.support.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;
import vacademy.io.community_service.feature.support.enums.SupportPlan;

import java.util.Date;

@Entity
@Table(name = "institute_support_config", schema = "public")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class InstituteSupportConfig {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "institute_id", nullable = false, unique = true)
    private String instituteId;

    @Enumerated(EnumType.STRING)
    @Column(name = "plan", length = 50, nullable = false)
    @Builder.Default
    private SupportPlan plan = SupportPlan.DEFAULT;

    /** JSON array of alert-email strings overriding the global list for this institute. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "alert_emails", columnDefinition = "jsonb")
    private String alertEmails;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Date createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Date updatedAt;
}
