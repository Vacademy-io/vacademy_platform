package vacademy.io.admin_core_service.features.live_session.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.dto.RegistrationFromResponseDTO;
import vacademy.io.admin_core_service.features.live_session.repository.CustomFieldRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class GetRegistrationDataService {

    private final CustomFieldRepository customFieldRepository;

    public RegistrationFromResponseDTO getRegistrationData(String sessionId, CustomUserDetails user) {
        List<CustomFieldRepository.FlatFieldProjection> flatList =
                customFieldRepository.getSessionCustomFieldsBySessionId(sessionId);

        if (flatList.isEmpty()) return null;

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
                        f.getIsSortable()
                ))
                .collect(Collectors.toList());

        return new RegistrationFromResponseDTO(
                first.getSessionId(),
                first.getSessionTitle(),
                first.getStartTime(),
                first.getLastEntryTime(),
                first.getAccessLevel(),
                first.getInstituteId(),
                customFields
        );
    }
}
