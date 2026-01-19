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
@Table(name = "booking_types")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class BookingType {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "type", nullable = false)
    private String type;

    @Column(name = "code", nullable = false, unique = true)
    private String code; // e.g., SCHOOL_VISIT, ENQUIRY_MEETING

    @Column(name = "description")
    private String description;

    @Column(name = "institute_id")
    private String instituteId;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
