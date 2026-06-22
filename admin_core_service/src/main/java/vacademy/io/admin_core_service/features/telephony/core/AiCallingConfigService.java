package vacademy.io.admin_core_service.features.telephony.core;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.service.TokenEncryptionService;
import vacademy.io.admin_core_service.features.telephony.enums.ProviderType;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.InstituteTelephonyConfig;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.InstituteTelephonyConfigRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Optional;

/**
 * Aavtaar (AI-calling) credentials, stored in the existing
 * {@code institute_telephony_config} table with {@code provider_type = AAVTAAR}:
 *   api_account_id   = company code (plaintext path segment)
 *   api_password_enc = Bearer token (AES-256-GCM)
 *   webhook_token_enc= webhook secret (AES-256-GCM)
 *   api_username_enc = company code (dummy — the column is NOT NULL but Aavtaar
 *                      has no username)
 *
 * NOTE (reuse trade-off): the table is UNIQUE per institute, so an institute
 * configured for Aavtaar here cannot also hold an Exotel config in the same row,
 * and the existing "Calling (Telephony)" settings tab edits the same row. Fine
 * for Aavtaar-only institutes.
 */
@Service
@RequiredArgsConstructor
public class AiCallingConfigService {

    private final InstituteTelephonyConfigRepository repo;
    private final TokenEncryptionService enc;

    /** Decrypted creds for placing a call / verifying a webhook. */
    public record DecryptedCreds(String companyCode, String token, String webhookSecret) {}

    /** Masked view for the settings UI — never exposes the raw secrets. */
    public record ConfigView(String companyCode, boolean enabled, boolean hasToken, boolean hasWebhookSecret) {}

    public Optional<DecryptedCreds> getDecrypted(String instituteId) {
        return repo.findByInstituteId(instituteId)
                .filter(c -> ProviderType.AAVTAAR.equals(c.getProviderType())
                        && Boolean.TRUE.equals(c.getEnabled()))
                .map(c -> new DecryptedCreds(
                        c.getApiAccountId(),
                        isBlank(c.getApiPasswordEnc()) ? null : enc.decrypt(c.getApiPasswordEnc()),
                        isBlank(c.getWebhookTokenEnc()) ? null : enc.decrypt(c.getWebhookTokenEnc())));
    }

    public ConfigView getView(String instituteId) {
        InstituteTelephonyConfig c = repo.findByInstituteId(instituteId)
                .filter(x -> ProviderType.AAVTAAR.equals(x.getProviderType()))
                .orElse(null);
        if (c == null) return new ConfigView(null, false, false, false);
        return new ConfigView(
                c.getApiAccountId(),
                Boolean.TRUE.equals(c.getEnabled()),
                !isBlank(c.getApiPasswordEnc()),
                !isBlank(c.getWebhookTokenEnc()));
    }

    @Transactional
    public void save(String instituteId, String companyCode, String rawToken,
                     String rawWebhookSecret, Boolean enabled) {
        if (isBlank(companyCode)) throw new VacademyException("Company code is required.");

        InstituteTelephonyConfig c = repo.findByInstituteId(instituteId).orElse(null);
        if (c == null) {
            if (isBlank(rawToken)) {
                throw new VacademyException("Bearer token is required when first saving credentials.");
            }
            c = InstituteTelephonyConfig.builder()
                    .instituteId(instituteId)
                    .providerType(ProviderType.AAVTAAR)
                    .apiAccountId(companyCode)
                    .apiUsernameEnc(enc.encrypt(companyCode)) // dummy for the NOT NULL column
                    .apiPasswordEnc(enc.encrypt(rawToken))
                    .build();
        } else {
            c.setProviderType(ProviderType.AAVTAAR);
            c.setApiAccountId(companyCode);
            c.setApiUsernameEnc(enc.encrypt(companyCode));
            if (!isBlank(rawToken)) c.setApiPasswordEnc(enc.encrypt(rawToken)); // blank = keep existing
        }
        if (!isBlank(rawWebhookSecret)) c.setWebhookTokenEnc(enc.encrypt(rawWebhookSecret));
        if (enabled != null) c.setEnabled(enabled);
        repo.save(c);
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
