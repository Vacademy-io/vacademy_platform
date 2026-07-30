package vacademy.io.auth_service.feature.demo.entity;

import jakarta.persistence.*;
import lombok.*;

import java.sql.Timestamp;

/**
 * A time-boxed demo institute, as far as auth is concerned. Login is refused once
 * {@code expiresAt} has passed; nothing is deleted, so extending the date restores access.
 */
@Entity
@Table(name = "institute_trial", schema = "public")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "instituteId")
public class InstituteTrial {

    @Id
    @Column(name = "institute_id")
    private String instituteId;

    @Column(name = "expires_at", nullable = false)
    private Timestamp expiresAt;

    @Column(name = "source_quote_id")
    private String sourceQuoteId;

    @Column(name = "created_by")
    private String createdBy;
}
