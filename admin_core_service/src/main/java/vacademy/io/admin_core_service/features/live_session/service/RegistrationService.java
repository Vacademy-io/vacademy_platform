package vacademy.io.admin_core_service.features.live_session.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.dto.GuestRegistrationRequestDTO;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.live_session.entity.SessionGuestRegistration;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionGuestRegistrationRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class RegistrationService {

    @Autowired
    SessionGuestRegistrationRepository sessionGuestRegistration;
    @Autowired
    CustomFieldValuesRepository customFieldValuesRepository;


    /**
     * Idempotent guest registration keyed by either identity: email (classic) or
     * mobile number (phone-identity institutes). Re-registering with a known
     * identifier returns the existing registration id instead of failing, so a
     * refreshed public page can safely re-submit. When a returning guest supplies
     * an identifier the stored row is missing, it is backfilled (never stolen
     * from another registration) so future lookups by either identity succeed.
     */
    public String registerGuest(String email, String mobileNumber, String sessionId) {
        String normalizedEmail = (email == null || email.trim().isEmpty())
                ? null : email.trim().toLowerCase();
        String normalizedPhone = SessionGuestRegistration.normalizeMobileNumber(mobileNumber);
        if (normalizedEmail == null && normalizedPhone == null) {
            throw new VacademyException("Either an email or a mobile number is required to register");
        }

        Optional<SessionGuestRegistration> existing = normalizedEmail != null
                ? sessionGuestRegistration.findBySessionIdAndEmail(sessionId, normalizedEmail)
                : Optional.empty();
        if (existing.isEmpty() && normalizedPhone != null) {
            existing = sessionGuestRegistration.findBySessionIdAndMobileNumber(sessionId, normalizedPhone);
        }

        if (existing.isPresent()) {
            SessionGuestRegistration registration = existing.get();
            boolean changed = false;
            if (registration.getEmail() == null && normalizedEmail != null
                    && sessionGuestRegistration.findBySessionIdAndEmail(sessionId, normalizedEmail).isEmpty()) {
                registration.setEmail(normalizedEmail);
                changed = true;
            }
            if (registration.getMobileNumber() == null && normalizedPhone != null
                    && sessionGuestRegistration.findBySessionIdAndMobileNumber(sessionId, normalizedPhone).isEmpty()) {
                registration.setMobileNumber(normalizedPhone);
                changed = true;
            }
            if (changed) {
                sessionGuestRegistration.save(registration);
            }
            return registration.getId();
        }

        SessionGuestRegistration registration = SessionGuestRegistration.builder()
                .id(UUID.randomUUID().toString())
                .sessionId(sessionId)
                .email(normalizedEmail)
                .mobileNumber(normalizedPhone)
                .registeredAt(LocalDateTime.now())
                .build();
        sessionGuestRegistration.save(registration);
        return registration.getId();
    }


    @Transactional
    public String saveGuestUserDetails(GuestRegistrationRequestDTO requestDto) {
        String guestUserId = registerGuest(requestDto.getEmail(), requestDto.getMobileNumber(), requestDto.getSessionId());

        Map<String, CustomFieldValues> existingByFieldId = customFieldValuesRepository
                .findBySourceTypeAndSourceId("EXTERNAL_PARTICIPANT", guestUserId).stream()
                .filter(v -> v.getCustomFieldId() != null)
                .collect(Collectors.toMap(CustomFieldValues::getCustomFieldId, v -> v, (a, b) -> a));

        for (GuestRegistrationRequestDTO.CustomFieldValueDTO fieldDto : requestDto.getCustomFields()) {
            CustomFieldValues existing = existingByFieldId.get(fieldDto.getCustomFieldId());
            if (existing != null) {
                existing.setValue(fieldDto.getValue());
                customFieldValuesRepository.save(existing);
                continue;
            }
            CustomFieldValues value = CustomFieldValues.builder()
                    .id(UUID.randomUUID().toString())
                    .customFieldId(fieldDto.getCustomFieldId())
                    .sourceType("EXTERNAL_PARTICIPANT")
                    .sourceId(guestUserId)
                    .type("SESSION")
                    .typeId(null)
                    .value(fieldDto.getValue())
                    .build();

            customFieldValuesRepository.save(value);
        }
        return guestUserId;
    }
}
