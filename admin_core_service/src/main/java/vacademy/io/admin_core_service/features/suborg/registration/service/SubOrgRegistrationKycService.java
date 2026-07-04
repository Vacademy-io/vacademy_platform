package vacademy.io.admin_core_service.features.suborg.registration.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.enroll_invite.repository.EnrollInviteRepository;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.KycStatusResponseDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationFlowDTOs.StartKycResponseDTO;
import vacademy.io.admin_core_service.features.suborg.registration.dto.SubOrgRegistrationSettingDTO;
import vacademy.io.admin_core_service.features.suborg.registration.entity.SubOrgRegistration;
import vacademy.io.admin_core_service.features.suborg.registration.enums.SubOrgKycStatus;
import vacademy.io.admin_core_service.features.suborg.registration.enums.SubOrgRegistrationStatus;
import vacademy.io.admin_core_service.features.suborg.registration.repository.SubOrgRegistrationRepository;
import vacademy.io.common.exceptions.VacademyException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * DigiLocker KYC (Cashfree SecureID) for the open sub-org registration flow.
 * start → PENDING; wizard polls status (or Cashfree webhook fires) → on AUTHENTICATED the
 * configured documents are fetched (consent window ~1h) and stored → VERIFIED.
 * SubOrgRegistrationService.complete() gates on VERIFIED when the template has a KYC step.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SubOrgRegistrationKycService {

    /** Cashfree webhook timestamps outside this window are rejected (replay guard). */
    private static final long WEBHOOK_REPLAY_WINDOW_MS = 5 * 60 * 1000L;

    private final SubOrgRegistrationRepository registrationRepository;
    private final EnrollInviteRepository enrollInviteRepository;
    private final CashfreeSecureIdClient secureIdClient;
    private final ObjectMapper objectMapper;

    @Transactional
    public StartKycResponseDTO startKyc(String registrationId, String redirectUrl) {
        SubOrgRegistration registration = requireRegistration(registrationId);
        if (!SubOrgRegistrationStatus.OTP_VERIFIED.name().equals(registration.getStatus())) {
            throw new VacademyException("Email verification is required before identity verification");
        }
        List<String> documents = requireKycDocuments(registration);
        if (SubOrgKycStatus.VERIFIED.name().equals(registration.getKycStatus())) {
            throw new VacademyException("Identity verification is already completed");
        }
        if (StringUtils.hasText(redirectUrl) && !redirectUrl.startsWith("https://")) {
            throw new VacademyException("redirect_url must be https");
        }

        // Fresh verification id per attempt (Cashfree requires uniqueness; retries after
        // CONSENT_DENIED/EXPIRED mint a new one). "sor_" + UUID = 40 chars (limit 50).
        String verificationId = "sor_" + UUID.randomUUID();
        Map<String, Object> response =
                secureIdClient.createDigilockerUrl(verificationId, documents, redirectUrl);
        Object url = response != null ? response.get("url") : null;
        if (url == null) {
            throw new VacademyException("Could not start identity verification. Please try again.");
        }

        registration.setKycVerificationId(verificationId);
        registration.setKycStatus(SubOrgKycStatus.PENDING.name());
        registrationRepository.save(registration);
        return StartKycResponseDTO.builder()
                .registrationId(registration.getId())
                .kycStatus(registration.getKycStatus())
                .url(url.toString())
                .build();
    }

    @Transactional
    public KycStatusResponseDTO getKycStatus(String registrationId) {
        SubOrgRegistration registration = requireRegistration(registrationId);
        if (SubOrgKycStatus.VERIFIED.name().equals(registration.getKycStatus())) {
            return buildStatusResponse(registration);
        }
        if (!StringUtils.hasText(registration.getKycVerificationId())) {
            return KycStatusResponseDTO.builder()
                    .registrationId(registration.getId())
                    .kycStatus("NOT_STARTED")
                    .build();
        }

        Map<String, Object> status;
        try {
            status = secureIdClient.getStatus(registration.getKycVerificationId());
        } catch (Exception e) {
            // Cashfree enforces IP whitelisting on status/document calls — a
            // non-whitelisted pod egress IP (or any transient failure) must not
            // 5xx the wizard's poll; report the stored status and let it retry.
            log.error("SecureID status check failed for registration {}: {}",
                    registration.getId(), e.getMessage());
            return buildStatusResponse(registration);
        }
        String cashfreeStatus = status != null && status.get("status") != null
                ? status.get("status").toString() : "PENDING";
        switch (cashfreeStatus) {
            case "AUTHENTICATED" -> fetchAndStoreDocuments(registration);
            case "EXPIRED" -> registration.setKycStatus(SubOrgKycStatus.EXPIRED.name());
            case "CONSENT_DENIED" -> registration.setKycStatus(SubOrgKycStatus.CONSENT_DENIED.name());
            default -> { /* PENDING — leave as-is */ }
        }
        registrationRepository.save(registration);
        return buildStatusResponse(registration);
    }

    /**
     * Cashfree SecureID webhook. Signature = base64(HMAC-SHA256(clientSecret, timestamp + rawBody)),
     * constant-time compared; timestamps outside the replay window rejected.
     */
    @Transactional
    public void handleWebhook(String rawBody, String signature, String timestamp) {
        verifyWebhookSignature(rawBody, signature, timestamp);
        try {
            JsonNode root = objectMapper.readTree(rawBody);
            String eventType = root.path("event_type").asText("");
            String verificationId = root.path("data").path("verification_id").asText("");
            if (!StringUtils.hasText(verificationId)) {
                log.warn("SecureID webhook without verification_id. event={}", eventType);
                return;
            }
            SubOrgRegistration registration = registrationRepository
                    .findFirstByKycVerificationId(verificationId).orElse(null);
            if (registration == null) {
                log.info("SecureID webhook for unknown verification_id={} (event={})",
                        verificationId, eventType);
                return;
            }
            switch (eventType) {
                case "DIGILOCKER_VERIFICATION_SUCCESS" -> {
                    fetchAndStoreDocuments(registration);
                    registrationRepository.save(registration);
                }
                case "DIGILOCKER_VERIFICATION_CONSENT_DENIED" ->
                        updateStatusIfNotVerified(registration, SubOrgKycStatus.CONSENT_DENIED);
                case "DIGILOCKER_VERIFICATION_LINK_EXPIRED",
                     "DIGILOCKER_VERIFICATION_CONSENT_EXPIRED" ->
                        updateStatusIfNotVerified(registration, SubOrgKycStatus.EXPIRED);
                case "DIGILOCKER_VERIFICATION_FAILURE" ->
                        updateStatusIfNotVerified(registration, SubOrgKycStatus.FAILED);
                default -> log.info("Ignoring SecureID webhook event {}", eventType);
            }
        } catch (VacademyException e) {
            throw e;
        } catch (Exception e) {
            // Parsing/processing issues must not trigger endless Cashfree retries.
            log.error("Failed to process SecureID webhook: {}", e.getMessage());
        }
    }

    /** True when the template requires KYC and this registration hasn't passed it. */
    public boolean isKycPendingForComplete(SubOrgRegistration registration,
                                           SubOrgRegistrationSettingDTO.RegistrationSetting setting) {
        boolean kycRequired = setting != null && !CollectionUtils.isEmpty(setting.getSteps())
                && setting.getSteps().contains("KYC");
        return kycRequired && !SubOrgKycStatus.VERIFIED.name().equals(registration.getKycStatus());
    }

    /** Fetches the configured documents (idempotent) and marks VERIFIED. */
    private void fetchAndStoreDocuments(SubOrgRegistration registration) {
        if (SubOrgKycStatus.VERIFIED.name().equals(registration.getKycStatus())) {
            return;
        }
        List<String> documents = requireKycDocuments(registration);
        Map<String, Object> collected = new LinkedHashMap<>();
        for (String document : documents) {
            try {
                Map<String, Object> data = secureIdClient.getDocument(
                        registration.getKycVerificationId(), document);
                if (data != null) collected.put(document, data);
            } catch (Exception e) {
                log.error("Failed to fetch {} for registration {}: {}",
                        document, registration.getId(), e.getMessage());
            }
        }
        if (collected.size() < documents.size()) {
            // All-or-nothing: a partial fetch (e.g. one call hit a non-whitelisted
            // egress IP) must not mark VERIFIED with a required document missing.
            // Consent stays valid ~1 hour, so the next poll simply retries.
            throw new VacademyException(
                    "Verification succeeded but documents could not be fetched yet. Please retry.");
        }
        try {
            registration.setKycDocumentsJson(objectMapper.writeValueAsString(collected));
        } catch (Exception e) {
            throw new VacademyException("Could not store verification result");
        }
        registration.setKycStatus(SubOrgKycStatus.VERIFIED.name());
        registration.setKycVerifiedAt(new Timestamp(System.currentTimeMillis()));
        log.info("Registration {} KYC VERIFIED with documents {}",
                registration.getId(), collected.keySet());
    }

    private void updateStatusIfNotVerified(SubOrgRegistration registration, SubOrgKycStatus status) {
        if (SubOrgKycStatus.VERIFIED.name().equals(registration.getKycStatus())) return;
        registration.setKycStatus(status.name());
        registrationRepository.save(registration);
    }

    private void verifyWebhookSignature(String rawBody, String signature, String timestamp) {
        if (!StringUtils.hasText(signature) || !StringUtils.hasText(timestamp)) {
            throw new VacademyException("Missing webhook signature headers");
        }
        try {
            long ts = Long.parseLong(timestamp.trim());
            if (Math.abs(System.currentTimeMillis() - ts) > WEBHOOK_REPLAY_WINDOW_MS) {
                throw new VacademyException("Webhook timestamp outside allowed window");
            }
        } catch (NumberFormatException e) {
            throw new VacademyException("Invalid webhook timestamp");
        }
        String expected = computeWebhookSignature(secureIdClient.getClientSecret(), timestamp, rawBody);
        if (!MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.UTF_8),
                signature.trim().getBytes(StandardCharsets.UTF_8))) {
            throw new VacademyException("Invalid webhook signature");
        }
    }

    /** base64(HMAC-SHA256(secret, timestamp + rawBody)) — Cashfree SecureID scheme. */
    static String computeWebhookSignature(String secret, String timestamp, String rawBody) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal((timestamp + rawBody).getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(hash);
        } catch (Exception e) {
            throw new VacademyException("Could not verify webhook signature");
        }
    }

    private KycStatusResponseDTO buildStatusResponse(SubOrgRegistration registration) {
        return KycStatusResponseDTO.builder()
                .registrationId(registration.getId())
                .kycStatus(StringUtils.hasText(registration.getKycStatus())
                        ? registration.getKycStatus() : "NOT_STARTED")
                .summary(buildSummary(registration))
                .build();
    }

    /** Small display summary for the wizard; full data stays in kyc_documents_json. */
    private Map<String, String> buildSummary(SubOrgRegistration registration) {
        if (!SubOrgKycStatus.VERIFIED.name().equals(registration.getKycStatus())
                || !StringUtils.hasText(registration.getKycDocumentsJson())) {
            return null;
        }
        try {
            Map<String, Map<String, Object>> docs = objectMapper.readValue(
                    registration.getKycDocumentsJson(), new TypeReference<>() {
                    });
            Map<String, String> summary = new HashMap<>();
            Map<String, Object> aadhaar = docs.get("AADHAAR");
            if (aadhaar != null) {
                putIfPresent(summary, "name", aadhaar.get("name"));
                putIfPresent(summary, "dob", aadhaar.get("dob"));
                // Live payload carries the pre-masked number as "uid" (e.g. xxxxxxxx5174);
                // older doc examples used aadhaar_number/masked_aadhaar_number.
                Object maskedAadhaar = aadhaar.get("uid") != null ? aadhaar.get("uid")
                        : aadhaar.get("aadhaar_number") != null ? aadhaar.get("aadhaar_number")
                        : aadhaar.get("masked_aadhaar_number");
                putIfPresent(summary, "masked_aadhaar", maskedAadhaar);
            }
            Map<String, Object> pan = docs.get("PAN");
            if (pan != null) {
                putIfPresent(summary, "pan_number",
                        pan.get("pan_number") != null ? pan.get("pan_number") : pan.get("pan"));
                // Live payload key is "name_pan_card"; keep "name" as a fallback.
                putIfPresent(summary, "pan_name",
                        pan.get("name_pan_card") != null ? pan.get("name_pan_card") : pan.get("name"));
            }
            return summary.isEmpty() ? null : summary;
        } catch (Exception e) {
            log.warn("Could not build KYC summary for registration {}: {}",
                    registration.getId(), e.getMessage());
            return null;
        }
    }

    private void putIfPresent(Map<String, String> target, String key, Object value) {
        if (value != null && StringUtils.hasText(value.toString())) {
            target.put(key, value.toString());
        }
    }

    private List<String> requireKycDocuments(SubOrgRegistration registration) {
        EnrollInvite template = enrollInviteRepository.findById(registration.getTemplateInviteId())
                .orElseThrow(() -> new VacademyException("Registration template no longer exists"));
        if (!StatusEnum.ACTIVE.name().equals(template.getStatus())) {
            throw new VacademyException("This registration link is closed");
        }
        SubOrgRegistrationSettingDTO.RegistrationSetting setting =
                SubOrgRegistrationSettings.parse(template.getSettingJson());
        if (setting == null || CollectionUtils.isEmpty(setting.getKycDocuments())) {
            throw new VacademyException("Identity verification is not required for this registration");
        }
        return setting.getKycDocuments();
    }

    private SubOrgRegistration requireRegistration(String registrationId) {
        if (!StringUtils.hasText(registrationId)) {
            throw new VacademyException("registration_id is required");
        }
        return registrationRepository.findById(registrationId)
                .orElseThrow(() -> new VacademyException("Registration not found: " + registrationId));
    }
}
