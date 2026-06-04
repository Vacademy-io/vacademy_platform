package vacademy.io.admin_core_service.features.telephony.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.audience.service.TokenEncryptionService;
import vacademy.io.admin_core_service.features.telephony.controller.dto.TelephonyConfigDTO;
import vacademy.io.admin_core_service.features.telephony.controller.dto.TelephonyConfigViewDTO;
import vacademy.io.admin_core_service.features.telephony.core.TelephonyConfigCache;
import vacademy.io.admin_core_service.features.telephony.enums.SelectorStrategy;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.InstituteTelephonyConfig;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.InstituteTelephonyConfigRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Optional;
import java.util.Set;

@RestController
@RequestMapping("/admin-core-service/v1/telephony/config")
public class TelephonyConfigController {

    private static final Set<String> KNOWN_STRATEGIES = Set.of(
            SelectorStrategy.STICKY_PER_LEAD,
            SelectorStrategy.ROUND_ROBIN,
            SelectorStrategy.REGION_MATCH);

    @Autowired private InstituteTelephonyConfigRepository repo;
    @Autowired private TokenEncryptionService tokenEncryption;
    @Autowired private TelephonyConfigCache configCache;

    @GetMapping("/{instituteId}")
    public ResponseEntity<TelephonyConfigViewDTO> get(@PathVariable String instituteId) {
        return repo.findByInstituteId(instituteId)
                .map(c -> ResponseEntity.ok(TelephonyConfigViewDTO.from(c)))
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping("/{instituteId}")
    @Transactional
    public ResponseEntity<TelephonyConfigViewDTO> upsert(
            @PathVariable String instituteId,
            @RequestBody TelephonyConfigDTO body,
            @RequestAttribute("user") CustomUserDetails user) {
        if (body.getProviderType() == null || body.getProviderType().isBlank()) {
            throw new VacademyException("providerType is required");
        }
        if (body.getDefaultSelectorKey() != null
                && !KNOWN_STRATEGIES.contains(body.getDefaultSelectorKey())) {
            throw new VacademyException("Unknown selector strategy: " + body.getDefaultSelectorKey());
        }

        Optional<InstituteTelephonyConfig> existing = repo.findByInstituteId(instituteId);
        boolean isCreate = existing.isEmpty();
        InstituteTelephonyConfig cfg = existing.orElseGet(InstituteTelephonyConfig::new);
        cfg.setInstituteId(instituteId);
        cfg.setProviderType(body.getProviderType());
        if (body.getApiAccountId() != null) cfg.setApiAccountId(body.getApiAccountId());

        // On create, the API credentials (account id + username + password)
        // must arrive non-blank — without them we can't even authenticate to
        // Exotel. webhookToken is optional: when omitted, our webhook handler
        // runs in "open" mode and accepts all callbacks for this institute's
        // calls (matched by our own corr id). Institutes that want the
        // shared-secret guard can set it now or later.
        // On update, blank means "leave as-is" for any field so admins don't
        // accidentally wipe stored creds by saving the form again.
        if (isCreate) {
            requireNonBlank(body.getApiAccountId(), "apiAccountId is required on first save");
            requireNonBlank(body.getApiUsername(),  "apiUsername is required on first save");
            requireNonBlank(body.getApiPassword(),  "apiPassword is required on first save");
        }
        encryptIfPresent(body.getApiUsername(),  cfg::setApiUsernameEnc);
        encryptIfPresent(body.getApiPassword(),  cfg::setApiPasswordEnc);
        encryptIfPresent(body.getWebhookToken(), cfg::setWebhookTokenEnc);

        if (body.getRecordCalls()       != null) cfg.setRecordCalls(body.getRecordCalls());
        if (body.getDefaultSelectorKey() != null) cfg.setDefaultSelectorKey(body.getDefaultSelectorKey());
        if (body.getEnabled()           != null) cfg.setEnabled(body.getEnabled());

        InstituteTelephonyConfig saved = repo.save(cfg);
        // Hot-path cache holds decrypted creds + numbers — drop the entry so
        // the next webhook / connect reloads with the new values.
        configCache.evict(instituteId);
        return ResponseEntity.ok(TelephonyConfigViewDTO.from(saved));
    }

    private static void requireNonBlank(String s, String msg) {
        if (s == null || s.isBlank()) throw new VacademyException(msg);
    }

    private void encryptIfPresent(String plaintext, java.util.function.Consumer<String> setter) {
        if (plaintext == null || plaintext.isBlank()) return;
        setter.accept(tokenEncryption.encrypt(plaintext));
    }
}
