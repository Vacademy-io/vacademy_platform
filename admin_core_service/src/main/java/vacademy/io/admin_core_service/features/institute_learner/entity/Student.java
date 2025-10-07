package vacademy.io.admin_core_service.features.institute_learner.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;
import vacademy.io.common.auth.dto.UserDTO;

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
@Table(name = "student")
public class Student {

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

    public Student(UserDTO userDTO) {
        this.id = userDTO.getId();
        this.username = userDTO.getUsername();
        this.email = userDTO.getEmail();
        this.fullName = userDTO.getFullName();
        this.addressLine = userDTO.getAddressLine();
        this.region = userDTO.getRegion();
        this.city = userDTO.getCity();
        this.pinCode = userDTO.getPinCode();
        this.mobileNumber = userDTO.getMobileNumber();
        this.dateOfBirth = userDTO.getDateOfBirth();
        this.gender = userDTO.getGender();
        this.userId = userDTO.getId();
    }

    @PrePersist
    @PreUpdate
    private void normalizeEmails() {
        if (this.email != null) {
            this.email = this.email.toLowerCase();
        }
        if (this.parentsToMotherEmail != null) {
            this.parentsToMotherEmail = this.parentsToMotherEmail.toLowerCase();
        }
        if (this.parentsEmail != null) {
            this.parentsEmail = this.parentsEmail.toLowerCase();
        }
    }
}
