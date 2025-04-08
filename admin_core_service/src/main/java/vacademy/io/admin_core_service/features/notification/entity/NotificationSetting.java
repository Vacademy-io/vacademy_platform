package vacademy.io.admin_core_service.features.notification.entity;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

@Entity
@Table(name = "notification_setting")
@Data
@NoArgsConstructor
public class NotificationSetting {

    @Id
    @Column(name = "id")
    @UuidGenerator
    private String id;

    // INSTITUTE, BATCH, or LEARNER
    @Column(name = "source")
    private String source;

    @Column(name = "source_id")
    private String sourceId;

    // Comma-separated values like "EMAIL,WHATSAPP"
    @Column(name = "comma_separated_communication_types")
    private String commaSeparatedCommunicationTypes;

    // ACTIVE or INACTIVE
    @Column(name = "status")
    private String status;

    // Optional additional email IDs apart from student email
    @Column(name = "comma_separated_email_ids")
    private String commaSeparatedEmailIds;

    @Column(name = "comma_separated_mobile_numbers")
    private String commaSeparatedMobileNumbers;

    @Column(name = "monthly")
    private Boolean monthly;

    @Column(name = "weekly")
    private Boolean weekly;

    @Column(name = "daily")
    private Boolean daily;

    // "Batch Learner Progress Report" or "Student Learning Progress Report"
    @Column(name = "type")
    private String type;

    @Column(name = "comma_separated_roles")
    private String commaSeparatedRoles;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
