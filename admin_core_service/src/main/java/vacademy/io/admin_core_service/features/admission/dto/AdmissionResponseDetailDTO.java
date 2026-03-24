package vacademy.io.admin_core_service.features.admission.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.Date;
import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AdmissionResponseDetailDTO {

    // === Audience response (admission row) ===
    private String admissionId; // audience_response.id
    private String overallStatus;
    private String sourceType;
    private String sourceId;
    private String destinationPackageSessionId;
    private String enquiryId;
    private String applicantId;
    private Timestamp submittedAt;
    private Timestamp createdAt;

    // === Parent ===
    private Parent parent;

    // === Student ===
    private Student student;

    // === Package session ===
    private PackageSession packageSession;

    // === Applicant/application info (optional) ===
    private Application application;

    // === Custom fields (student-level) ===
    private Map<String, String> customFields;

    // === Payments (optional) ===
    private PaymentSummary payment;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Parent {
        private String userId;
        private String name;
        private String email;
        private String mobile;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Student {
        private String userId;
        private String fullName;
        private String gender;
        private Date dateOfBirth;
        private String applyingForClass;
        private String admissionNo;
        private Date dateOfAdmission;
        private String admissionType;
        private String mobileNumber;
        private String idNumber;
        private String idType;
        private String previousSchoolName;
        private String previousSchoolBoard;
        private String lastClassAttended;
        private String lastExamResult;
        private String motherTongue;
        private String bloodGroup;
        private String nationality;
        private String fatherName;
        private String motherName;
        private String guardianName;
        private String guardianMobile;
        private String guardianEmail;
        private String addressLine;
        private String city;
        private String pinCode;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class PackageSession {
        private String packageSessionId;
        private String sessionId;
        private String sessionName;
        private String levelName;
        private String packageName;
        private String status;
        private Date startTime;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class Application {
        private String applicantId;
        private String trackingId;
        private String workflowType;
        private String applicationStageId;
        private String applicationStageStatus;
        private String overallStatus;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class PaymentSummary {
        private String summaryStatus; // PAID / PARTIAL_PAID / PENDING / NONE
        private List<PaymentItem> items;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class PaymentItem {
        private String paymentId;
        private String status;
        private BigDecimal amountExpected;
        private BigDecimal amountPaid;
        private Date dueDate;
        private String cpoId;
        private String feeTypeId;
    }
}

