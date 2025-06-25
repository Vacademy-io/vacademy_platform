package vacademy.io.admin_core_service.features.live_session.entity;



import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;
        import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;
import java.util.Date;


@Data
@Builder
@ToString
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "student")
public class StudentEntity {

    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;
    @Column(name = "username")
    private String username;
    @Column(name = "user_id")
    private String userId;
    @Column(name = "email")
    private String email;
    @Column(name = "full_name")
    private String fullName;
    @Column(name = "address_line")
    private String addressLine;
    @Column(name = "region")
    private String region;
    @Column(name = "city")
    private String city;
    @Column(name = "pin_code")
    private String pinCode;
    @Column(name = "mobile_number")
    private String mobileNumber;
    @Column(name = "date_of_birth")
    private Date dateOfBirth;
    @Column(name = "gender")
    private String gender;
    @Column(name = "fathers_name")
    private String fatherName;
    @Column(name = "mothers_name")
    private String motherName;
    @Column(name = "parents_mobile_number")
    private String parentsMobileNumber;

    @Column(name = "parents_to_mother_mobile_number")
    private String parentToMotherMobileNumber;

    @Column(name = "parents_to_mother_email")
    private String parentsToMotherEmail;

    @Column(name = "parents_email")
    private String parentsEmail;
    @Column(name = "linked_institute_name")
    private String linkedInstituteName;
    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;
    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
    @Column(name = "face_file_id")
    private String faceFileId;

}