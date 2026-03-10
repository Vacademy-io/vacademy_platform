package vacademy.io.admin_core_service.features.hr_employee.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class EmployeeProfileDTO {

    private String id;
    private String userId;
    private String instituteId;
    private String employeeCode;

    private String departmentId;
    private String departmentName;

    private String designationId;
    private String designationName;

    private String reportingManagerId;
    private String reportingManagerName;

    private String employmentType;
    private String employmentStatus;

    private LocalDate joinDate;
    private LocalDate probationEndDate;
    private LocalDate confirmationDate;
    private Integer noticePeriodDays;
    private LocalDate resignationDate;
    private LocalDate lastWorkingDate;
    private String exitReason;

    private String emergencyContactName;
    private String emergencyContactPhone;
    private String emergencyContactRelation;

    private String nationality;
    private String bloodGroup;
    private String maritalStatus;

    private String panNumber;
    private String taxIdNumber;
    private String uanNumber;

    private Map<String, Object> statutoryInfo;
    private Map<String, Object> customFields;

    // These fields come from User entity via auth service
    private String fullName;
    private String email;
    private String mobileNumber;
}
