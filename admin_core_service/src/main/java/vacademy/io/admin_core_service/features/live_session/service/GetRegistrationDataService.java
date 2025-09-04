package vacademy.io.admin_core_service.features.live_session.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.dto.RegistrationFromResponseDTO;
import vacademy.io.admin_core_service.features.live_session.entity.SessionGuestRegistration;
import vacademy.io.admin_core_service.features.common.repository.CustomFieldRepository;
import vacademy.io.admin_core_service.features.live_session.repository.SessionGuestRegistrationRepository;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GetRegistrationDataService {

        private final CustomFieldRepository customFieldRepository;
        private final SessionGuestRegistrationRepository sessionGuestRegistrationRepository;

        public RegistrationFromResponseDTO getRegistrationData(String sessionId) {
                List<CustomFieldRepository.FlatFieldProjection> flatList = customFieldRepository
                                .getSessionCustomFieldsBySessionId(sessionId);

                if (flatList.isEmpty())
                        return null;

                CustomFieldRepository.FlatFieldProjection first = flatList.get(0);

                List<RegistrationFromResponseDTO.CustomFieldDTO> customFields = flatList.stream()
                                .filter(f -> f.getCustomFieldId() != null)
                                .map(f -> new RegistrationFromResponseDTO.CustomFieldDTO(
                                                f.getCustomFieldId(),
                                                f.getFieldKey(),
                                                f.getFieldName(),
                                                f.getFieldType(),
                                                f.getDefaultValue(),
                                                f.getConfig(),
                                                f.getFormOrder(),
                                                f.getIsMandatory(),
                                                f.getIsFilter(),
                                                f.getIsSortable(),
                                                f.getIsHidden()))
                                .collect(Collectors.toList());

                return new RegistrationFromResponseDTO(
                                first.getSessionId(),
                                first.getSessionTitle(),
                                first.getStartTime(),
                                first.getLastEntryTime(),
                                first.getAccessLevel(),
                                first.getInstituteId(),
                                first.getSubject(),
                                first.getCoverFileId(),
                                customFields);
        }

        public Optional<String> checkEmailRegistration(String email, String sessionId) {
                return sessionGuestRegistrationRepository
                                .findBySessionIdAndEmail(sessionId, email)
                                .map(SessionGuestRegistration::getId);
        }

}
