package vacademy.io.common.institute.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;
import java.util.Date;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;

@Data
@Builder
@ToString
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "institutes")
public class Institute {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "name")
    private String instituteName;

    @Column(name = "address_line")
    private String address;

    @Column(name = "pin_code")
    private String pinCode;

    @Column(name = "mobile_number")
    private String mobileNumber;

    @Column(name = "logo_file_id")
    private String logoFileId;

    @Column(name = "language")
    private String Language;

    @Column(name = "institute_theme_code")
    private String instituteThemeCode;

    @Column(name = "website_url")
    private String websiteUrl;

    @Column(name = "learner_portal_base_url")
    private String learnerPortalBaseUrl;

    @Column(name = "teacher_portal_base_url")
    private String teacherPortalBaseUrl;

    @Column(name = "admin_portal_base_url")
    private String adminPortalBaseUrl;

    @Column(name = "description")
    private String description;

    @Column(name = "type")
    private String instituteType;

    @Column(name = "held")
    private String heldBy;

    @Column(name = "founded_date")
    private Timestamp foundedData;

    @Column(name = "country")
    private String country;

    @Column(name = "state")
    private String state;

    @Column(name = "city")
    private String city;

    @Column(name = "email")
    private String email;

    @Column(name = "letterhead_file_id")
    private String letterHeadFileId;

    @Column(name = "subdomain")
    private String subdomain;

    @Column(name = "setting_json")
    private String setting;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Date updatedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Date createdAt;

    @Column(name = "cover_image_file_id")
    private String coverImageFileId;

    @Column(name = "cover_text_json")
    private String coverTextJson;

    @PrePersist
    @PreUpdate
    private void normalizeEmails() {
        if (this.email != null) {
            this.email = this.email.toLowerCase();
        }
    }

}
