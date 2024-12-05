package vacademy.io.admin_core_service.features.student.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.student.entity.Student;


import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.Date;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class StudentDTO {

    private String id;
    private String username;
    private String userId;
    private String email;
    private String fullName;
    private String addressLine;
    private String region;
    private String city;
    private String pinCode;
    private String mobileNumber;
    private Date dateOfBirth;
    private String gender;
    private String fatherName;
    private String motherName;
    private String parentsMobileNumber;
    private String parentsEmail;
    private Timestamp createdAt;
    private Timestamp updatedAt;

    // Constructor that takes a Student entity
    public StudentDTO(Student student) {
        this.id = student.getId();
        this.username = student.getUsername();
        this.userId = student.getUserId();
        this.email = student.getEmail();
        this.fullName = student.getFullName();
        this.addressLine = student.getAddressLine();
        this.region = student.getRegion();
        this.city = student.getCity();
        this.pinCode = student.getPinCode();
        this.mobileNumber = student.getMobileNumber();
        this.dateOfBirth = student.getDateOfBirth();
        this.gender = student.getGender();
        this.fatherName = student.getFatherName();
        this.motherName = student.getMotherName();
        this.parentsMobileNumber = student.getParentsMobileNumber();
        this.parentsEmail = student.getParentsEmail();
        this.createdAt = student.getCreatedAt();
        this.updatedAt = student.getUpdatedAt();
    }
}