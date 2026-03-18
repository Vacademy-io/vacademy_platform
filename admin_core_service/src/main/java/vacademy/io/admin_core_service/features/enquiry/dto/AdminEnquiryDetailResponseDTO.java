package vacademy.io.admin_core_service.features.enquiry.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.sql.Timestamp;
import java.util.Date;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
@JsonIgnoreProperties(ignoreUnknown = true)
public class AdminEnquiryDetailResponseDTO {

        // ─── Enquiry Core ───────────────────────────────────────────────
        private String enquiryId;
        private String trackingId;
        private String enquiryStatus;
        private String conversionStatus;
        private String referenceSource;
        private String feeRangeExpectation;
        private String transportRequirement;
        private String mode;
        private Integer interestScore;
        private String notes;
        private String checklist;
        private Timestamp enquiryCreatedAt;
        private Timestamp enquiryUpdatedAt;

        // ─── Parent / Guardian ──────────────────────────────────────────
        private ParentDetails parent;

        // ─── Student / Child ────────────────────────────────────────────
        private ChildDetails child;

        // ─── Application Progress ───────────────────────────────────────
        private Boolean alreadyApplied;
        private String applicantId;
        private String overallStatus;
        private String currentStageName;
        private String currentStageType;
        private String currentStageStatus;

        // ─── Campaign / Source ──────────────────────────────────────────
        private CampaignDetails campaign;

        // ─── Assigned Counselor ─────────────────────────────────────────
        private CounselorDetails assignedCounselor;

        // ─── Custom Form Field Values ───────────────────────────────────
        private Map<String, String> customFields;

        // ═══════════════ Nested DTOs ════════════════════════════════════

        @Data
        @NoArgsConstructor
        @AllArgsConstructor
        @Builder
        @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
        public static class ParentDetails {
                private String id;
                private String name;
                private String email;
                private String phone;
                private String addressLine;
                private String city;
                private String pinCode;
        }

        @Data
        @NoArgsConstructor
        @AllArgsConstructor
        @Builder
        @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
        public static class ChildDetails {
                private String id;
                private String name;
                private Date dob;
                private String gender;
                private String applyingForClass;
                private String academicYear;
                private String previousSchoolName;
        }

        @Data
        @NoArgsConstructor
        @AllArgsConstructor
        @Builder
        @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
        public static class CampaignDetails {
                private String audienceId;
                private String campaignName;
                private String sourceType;
                private String sourceId;
                private String destinationPackageSessionId;
                private String packageSessionName;
                private String levelName;
                private String groupName;
        }

        @Data
        @NoArgsConstructor
        @AllArgsConstructor
        @Builder
        @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
        public static class CounselorDetails {
                private String counselorId;
                private String counselorName;
                private String counselorEmail;
        }
}
