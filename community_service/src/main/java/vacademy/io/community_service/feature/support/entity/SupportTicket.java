package vacademy.io.community_service.feature.support.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.annotations.UuidGenerator;
import org.hibernate.type.SqlTypes;
import vacademy.io.community_service.feature.support.enums.SupportPlan;
import vacademy.io.community_service.feature.support.enums.TicketCategory;
import vacademy.io.community_service.feature.support.enums.TicketPriority;
import vacademy.io.community_service.feature.support.enums.TicketStatus;

import java.util.Date;

@Entity
@Table(name = "support_ticket", schema = "public")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(of = "id")
public class SupportTicket {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "institute_name", length = 500)
    private String instituteName;

    @Column(name = "raised_by_user_id")
    private String raisedByUserId;

    @Column(name = "raised_by_name")
    private String raisedByName;

    @Column(name = "raised_by_email")
    private String raisedByEmail;

    /** ADMIN today; LEARNER reserved for a future learner-app channel. */
    @Column(name = "raised_by_role", length = 50)
    private String raisedByRole;

    @Column(name = "subject", length = 500, nullable = false)
    private String subject;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", length = 50, nullable = false)
    @Builder.Default
    private TicketCategory category = TicketCategory.QUESTION;

    @Enumerated(EnumType.STRING)
    @Column(name = "priority", length = 50, nullable = false)
    @Builder.Default
    private TicketPriority priority = TicketPriority.MINOR;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 50, nullable = false)
    @Builder.Default
    private TicketStatus status = TicketStatus.OPEN;

    @Enumerated(EnumType.STRING)
    @Column(name = "plan_at_creation", length = 50)
    private SupportPlan planAtCreation;

    @Column(name = "assigned_engineer_id")
    private String assignedEngineerId;

    @Column(name = "first_response_due_at")
    private Date firstResponseDueAt;

    @Column(name = "first_responded_at")
    private Date firstRespondedAt;

    @Column(name = "resolved_at")
    private Date resolvedAt;

    @Column(name = "last_message_at")
    private Date lastMessageAt;

    @Column(name = "message_count", nullable = false)
    @Builder.Default
    private int messageCount = 0;

    /** Auto-captured client diagnostics (browser/device JSON) merged with the server-side IP. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "client_context", columnDefinition = "jsonb")
    private String clientContext;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Date createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Date updatedAt;
}
