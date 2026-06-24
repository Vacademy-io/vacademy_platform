package vacademy.io.admin_core_service.features.telephony.core;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.service.TokenEncryptionService;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.AiCallingConfig;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.AiCallingConfigRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Optional;

/**
 * AI-calling (Aavtaar) credentials, stored in their OWN {@code ai_calling_config}
 * table — separate from {@code institute_telephony_config} (the outbound Airtel/
 * Exotel provider), so the two never collide. {@code UNIQUE(institute_id, provider,
 * company_code)} lets an institute hold multiple accounts per provider; the
 * {@code enabled} account is the one used to place calls / verify webhooks.
 */
@Service
@RequiredArgsConstructor
public class AiCallingConfigService {

    private final AiCallingConfigRepository repo;
    private final TokenEncryptionService enc;

    /** Decrypted creds for placing a call / verifying a webhook. */
    public record DecryptedCreds(String companyCode, String token, String webhookSecret) {}

    /** Masked view for the settings UI — never exposes the raw secrets. */
    public record ConfigView(String companyCode, boolean enabled, boolean hasToken, boolean hasWebhookSecret) {}

    public Optional<DecryptedCreds> getDecrypted(String instituteId) {
        return active(instituteId)
                .map(c -> new DecryptedCreds(
                        c.getCompanyCode(),
                        isBlank(c.getTokenEnc()) ? null : enc.decrypt(c.getTokenEnc()),
                        isBlank(c.getWebhookSecretEnc()) ? null : enc.decrypt(c.getWebhookSecretEnc())));
    }

    public ConfigView getView(String instituteId) {
        AiCallingConfig c = active(instituteId).orElse(null);
        if (c == null) return new ConfigView(null, false, false, false);
        return new ConfigView(
                c.getCompanyCode(),
                c.isEnabled(),
                !isBlank(c.getTokenEnc()),
                !isBlank(c.getWebhookSecretEnc()));
    }

    @Transactional
    public void save(String instituteId, String companyCode, String rawToken,
                     String rawWebhookSecret, Boolean enabled) {
        if (isBlank(companyCode)) throw new VacademyException("Company code is required.");

        // Upsert the account identified by its company code — saving a NEW company
        // code adds another account; the same code updates it (never clobbers another).
        AiCallingConfig c = repo
                .findByInstituteIdAndProviderAndCompanyCode(instituteId, ProviderType.AAVTAAR, companyCode)
                .orElse(null);
        if (c == null) {
            if (isBlank(rawToken)) {
                throw new VacademyException("Bearer token is required when first saving credentials.");
            }
            c = AiCallingConfig.builder()
                    .instituteId(instituteId)
                    .provider(ProviderType.AAVTAAR)
                    .companyCode(companyCode)
                    .tokenEnc(enc.encrypt(rawToken))
                    .enabled(enabled == null || enabled)
                    .build();
        } else {
            if (!isBlank(rawToken)) c.setTokenEnc(enc.encrypt(rawToken)); // blank = keep existing
            if (enabled != null) c.setEnabled(enabled);
        }
        if (!isBlank(rawWebhookSecret)) c.setWebhookSecretEnc(enc.encrypt(rawWebhookSecret));
        repo.save(c);
    }

    private Optional<AiCallingConfig> active(String instituteId) {
        return repo.findFirstByInstituteIdAndProviderAndEnabledTrueOrderByUpdatedAtDesc(
                instituteId, ProviderType.AAVTAAR);
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
