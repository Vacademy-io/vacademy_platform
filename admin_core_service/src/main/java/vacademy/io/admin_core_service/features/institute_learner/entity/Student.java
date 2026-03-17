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

    // --- New Fields (V96) ---
    @Column(name = "id_number")
    private String idNumber;
    @Column(name = "id_type")
    private String idType;

    @Column(name = "previous_school_name")
    private String previousSchoolName;
    @Column(name = "previous_school_board")
    private String previousSchoolBoard;
    @Column(name = "last_class_attended")
    private String lastClassAttended;
    @Column(name = "last_exam_result")
    private String lastExamResult;
    @Column(name = "subjects_studied")
    private String subjectsStudied;

    @Column(name = "applying_for_class")
    private String applyingForClass;
    @Column(name = "academic_year")
    private String academicYear;
    @Column(name = "board_preference")
    private String boardPreference;

    @Column(name = "tc_number")
    private String tcNumber;
    @Column(name = "tc_issue_date")
    private Date tcIssueDate;
    @Column(name = "tc_pending")
    @Builder.Default
    private Boolean tcPending = false;

    @Column(name = "has_special_education_needs")
    @Builder.Default
    private Boolean hasSpecialEducationNeeds = false;
    @Column(name = "is_physically_challenged")
    @Builder.Default
    private Boolean isPhysicallyChallenged = false;
    @Column(name = "medical_conditions")
    private String medicalConditions;
    @Column(name = "dietary_restrictions")
    private String dietaryRestrictions;

    @Column(name = "blood_group")
    private String bloodGroup;
    @Column(name = "mother_tongue")
    private String motherTongue;
    @Column(name = "languages_known")
    private String languagesKnown;
    @Column(name = "category")
    private String category;
    @Column(name = "nationality")
    private String nationality;

    // --- New Fields (V112) - Admission Specific ---
    @Column(name = "admission_no")
    private String admissionNo;

    @Column(name = "date_of_admission")
    private java.util.Date dateOfAdmission;

    @Column(name = "admission_type")
    private String admissionType;

    @Column(name = "guardian_name")
    private String guardianName;

    @Column(name = "guardian_mobile")
    private String guardianMobile;

    // TODO (future migration): section, has_transport, student_type, class_group,
    // year_of_passing, previous_admission_no, religion, how_did_you_know,
    // father_aadhaar, father_qualification, father_occupation,
    // mother_aadhaar, mother_qualification, mother_occupation,
    // permanent_address, permanent_locality

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
