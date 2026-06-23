package vacademy.io.admin_core_service.features.telephony.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.telephony.controller.dto.ProviderDescriptorDTO;
import vacademy.io.admin_core_service.features.telephony.core.TelephonyProviderRegistry;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Lists the telephony providers the backend can serve (one entry per registered
 * adapter descriptor), with each provider's capabilities + credential schema.
 * The admin UI renders its provider dropdown, credential form, and
 * capability-gated sections entirely from this — adding a provider is a
 * backend-only change.
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/providers")
public class TelephonyProvidersController {

    @Autowired private TelephonyProviderRegistry registry;

    @GetMapping
    public ResponseEntity<List<ProviderDescriptorDTO>> list() {
        List<ProviderDescriptorDTO> providers = registry.descriptors().stream()
                .map(ProviderDescriptorDTO::from)
                .sorted((a, b) -> a.getDisplayName().compareToIgnoreCase(b.getDisplayName()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(providers);
    }
}
