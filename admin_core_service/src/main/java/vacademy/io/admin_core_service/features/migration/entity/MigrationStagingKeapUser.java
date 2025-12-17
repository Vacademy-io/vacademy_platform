package vacademy.io.admin_core_service.features.migration.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "migration_staging_keap_users")
public class MigrationStagingKeapUser {

    @Id
    @UuidGenerator
    private String id;

    @Column(name = "keap_contact_id")
    private String keapContactId;

    @Column(name = "email")
    private String email;

    @Column(name = "first_name")
    private String firstName;

    @Column(name = "last_name")
    private String lastName;

    @Column(name = "phone")
    private String phone;

    @Column(name = "address")
    private String address;

    @Column(name = "city")
    private String city;

    @Column(name = "state")
    private String state;

    @Column(name = "zip_code")
    private String zipCode;

    @Column(name = "country")
    private String country;

    @Column(name = "product_id")
    private String productId;

    @Column(name = "start_date")
    private java.util.Date startDate;

    @Column(name = "next_bill_date")
    private java.util.Date nextBillDate;

    @Column(name = "eway_token")
    private String ewayToken;

    @Column(name = "job_type")
    private String jobType;

    @Column(name = "user_plan_status")
    private String userPlanStatus;

    @Column(name = "practice_role")
    private String practiceRole;

    @Column(name = "practice_name")
    private String practiceName;

    @Column(name = "root_admin_id")
    private String rootAdminId;

    @Column(name = "record_type")
    private String recordType;

    @Column(name = "raw_data", columnDefinition = "TEXT") // Using TEXT for JSON storage compatibility
    private String rawData;

    @Column(name = "migration_status")
    private String migrationStatus; // PENDING, COMPLETED, FAILED

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "created_at")
    private Timestamp createdAt;

    @Column(name = "updated_at")
    private Timestamp updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = new Timestamp(System.currentTimeMillis());
        updatedAt = new Timestamp(System.currentTimeMillis());
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = new Timestamp(System.currentTimeMillis());
    }
}
