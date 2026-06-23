package vacademy.io.admin_core_service.features.telephony.core;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.Builder;
import lombok.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.audience.service.TokenEncryptionService;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.InstituteTelephonyConfig;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyProviderNumber;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.InstituteTelephonyConfigRepository;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyProviderNumberRepository;
import vacademy.io.admin_core_service.features.telephony.spi.dto.ProviderCredentials;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

/**
 * Hot-path cache. Webhooks fire 3–5 times per call; without caching, each one
 * would: read InstituteTelephonyConfig from DB, then run 3 AES-GCM decrypts
 * (api username, api password, webhook token). With a 5-minute TTL and the
 * usual ratio of webhooks-per-config, this collapses 99% of those reads to a
 * single in-memory hashmap lookup.
 *
 * Holds a {@link Resolved} value-type — the decrypted creds + the active
 * provider-number list — so callers never touch the encryption service on
 * the hot path. Provider-number list is co-cached because the orchestrator
 * pulls it on every connect and it changes rarely.
 *
 * Invalidate (call {@link #evict}) whenever config or numbers change.
 */
@Component
public class TelephonyConfigCache {

    @Value
    @Builder
    public static class Resolved {
        InstituteTelephonyConfig config;
        ProviderCredentials credentials;
        String webhookToken;
        List<TelephonyProviderNumber> enabledNumbers;
    }

    private final Cache<String, Optional<Resolved>> byInstituteId = Caffeine.newBuilder()
            .maximumSize(1000)
            .expireAfterWrite(Duration.ofMinutes(5))
            .recordStats()
            .build();

    private static final org.slf4j.Logger log =
            org.slf4j.LoggerFactory.getLogger(TelephonyConfigCache.class);

    @Autowired private InstituteTelephonyConfigRepository configRepo;
    @Autowired private TelephonyProviderNumberRepository numberRepo;
    @Autowired private TokenEncryptionService tokenEncryption;

    public Optional<Resolved> get(String instituteId) {
        return byInstituteId.get(instituteId, this::load);
    }

    public void evict(String instituteId) {
        if (instituteId != null) byInstituteId.invalidate(instituteId);
    }

    private Optional<Resolved> load(String instituteId) {
        InstituteTelephonyConfig cfg = configRepo.findByInstituteId(instituteId).orElse(null);
        if (cfg == null) return Optional.empty();

        // Generic credential model (see V339): the non-secret config map and the
        // decrypted secrets blob. Empty for legacy Exotel rows.
        java.util.Map<String, String> config = TelephonyJson.read(cfg.getProviderConfig());
        // Every decrypt below fails soft (key rotation / corrupt ciphertext) — the
        // cache must never throw past the webhook hot-path boundary (the call still
        // gets a Resolved; a provider call needing the missing secret fails cleanly).
        String secretsJson = safeDecrypt(cfg.getProviderSecretsEnc(), instituteId);
        java.util.Map<String, String> secrets = secretsJson == null
                ? new java.util.LinkedHashMap<>() : TelephonyJson.read(secretsJson);

        // Legacy Basic triplet stays primary when present (Exotel). When absent,
        // fall back to the generic secrets map so a provider that stores its
        // basic creds there still populates the convenience getters.
        String username = (cfg.getApiUsernameEnc() != null && !cfg.getApiUsernameEnc().isBlank())
                ? safeDecrypt(cfg.getApiUsernameEnc(), instituteId)
                : secrets.get("username");
        String password = (cfg.getApiPasswordEnc() != null && !cfg.getApiPasswordEnc().isBlank())
                ? safeDecrypt(cfg.getApiPasswordEnc(), instituteId)
                : secrets.get("password");

        ProviderCredentials creds = ProviderCredentials.builder()
                .providerType(cfg.getProviderType())
                .authType(cfg.getAuthType())
                .accountId(cfg.getApiAccountId())
                .username(username)
                .password(password)
                .secrets(secrets)
                .config(config)
                .build();
        // webhookTokenEnc is nullable. When absent the institute is in
        // "open webhook" mode — the handler accepts all callbacks and we
        // don't add a ?token= param to the StatusCallback URL.
        String webhookToken = safeDecrypt(cfg.getWebhookTokenEnc(), instituteId);
        List<TelephonyProviderNumber> numbers = numberRepo.findEnabledByConfigId(cfg.getId());
        return Optional.of(Resolved.builder()
                .config(cfg)
                .credentials(creds)
                .webhookToken(webhookToken)
                .enabledNumbers(numbers)
                .build());
    }

    /**
     * Decrypt fail-soft: null/blank → null; a decrypt failure (rotated key /
     * corrupt ciphertext) logs and returns null rather than throwing past the
     * webhook hot-path boundary.
     */
    private String safeDecrypt(String enc, String instituteId) {
        if (enc == null || enc.isBlank()) return null;
        try {
            return tokenEncryption.decrypt(enc);
        } catch (Exception e) {
            log.warn("telephony config: decrypt failed for institute {} — degrading (creds unavailable)", instituteId);
            return null;
        }
    }
}
