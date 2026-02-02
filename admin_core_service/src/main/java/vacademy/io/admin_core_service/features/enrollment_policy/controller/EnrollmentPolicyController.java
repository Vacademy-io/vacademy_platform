package vacademy.io.admin_core_service.features.enrollment_policy.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.enrollment_policy.dto.EnrollmentPolicySettingsDTO;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.Optional;

/**
 * Controller for enrollment policy related endpoints.
 * Provides APIs to fetch enrollment policy settings for package sessions.
 */
@Slf4j
@RestController
@RequestMapping("/admin-core-service/enrollment-policy")
@RequiredArgsConstructor
public class EnrollmentPolicyController {

    private final PackageSessionRepository packageSessionRepository;
    private final ObjectMapper objectMapper;

    /**
     * Get enrollment policy settings for a specific package session.
     * 
     * @param packageSessionId The ID of the package session
     * @return EnrollmentPolicySettingsDTO containing policy configuration
     *         including enrollInvites, whatsappMessages, notifications, etc.
     */
    @GetMapping("/package-session/{packageSessionId}")
    public ResponseEntity<EnrollmentPolicySettingsDTO> getEnrollmentPolicy(
            @PathVariable String packageSessionId) {
        log.info("Fetching enrollment policy for package session: {}", packageSessionId);

        Optional<PackageSession> packageSessionOpt = packageSessionRepository.findById(packageSessionId);

        if (packageSessionOpt.isEmpty()) {
            log.warn("Package session not found: {}", packageSessionId);
            throw new VacademyException("Package session not found: " + packageSessionId);
        }

        PackageSession packageSession = packageSessionOpt.get();
        String policyJson = packageSession.getEnrollmentPolicySettings();

        if (policyJson == null || policyJson.isBlank()) {
            log.info("No enrollment policy settings found for package session: {}", packageSessionId);
            // Return empty policy instead of null
            return ResponseEntity.ok(EnrollmentPolicySettingsDTO.builder().build());
        }

        try {
            EnrollmentPolicySettingsDTO policy = objectMapper.readValue(policyJson, EnrollmentPolicySettingsDTO.class);
            log.info("Successfully fetched enrollment policy for package session: {}", packageSessionId);
            return ResponseEntity.ok(policy);
        } catch (Exception e) {
            log.error("Error parsing enrollment policy JSON for package session {}: {}",
                    packageSessionId, e.getMessage());
            throw new VacademyException("Error parsing enrollment policy: " + e.getMessage());
        }
    }

    /**
     * Get raw enrollment policy JSON for a specific package session.
     * Useful for debugging or when clients need the raw JSON.
     * 
     * @param packageSessionId The ID of the package session
     * @return Raw JSON string of the enrollment policy
     */
    @GetMapping("/package-session/{packageSessionId}/raw")
    public ResponseEntity<String> getEnrollmentPolicyRaw(
            @PathVariable String packageSessionId) {
        log.info("Fetching raw enrollment policy for package session: {}", packageSessionId);

        Optional<PackageSession> packageSessionOpt = packageSessionRepository.findById(packageSessionId);

        if (packageSessionOpt.isEmpty()) {
            log.warn("Package session not found: {}", packageSessionId);
            throw new VacademyException("Package session not found: " + packageSessionId);
        }

        PackageSession packageSession = packageSessionOpt.get();
        String policyJson = packageSession.getEnrollmentPolicySettings();

        if (policyJson == null || policyJson.isBlank()) {
            return ResponseEntity.ok("{}");
        }

        return ResponseEntity.ok(policyJson);
    }
}
