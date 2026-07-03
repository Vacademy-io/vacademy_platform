package vacademy.io.admin_core_service.features.suborg.registration.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;
import vacademy.io.common.common.dto.CustomFieldValueDTO;
import vacademy.io.common.payment.dto.PaymentInitiationRequestDTO;
import vacademy.io.common.payment.dto.PaymentResponseDTO;

import java.sql.Timestamp;
import java.util.List;

/** Request/response DTOs for the public registration flow + admin listing. */
public final class SubOrgRegistrationFlowDTOs {

    private SubOrgRegistrationFlowDTOs() {
    }

    /** Public payload rendered by the open wizard page. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class PublicTemplateDTO {
        private String templateName;
        private String instituteId;
        private List<String> steps;
        private String tncFileId;
        private List<InstituteCustomFieldDTO> customFields;
        /** Present only for paid templates. */
        private PublicPaymentDTO payment;
        /** DigiLocker KYC docs for the KYC step (["AADHAAR"] or ["AADHAAR","PAN"]); null when no KYC. */
        private List<String> kycDocuments;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class StartKycRequestDTO {
        private String registrationId;
        /** Where DigiLocker lands the user post-consent; wizard sends origin + "/kyc-complete". */
        private String redirectUrl;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class StartKycResponseDTO {
        private String registrationId;
        private String kycStatus;
        /** DigiLocker consent URL — expires ~10 minutes after minting. */
        private String url;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class KycStatusResponseDTO {
        private String registrationId;
        /** PENDING | VERIFIED | CONSENT_DENIED | EXPIRED | FAILED | NOT_STARTED */
        private String kycStatus;
        /** Present when VERIFIED: {name, masked_aadhaar, dob, pan_number, pan_name}. */
        private java.util.Map<String, String> summary;
    }

    /** Paid-template payment info for the wizard's PAYMENT step. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class PublicPaymentDTO {
        private String type;      // ONE_TIME | SUBSCRIPTION
        private String vendor;    // STRIPE | RAZORPAY | CASHFREE | PHONEPE | EWAY
        private String currency;
        private List<PublicPaymentPlanDTO> paymentPlans;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class PublicPaymentPlanDTO {
        private String id;
        private String name;
        private Double actualPrice;
        private Double elevatedPrice;
        private String currency;
        private Integer validityInDays;
        private String description;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class StartRegistrationRequestDTO {
        private String instituteId;
        private String code;
        private String orgName;
        private String orgLogoFileId;
        private String adminName;
        private String adminEmail;
        private String adminPhone;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class StartRegistrationResponseDTO {
        private String registrationId;
        private String status;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class VerifyOtpRequestDTO {
        private String registrationId;
        private String otp;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ResendOtpRequestDTO {
        private String registrationId;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class CompleteRegistrationRequestDTO {
        private String registrationId;
        private Boolean tncAccepted;
        private List<CustomFieldValueDTO> customFieldValues;
        /** Paid templates: which plan of the template's payment option was chosen. */
        private String planId;
        /** Paid templates: gateway initiation payload (same shape as the enroll flow). */
        private PaymentInitiationRequestDTO paymentInitiationRequest;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class CompleteRegistrationResponseDTO {
        private String registrationId;
        private String status;
        private String subOrgId;
        private String adminEmail;
        /** Paid: UserPlan id (PENDING_FOR_PAYMENT until webhook). */
        private String userPlanId;
        /** Paid: gateway order payload; order_id = payment log id (poll target). */
        private PaymentResponseDTO paymentResponse;
    }

    /** Admin list row for a template. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class TemplateListItemDTO {
        private String id;
        private String name;
        private String inviteCode;
        private String status;
        private Timestamp createdAt;
        private long completedCount;
        private long totalAttempts;
        private Integer maxRegistrations;
        private List<String> steps;
    }

    /** Admin read-only registration row. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class RegistrationListItemDTO {
        private String id;
        private String status;
        private String orgName;
        private String adminName;
        private String adminEmail;
        private String adminPhone;
        private String spawnedSubOrgId;
        private Timestamp createdAt;
        /** Null = KYC not started / not required. */
        private String kycStatus;
    }
}
