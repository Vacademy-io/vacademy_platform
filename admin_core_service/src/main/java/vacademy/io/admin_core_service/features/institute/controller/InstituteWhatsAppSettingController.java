package vacademy.io.admin_core_service.features.institute.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute.dto.settings.SwitchWhatsAppProviderRequest;
import vacademy.io.admin_core_service.features.institute.dto.settings.WhatsAppProviderCredentialsRequest;
import vacademy.io.admin_core_service.features.institute.dto.settings.WhatsAppProviderStatusResponse;
import vacademy.io.admin_core_service.features.institute.service.setting.WhatsAppSettingService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/institute/whatsapp-config/v1")
@RequiredArgsConstructor
@Slf4j
public class InstituteWhatsAppSettingController {

    private final WhatsAppSettingService whatsappSettingService;

    /**
     * Get configured providers and active provider status.
     */
    @GetMapping("/status")
    public ResponseEntity<WhatsAppProviderStatusResponse> getProviderStatus(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("instituteId") String instituteId) {
        log.info("Fetching WhatsApp status for instituteId: {}", instituteId);
        WhatsAppProviderStatusResponse status = whatsappSettingService.getProviderStatus(instituteId);
        return ResponseEntity.ok(status);
    }

    /**
     * Switch the active WhatsApp provider.
     */
    @PutMapping("/provider")
    public ResponseEntity<String> switchProvider(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("instituteId") String instituteId,
            @RequestBody SwitchWhatsAppProviderRequest request) {
        log.info("Switching provider for instituteId: {} to new provider: {}", instituteId, request.getNewProvider());
        whatsappSettingService.switchProvider(instituteId, request);
        return ResponseEntity.ok("Successfully switched WhatsApp Provider");
    }

    /**
     * Add or Update credentials for a particular WhatsApp provider (e.g. 'combot',
     * 'wati', 'meta')
     */
    @PutMapping("/credentials")
    public ResponseEntity<String> updateCredentials(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("instituteId") String instituteId,
            @RequestBody WhatsAppProviderCredentialsRequest request) {
        log.info("Updating credentials for provider '{}' in instituteId: {}", request.getProviderName(), instituteId);
        whatsappSettingService.updateCredentials(instituteId, request);
        return ResponseEntity.ok("Successfully updated WhatsApp Credentials");
    }

    /**
     * Remove credentials for a particular WhatsApp provider (and fall back if it
     * was active).
     */
    @DeleteMapping("/credentials/{providerName}")
    public ResponseEntity<String> removeCredentials(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("instituteId") String instituteId,
            @PathVariable("providerName") String providerName) {
        log.info("Removing credentials for provider '{}' in instituteId: {}", providerName, instituteId);
        whatsappSettingService.removeCredentials(instituteId, providerName);
        return ResponseEntity.ok("Successfully removed WhatsApp Credentials");
    }
}
