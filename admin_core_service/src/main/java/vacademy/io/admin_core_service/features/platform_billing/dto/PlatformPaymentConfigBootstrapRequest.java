package vacademy.io.admin_core_service.features.platform_billing.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.Data;

/**
 * Plaintext config submitted ONCE to bootstrap the platform's Razorpay
 * credentials and supplier identity.
 *
 * Server-side {@code PlatformPaymentConfigService.bootstrap} encrypts
 * {@code keySecret} and {@code webhookSecret} via TokenEncryptionService
 * before persisting — the plaintext never lands in the DB.
 *
 * Snake-case JSON: {api_key, key_secret, webhook_secret, supplier_legal_name,
 * supplier_gstin, supplier_state_code, supplier_address}.
 */
@Data
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class PlatformPaymentConfigBootstrapRequest {

    /** Razorpay key_id (publishable, e.g. "rzp_live_xxxxxxxxxxxxxxxx" or "rzp_test_..."). */
    private String apiKey;

    /** Razorpay key_secret (PLAINTEXT — encrypted server-side, never logged). */
    private String keySecret;

    /** Razorpay webhook signing secret from the Razorpay dashboard (PLAINTEXT — encrypted server-side). */
    private String webhookSecret;

    /** Legal supplier name printed on invoices (e.g. "Vacademy Edutech Pvt. Ltd."). */
    private String supplierLegalName;

    /** Supplier's 15-char GSTIN. Optional only if not GST-registered. */
    private String supplierGstin;

    /** 2-char numeric Indian state code ("29" Karnataka, "27" Maharashtra, etc.). */
    private String supplierStateCode;

    /** Full supplier address printed on invoices. */
    private String supplierAddress;
}
