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
        /** Consent statements for the TNC step; inline links via [label](url). */
        private List<String> tncConsentItems;
        private List<InstituteCustomFieldDTO> customFields;
        /** Present only for paid templates. */
        private PublicPaymentDTO payment;
        /** DigiLocker KYC docs for the KYC step (["AADHAAR"] or ["AADHAAR","PAN"]); null when no KYC. */
        private List<String> kycDocuments;
        /** Helper text under the org-name field on the DETAILS step. */
        private String orgNameHint;
        /** True = DETAILS step also collects a postal address (line1/city/state/pincode required). */
        private Boolean collectAddress;
        /** Instructions shown above the KYC step. */
        private String kycInstructions;
        /**
         * Completion precedence: completionRedirectUrl set -> auto-redirect; else
         * completionMessage/button set -> custom message page; else default success
         * copy + "Go to Admin Portal" button -> adminPortalUrl.
         */
        private String completionMessage;
        private String completionButtonLabel;
        private String completionButtonUrl;
        private String completionRedirectUrl;
        /** Institute's admin portal base URL; "https://dash.vacademy.io" when unset. */
        private String adminPortalUrl;
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
        // Required (except line2) when the template sets collect_address=true; ignored otherwise.
        private String addressLine1;
        private String addressLine2;
        private String city;
        private String state;
        private String pincode;
    }

    /** Edit DETAILS of an existing DRAFT/OTP_VERIFIED registration (public). */
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class UpdateDetailsRequestDTO {
        private String registrationId;
        private String orgName;
        private String orgLogoFileId;
        private String adminName;
        private String adminEmail;
        private String adminPhone;
        private String addressLine1;
        private String addressLine2;
        private String city;
        private String state;
        private String pincode;
    }

    /** Public status poll for the return page; no data beyond what the registrant entered. */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class RegistrationStatusResponseDTO {
        private String registrationId;
        private String status;
        private String orgName;
        private String adminEmail;
        /** Institute's admin portal base URL; "https://dash.vacademy.io" when unset. */
        private String adminPortalUrl;
        private String completionMessage;
        private String completionButtonLabel;
        private String completionButtonUrl;
        private String completionRedirectUrl;
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

    /** Resume an in-flight registration by proving control of its email (sends OTP). */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ResumeRegistrationRequestDTO {
        private String instituteId;
        private String code;
        private String adminEmail;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ResumeVerifyRequestDTO {
        private String registrationId;
        private String otp;
    }

    /**
     * Returned only after resume-verify proves the OTP — powers wizard prefill.
     * (Never returned from the idempotent verify-otp short-circuit: it carries
     * personal data, so it demands a real verification.)
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ResumeVerifyResponseDTO {
        private String registrationId;
        private String status;
        private String kycStatus;
        private ResumeDetailsDTO details;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class ResumeDetailsDTO {
        private String orgName;
        private String orgLogoFileId;
        private String adminName;
        private String adminEmail;
        private String adminPhone;
        private String addressLine1;
        private String addressLine2;
        private String city;
        private String state;
        private String pincode;
    }

    /** Fresh gateway session for a PENDING_PAYMENT registration (payment retry). */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class RetryPaymentRequestDTO {
        private String registrationId;
        private PaymentInitiationRequestDTO paymentInitiationRequest;
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
        /** Collected only when the template has COLLECT_ADDRESS on; null otherwise. */
        private String city;
        private String state;
        private String pincode;
        /** Seats of the spawned sub-org — null until the registration spawns one.
         *  used = active learner members; total = the template's member_count cap. */
        private Long usedSeats;
        private Integer totalSeats;
        private String spawnedSubOrgId;
        private Timestamp createdAt;
        /** Null = KYC not started / not required. */
        private String kycStatus;
    }
}
