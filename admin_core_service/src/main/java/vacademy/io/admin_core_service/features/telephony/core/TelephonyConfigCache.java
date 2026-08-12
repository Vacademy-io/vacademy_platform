package vacademy.io.admin_core_service.features.telephony.core;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import lombok.Builder;
import lombok.Value;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.audience.service.TokenEncryptionService;
import vacademy.io.admin_core_service.features.telephony.enums.ConfigRole;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
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
 *
 * <p>Two roles are cached separately (V448): {@link #get} serves the institute's
 * PRIMARY human-calling provider and {@link #getForAi} the carrier a Vacademy AI
 * call runs on — the dedicated AI_VOICE line if one exists, else PRIMARY.
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

        /** True when this is a DEDICATED AI-calling line, not the institute's human provider. */
        public boolean isDedicatedAiCarrier() {
            return config != null && ConfigRole.AI_VOICE.equals(config.getRole());
        }

        /**
         * Caller-ID for a dedicated AI carrier, from {@code provider_config.callerId}.
         *
         * <p>Deliberately null for a PRIMARY row: an AI carrier's number is stored on
         * the config itself rather than as a {@code telephony_provider_number}, so that
         * adding one cannot alter the institute's number pool, its inbound DID lookup
         * ({@code findEnabledByPhoneNumber}), or the Numbers card. Primary rows keep
         * resolving their caller-ID exactly as before.
         */
        public String getAiCallerId() {
            if (!isDedicatedAiCarrier() || credentials == null) return null;
            String v = credentials.conf("callerId");
            return (v == null || v.isBlank()) ? null : v.trim();
        }
    }

    /** The institute's PRIMARY (human-calling) config. */
    private final Cache<String, Optional<Resolved>> byInstituteId = Caffeine.newBuilder()
            .maximumSize(1000)
            .expireAfterWrite(Duration.ofMinutes(5))
            .recordStats()
            .build();

    /** The institute's dedicated AI_VOICE config, when it has one (usually absent). */
    private final Cache<String, Optional<Resolved>> aiByInstituteId = Caffeine.newBuilder()
            .maximumSize(1000)
            .expireAfterWrite(Duration.ofMinutes(5))
            .recordStats()
            .build();

    private static final org.slf4j.Logger log =
            org.slf4j.LoggerFactory.getLogger(TelephonyConfigCache.class);

    @Autowired private InstituteTelephonyConfigRepository configRepo;
    @Autowired private TelephonyProviderNumberRepository numberRepo;
    @Autowired private TokenEncryptionService tokenEncryption;

    /**
     * The institute's PRIMARY calling config — the provider its counsellors dial on
     * and receive inbound calls through. This is what every human-calling path wants,
     * and its meaning is unchanged by V448.
     */
    public Optional<Resolved> get(String instituteId) {
        return byInstituteId.get(instituteId, id -> load(id, ConfigRole.PRIMARY));
    }

    /**
     * The carrier a Vacademy AI call should be placed on: the institute's dedicated
     * AI_VOICE line when it has one, else the PRIMARY provider.
     *
     * <p>The fallback is the whole compatibility story — an institute already running
     * Vacademy Voice has no AI_VOICE row and therefore takes byte-identical behaviour
     * to before. A dedicated row only ever exists because someone explicitly added one.
     *
     * <p>A DISABLED AI_VOICE row is ignored rather than treated as "no AI calling", so
     * turning the dedicated line off returns the institute to the primary-provider
     * path instead of silently breaking every dial.
     */
    public Optional<Resolved> getForAi(String instituteId) {
        Optional<Resolved> dedicated = aiByInstituteId.get(instituteId, id -> load(id, ConfigRole.AI_VOICE))
                .filter(r -> Boolean.TRUE.equals(r.getConfig().getEnabled()));
        return dedicated.isPresent() ? dedicated : get(instituteId);
    }

    /**
     * The config that owns a call, given the call-log row's provider. VACADEMY_AI rows
     * ran on the AI carrier; everything else on the primary provider. Use this from any
     * path that is handed an existing call (webhooks, applet continuations, recording
     * copies) so the credentials, webhook token and caller-ID all come from the account
     * that actually placed the call.
     */
    public Optional<Resolved> forCallProvider(String instituteId, String callProviderType) {
        return ProviderType.VACADEMY_AI.equals(callProviderType)
                ? getForAi(instituteId)
                : get(instituteId);
    }

    /** Invalidate both roles — callers rarely know which one they just changed. */
    public void evict(String instituteId) {
        if (instituteId == null) return;
        byInstituteId.invalidate(instituteId);
        aiByInstituteId.invalidate(instituteId);
    }

    private Optional<Resolved> load(String instituteId, String role) {
        InstituteTelephonyConfig cfg = configRepo.findByInstituteIdAndRole(instituteId, role).orElse(null);
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
