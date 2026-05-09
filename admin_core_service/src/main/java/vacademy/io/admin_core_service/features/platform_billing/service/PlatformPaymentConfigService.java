package vacademy.io.admin_core_service.features.platform_billing.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.audience.service.TokenEncryptionService;
import vacademy.io.admin_core_service.features.platform_billing.entity.PlatformPaymentConfig;
import vacademy.io.admin_core_service.features.platform_billing.repository.PlatformPaymentConfigRepository;
import vacademy.io.common.exceptions.VacademyException;

import jakarta.annotation.PostConstruct;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * Loads the singleton {@code platform_payment_config} row, decrypts its secrets,
 * and exposes a credentials map shaped exactly like the third argument of
 * {@link vacademy.io.admin_core_service.features.payments.manager.RazorpayPaymentManager#initiatePayment}.
 *
 * Caching: the decrypted creds are held in memory after first load; call
 * {@link #invalidateCache()} after rotating secrets via SQL/admin API.
 *
 * Production-key guard ({@link #verifyProductionKey()}): since {@link TokenEncryptionService}
 * silently falls back to a 32-zero-byte AES key when {@code OAUTH_TOKEN_ENCRYPTION_KEY}
 * is missing, our Razorpay key_secret + webhook_secret would land in the DB
 * encrypted-with-a-known-key (functionally cleartext). On the production profile
 * the absence of an explicit key is fatal at startup.
 */
@Slf4j
@Service
public class PlatformPaymentConfigService {

    /** Profiles where missing OAUTH_TOKEN_ENCRYPTION_KEY is fatal at startup. */
    private static final Set<String> PROD_PROFILES = Set.of("prod", "production");

    private final PlatformPaymentConfigRepository repository;
    private final TokenEncryptionService encryption;
    private final Environment environment;
    private final String configuredEncryptionKey;

    /** Cached decrypted view. {@code null} until first load or after invalidation. */
    private volatile PlatformPaymentConfig cachedRow;
    private volatile Map<String, Object> cachedRazorpayCredsMap;

    public PlatformPaymentConfigService(
            PlatformPaymentConfigRepository repository,
            TokenEncryptionService encryption,
            Environment environment,
            @Value("${oauth.token.encryption.key:}") String configuredEncryptionKey) {
        this.repository = repository;
        this.encryption = encryption;
        this.environment = environment;
        this.configuredEncryptionKey = configuredEncryptionKey;
    }

    /**
     * Fail-fast guard: if we're on a production profile and the encryption key
     * is unset, refuse to start. Without this, our platform Razorpay secrets
     * end up in the DB "encrypted" with the all-zeros dev fallback key.
     *
     * Non-prod profiles get a loud warning instead — secrets are still encrypted
     * but with a publicly-known key, which is fine for staging/dev.
     */
    @PostConstruct
    void verifyProductionKey() {
        boolean keyConfigured = configuredEncryptionKey != null && !configuredEncryptionKey.isBlank();
        boolean onProdProfile = Arrays.stream(environment.getActiveProfiles())
                .map(p -> p == null ? "" : p.toLowerCase())
                .anyMatch(PROD_PROFILES::contains);

        if (onProdProfile && !keyConfigured) {
            throw new IllegalStateException(
                    "REFUSING TO START: OAUTH_TOKEN_ENCRYPTION_KEY is not set on a "
                  + "production profile. Platform Razorpay secrets in "
                  + "platform_payment_config would be stored under the dev fallback "
                  + "key (32 zero bytes), which is equivalent to plaintext. "
                  + "Set the env var to a base64-encoded 32-byte key "
                  + "(generate with: openssl rand -base64 32) and restart.");
        }
        if (!keyConfigured) {
            log.warn("⚠ OAUTH_TOKEN_ENCRYPTION_KEY is not set — platform_payment_config "
                   + "secrets will be encrypted with the well-known dev fallback key. "
                   + "Acceptable for stage/dev only; production startup will fail.");
        }
    }

    /**
     * @return the active config row.
     * @throws VacademyException if the singleton row hasn't been bootstrapped yet.
     */
    public PlatformPaymentConfig load() {
        if (cachedRow != null) {
            return cachedRow;
        }
        PlatformPaymentConfig row = repository.findFirstByIsActiveTrue()
                .orElseThrow(() -> new VacademyException(
                        "platform_payment_config row is missing — ops must INSERT once "
                        + "with platform Razorpay creds before AI credit pack purchases work"));
        cachedRow = row;
        return row;
    }

    /**
     * Build the creds map in the exact shape consumed by RazorpayPaymentManager:
     * {@code {apiKey, keyId, publishableKey, keySecret, webhookSecret}}. The
     * manager's extractApiKey/extractKeySecret helpers accept either {@code apiKey}
     * or {@code keyId} aliases — we populate both for safety.
     */
    public Map<String, Object> getRazorpayCredsMap() {
        if (cachedRazorpayCredsMap != null) {
            return cachedRazorpayCredsMap;
        }
        PlatformPaymentConfig row = load();
        Map<String, Object> creds = new HashMap<>();
        creds.put("apiKey", row.getApiKey());
        creds.put("keyId", row.getApiKey());
        creds.put("publishableKey", row.getApiKey());
        creds.put("keySecret", encryption.decrypt(row.getKeySecretEncrypted()));
        creds.put("webhookSecret", encryption.decrypt(row.getWebhookSecretEncrypted()));
        cachedRazorpayCredsMap = creds;
        return creds;
    }

    /** Just the webhook secret — used by the platform webhook signature verifier. */
    public String getWebhookSecret() {
        return (String) getRazorpayCredsMap().get("webhookSecret");
    }

    /** Drop the in-memory cache; next call reloads + re-decrypts from DB. */
    public synchronized void invalidateCache() {
        cachedRow = null;
        cachedRazorpayCredsMap = null;
        log.info("PlatformPaymentConfig cache invalidated");
    }

    /**
     * One-shot bootstrap of the singleton row. Encrypts secrets server-side
     * with the live encryption key (so we never write a row encrypted under
     * a different key than the one that will decrypt it), then INSERTs.
     *
     * Refuses with {@link VacademyException} if a row already exists — the
     * singleton table is meant to be set up once. To rotate, ops should use
     * a future {@code rotateSecrets()} method (out of scope for v1) or
     * temporarily set is_active=false on the existing row, INSERT a new one,
     * and clean up.
     *
     * Returns the new row id; the caller (controller) decides what to expose.
     */
    @org.springframework.transaction.annotation.Transactional
    public String bootstrap(
            String apiKey,
            String keySecretPlain,
            String webhookSecretPlain,
            String supplierLegalName,
            String supplierGstin,
            String supplierStateCode,
            String supplierAddress) {

        if (apiKey == null || apiKey.isBlank()
                || keySecretPlain == null || keySecretPlain.isBlank()
                || webhookSecretPlain == null || webhookSecretPlain.isBlank()
                || supplierLegalName == null || supplierLegalName.isBlank()
                || supplierStateCode == null || supplierStateCode.isBlank()
                || supplierAddress == null || supplierAddress.isBlank()) {
            throw new VacademyException(
                    "apiKey, keySecret, webhookSecret, supplierLegalName, "
                  + "supplierStateCode, supplierAddress are all required");
        }
        if (supplierStateCode.length() != 2) {
            throw new VacademyException(
                    "supplierStateCode must be the 2-char numeric Indian state code "
                  + "(e.g. '29' for Karnataka, '27' for Maharashtra)");
        }
        if (supplierGstin != null && !supplierGstin.isBlank() && supplierGstin.length() != 15) {
            throw new VacademyException("supplierGstin, when provided, must be 15 chars");
        }

        if (repository.findFirstByIsActiveTrue().isPresent()) {
            throw new VacademyException(
                    "platform_payment_config is already bootstrapped. To rotate "
                  + "secrets, set is_active=false on the existing row, then call "
                  + "bootstrap again. (A clean rotate endpoint is on the roadmap.)");
        }

        PlatformPaymentConfig row = new PlatformPaymentConfig();
        row.setSingletonLock(true);
        row.setVendor("RAZORPAY");
        row.setApiKey(apiKey);
        row.setKeySecretEncrypted(encryption.encrypt(keySecretPlain));
        row.setWebhookSecretEncrypted(encryption.encrypt(webhookSecretPlain));
        row.setSupplierLegalName(supplierLegalName);
        row.setSupplierGstin(supplierGstin == null || supplierGstin.isBlank() ? null : supplierGstin);
        row.setSupplierStateCode(supplierStateCode);
        row.setSupplierAddress(supplierAddress);
        row.setIsActive(true);

        PlatformPaymentConfig saved = repository.save(row);

        // Don't poison the cache — next read will pick up the new row.
        invalidateCache();

        log.info("platform_payment_config bootstrapped (id={}, supplier={})",
                saved.getId(), saved.getSupplierLegalName());
        return saved.getId();
    }

    /**
     * Read-only view of the config for ops (used by the admin "view config"
     * endpoint). Returns everything EXCEPT the secrets — even the api_key is
     * left in (it's the publishable key) but the key_secret + webhook_secret
     * never leave the server.
     */
    public Map<String, Object> describeForAdmin() {
        PlatformPaymentConfig row = load();
        Map<String, Object> view = new HashMap<>();
        view.put("id", row.getId());
        view.put("vendor", row.getVendor());
        view.put("apiKey", row.getApiKey());                 // publishable, safe
        view.put("keySecretEncryptedPresent", row.getKeySecretEncrypted() != null);
        view.put("webhookSecretEncryptedPresent", row.getWebhookSecretEncrypted() != null);
        view.put("supplierLegalName", row.getSupplierLegalName());
        view.put("supplierGstin", row.getSupplierGstin());
        view.put("supplierStateCode", row.getSupplierStateCode());
        view.put("supplierAddress", row.getSupplierAddress());
        view.put("isActive", row.getIsActive());
        view.put("createdAt", row.getCreatedAt());
        view.put("updatedAt", row.getUpdatedAt());
        return view;
    }
}
