package vacademy.io.admin_core_service.features.suborg.registration.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * One open self-registration attempt through a SUB_ORG_REGISTRATION template invite.
 * See V356 migration + SubOrgRegistrationStatus for the status machine.
 */
@Entity
@Table(name = "sub_org_registration")
@Data
@NoArgsConstructor
public class SubOrgRegistration {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "template_invite_id", nullable = false)
    private String templateInviteId;

    /** Parent institute the template belongs to (and the spawned sub-org's parent). */
    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "status", nullable = false)
    private String status;

    @Column(name = "org_name")
    private String orgName;

    @Column(name = "org_logo_file_id")
    private String orgLogoFileId;

    @Column(name = "admin_name")
    private String adminName;

    @Column(name = "admin_email")
    private String adminEmail;

    @Column(name = "admin_phone")
    private String adminPhone;

    @Column(name = "otp_verified_at")
    private Timestamp otpVerifiedAt;

    @Column(name = "tnc_accepted_at")
    private Timestamp tncAcceptedAt;

    @Column(name = "spawned_sub_org_id")
    private String spawnedSubOrgId;

    @Column(name = "spawned_invite_id")
    private String spawnedInviteId;

    @Column(name = "spawned_user_id")
    private String spawnedUserId;

    /** Null = KYC not started. See SubOrgKycStatus. */
    @Column(name = "kyc_status")
    private String kycStatus;

    /** Our unique id sent to Cashfree SecureID; webhook lookup key. Fresh per attempt. */
    @Column(name = "kyc_verification_id")
    private String kycVerificationId;

    /** Fetched verified document data: {"AADHAAR": {...}, "PAN": {...}}. */
    @Column(name = "kyc_documents_json", columnDefinition = "TEXT")
    private String kycDocumentsJson;

    @Column(name = "kyc_verified_at")
    private Timestamp kycVerifiedAt;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
