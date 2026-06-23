package vacademy.io.admin_core_service.features.telephony.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.telephony.core.AiCallingConfigService;
import vacademy.io.admin_core_service.features.telephony.core.AiVoiceProviderRegistry;
import vacademy.io.admin_core_service.features.telephony.core.dto.AiCallingConfigDTO;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.ArrayList;
import java.util.List;

/**
 * Per-institute AI-voice credentials (company code + bearer token + webhook
 * secret), stored encrypted in institute_telephony_config. Authenticated admin
 * action. GET returns a masked view; PUT writes (token/secret encrypted).
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/ai-config")
@RequiredArgsConstructor
public class AiCallingConfigController {

    private final AiCallingConfigService service;
    private final AiVoiceProviderRegistry providerRegistry;

    /**
     * AI-voice providers wired in this deployment (e.g. ["AAVTAAR"]) — drives the
     * settings provider picker so the UI never hardcodes a provider. Two path
     * segments, so it can't collide with the {@code /{instituteId}} mapping.
     */
    @GetMapping("/meta/providers")
    public ResponseEntity<List<String>> providers() {
        return ResponseEntity.ok(new ArrayList<>(providerRegistry.outboundProviderTypes()));
    }

    @GetMapping("/{instituteId}")
    public ResponseEntity<AiCallingConfigService.ConfigView> get(
            @PathVariable String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(service.getView(instituteId));
    }

    @PutMapping("/{instituteId}")
    public ResponseEntity<Void> save(
            @PathVariable String instituteId,
            @RequestBody AiCallingConfigDTO dto,
            @RequestAttribute("user") CustomUserDetails user) {
        service.save(instituteId, dto.getCompanyCode(), dto.getApiToken(),
                dto.getWebhookSecret(), dto.getEnabled());
        return ResponseEntity.ok().build();
    }
}
