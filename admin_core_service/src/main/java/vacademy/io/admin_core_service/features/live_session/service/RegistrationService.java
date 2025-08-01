package vacademy.io.admin_core_service.features.live_session.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.dto.GuestRegistrationRequestDTO;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.live_session.entity.SessionGuestRegistration;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldValuesRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionGuestRegistrationRepository;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
public class RegistrationService {

    @Autowired
    SessionGuestRegistrationRepository sessionGuestRegistration;
    @Autowired
    CustomFieldValuesRepository customFieldValuesRepository;


    public String registerGuest(String email, String sessionId) {
        // Prevent duplicate
        boolean alreadyRegistered = sessionGuestRegistration.existsBySessionIdAndEmail(sessionId, email);
        if (alreadyRegistered) {
            throw new IllegalArgumentException("Guest already registered for this session");
        }

        SessionGuestRegistration registration = SessionGuestRegistration.builder()
                .id(UUID.randomUUID().toString())
                .sessionId(sessionId)
                .email(email)
                .registeredAt(LocalDateTime.now())
                .build();

        sessionGuestRegistration.save(registration);
        return registration.getId();
    }


    @Transactional
    public String saveGuestUserDetails(GuestRegistrationRequestDTO requestDto) {
        String guestUserId = registerGuest(requestDto.getEmail() , requestDto.getSessionId());

        for (GuestRegistrationRequestDTO.CustomFieldValueDTO fieldDto : requestDto.getCustomFields()) {
            CustomFieldValues value = CustomFieldValues.builder()
                    .id(UUID.randomUUID().toString())
                    .customFieldId(fieldDto.getCustomFieldId())
                    .sourceType("EXTERNAL_PARTICIPANT")  // or any logic you want
                    .sourceId(guestUserId) // passed as parameter or obtained elsewhere
                    .type("SESSION")      // optional
                    .typeId(null)         // or requestDto.getSessionId() if int, else convert
                    .value(fieldDto.getValue())
                    .build();

            customFieldValuesRepository.save(value);
        }
        return guestUserId;
    }
}
