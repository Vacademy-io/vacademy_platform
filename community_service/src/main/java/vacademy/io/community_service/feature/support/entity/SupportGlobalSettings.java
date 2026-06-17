package vacademy.io.community_service.feature.support.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.util.Date;

/**
 * Single-row table holding platform-wide support settings (currently the global
 * alert-email recipient list). The row is keyed by a fixed id, {@link #SINGLETON_ID}.
 */
@Entity
@Table(name = "support_global_settings", schema = "public")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class SupportGlobalSettings {

    public static final String SINGLETON_ID = "GLOBAL";

    @Id
    @Column(name = "id")
    private String id;

    /** JSON array of alert-email strings. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "alert_emails", columnDefinition = "jsonb")
    private String alertEmails;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Date updatedAt;
}
