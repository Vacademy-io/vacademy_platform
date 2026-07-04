package vacademy.io.admin_core_service.features.suborg.registration.enums;

/**
 * DigiLocker KYC state for one registration attempt. Null on the row = not started.
 * PENDING = consent URL minted; VERIFIED = documents fetched & stored;
 * CONSENT_DENIED / EXPIRED / FAILED map to Cashfree's terminal states (retryable via a
 * fresh startKyc, which mints a new verification_id).
 */
public enum SubOrgKycStatus {
    PENDING,
    VERIFIED,
    CONSENT_DENIED,
    EXPIRED,
    FAILED
}
