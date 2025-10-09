package vacademy.io.admin_core_service.features.common.manager;

import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.common.dto.CustomFieldDTO;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;
import vacademy.io.admin_core_service.features.common.dto.request.EnrollRequestDto;
import vacademy.io.admin_core_service.features.common.dto.request.InstituteCustomFieldMappingRequest;
import vacademy.io.admin_core_service.features.common.entity.CustomFieldValues;
import vacademy.io.admin_core_service.features.common.entity.CustomFields;
import vacademy.io.admin_core_service.features.common.entity.InstituteCustomField;
import vacademy.io.admin_core_service.features.common.service.InstituteCustomFiledService;
import vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.CustomFieldSettingRequest;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.learner_invitation.enums.CustomFieldStatusEnum;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

@Component
public class InstituteCustomFieldManager {

    private final InstituteRepository instituteRepository;
    private final InstituteCustomFiledService instituteCustomFiledService;
    private final InstituteSettingService instituteSettingService;

    public InstituteCustomFieldManager(InstituteRepository instituteRepository,
            InstituteCustomFiledService instituteCustomFiledService, InstituteSettingService instituteSettingService) {
        this.instituteRepository = instituteRepository;
        this.instituteCustomFiledService = instituteCustomFiledService;
        this.instituteSettingService = instituteSettingService;
    }

    public ResponseEntity<String> createGroupOfCustomField(CustomUserDetails userDetails, String instituteId) {
        return ResponseEntity.ok("Done");
    }

    @Transactional
    public ResponseEntity<String> createCustomFieldForInstitute(CustomUserDetails userDetails, CustomFieldDTO request,
            String instituteId, String fieldId) {
        try {
            Optional<Institute> institute = instituteRepository.findById(instituteId);
            if (institute.isEmpty())
                throw new VacademyException("Institute Not Found");
            if (StringUtils.hasText(fieldId)) {
                return ResponseEntity
                        .ok(instituteCustomFiledService.updateCustomField(institute.get(), request, fieldId));
            }

            // Use key-based lookup instead of name-based to prevent duplicates
            String fieldKey = instituteCustomFiledService.generateFieldKey(request.getFieldName());
            Optional<CustomFields> existingField = instituteCustomFiledService
                    .findCustomFieldByKeyAndInstitute(fieldKey, institute.get().getId());
            if (existingField.isPresent()) {
                throw new VacademyException(
                        "Custom Field with key '" + fieldKey + "' already exists for this institute");
            }

            CustomFields savedCustomField = instituteCustomFiledService.createCustomFieldFromRequest(request);
            InstituteCustomField savedMapping = instituteCustomFiledService
                    .createInstituteMappingFromCustomField(savedCustomField, institute.get(), request);
            instituteSettingService.updateCustomFieldSetting(institute.get(), request.getSettingRequest());
            return ResponseEntity.ok(savedMapping.getCustomFieldId());
        } catch (Exception e) {
            throw new VacademyException("Failed To Create: " + e.getMessage());
        }
    }

    private InstituteCustomField createCustomFieldMapping(Institute institute, InstituteCustomFieldDTO request) {
        return InstituteCustomField.builder()
                .customFieldId(request.getFieldId())
                .instituteId(institute.getId())
                .groupInternalOrder(request.getGroupInternalOrder())
                .individualOrder(request.getIndividualOrder())
                .type(request.getType())
                .groupName(request.getGroupName())
                .typeId(request.getTypeId()).build();
    }

    public ResponseEntity<String> mapCustomFieldWithUsage(CustomUserDetails userDetails, String instituteId,
            InstituteCustomFieldMappingRequest request) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if (institute.isEmpty())
            throw new VacademyException("Institute Not Found");

        if (request == null || request.getMappings() == null || request.getMappings().isEmpty())
            throw new VacademyException("Invalid Request");

        List<InstituteCustomField> allMappings = new ArrayList<>();

        request.getMappings().forEach(mapping -> {
            allMappings.add(createCustomFieldMapping(institute.get(), mapping));
        });

        instituteCustomFiledService.createOrUpdateMappings(allMappings);
        return ResponseEntity.ok("Done");
    }

    public ResponseEntity<String> deleteMultipleMapping(CustomUserDetails userDetails, String instituteId,
            List<String> request) {
        Optional<Institute> institute = instituteRepository.findById(instituteId);
        if (institute.isEmpty())
            throw new VacademyException("Institute Not Found");

        List<InstituteCustomField> allMappings = instituteCustomFiledService.getAllMappingFromIds(request);

        allMappings.forEach(mapping -> {
            mapping.setStatus(CustomFieldStatusEnum.DELETED.name());
        });
        instituteCustomFiledService.createOrUpdateMappings(allMappings);
        return ResponseEntity.ok("Done");
    }

    @Transactional
    public ResponseEntity<String> deleteMultipleCustomFields(CustomUserDetails userDetails, String instituteId,
            CustomFieldSettingRequest request, String commaSeparatedFieldsIds, String isPersist) {
        try {
            if (!StringUtils.hasText(isPersist))
                throw new VacademyException("Invalid Request");

            Optional<Institute> institute = instituteRepository.findById(instituteId);
            if (institute.isEmpty())
                throw new VacademyException("Institute Not Found");

            List<String> allFieldIds = Arrays.stream(commaSeparatedFieldsIds.split(",")).toList();
            List<CustomFields> allFields = instituteCustomFiledService.getAllCustomFields(allFieldIds);

            if (isPersist.equalsIgnoreCase("YES")) {
                handleCaseToPersistData(allFields, institute.get());
            } else
                handleCaseToNotPersistData(allFields, institute.get());
            instituteSettingService.updateCustomFieldSetting(institute.get(), request);
            return ResponseEntity.ok("Done");
        } catch (Exception e) {
            throw new VacademyException("Failed To Delete: " + e.getMessage());
        }
    }

    private void handleCaseToNotPersistData(List<CustomFields> allFields, Institute institute) {
        // Update Status of Custom Field to "DELETED"
        allFields.forEach(field -> {
            field.setStatus(CustomFieldStatusEnum.DELETED.name());
        });

        List<InstituteCustomField> allActiveMappingsForFields = instituteCustomFiledService
                .getAllMappingFromFieldsIds(institute.getId(), allFields, List.of("ACTIVE"));

        // Update mapping Status To "DELETED" so that we cannot get the value for
        // particular custom field(Not Persist)
        allActiveMappingsForFields.forEach(mapping -> {
            mapping.setStatus(CustomFieldStatusEnum.DELETED.name());
        });
        instituteCustomFiledService.createOrUpdateMappings(allActiveMappingsForFields);
        instituteCustomFiledService.createOrSaveAllFields(allFields);
    }

    private void handleCaseToPersistData(List<CustomFields> allFields, Institute institute) {
        allFields.forEach(field -> {
            field.setStatus(CustomFieldStatusEnum.DELETED.name());
        });
        instituteCustomFiledService.createOrSaveAllFields(allFields);
    }

    public ResponseEntity<List<InstituteCustomFieldDTO>> getCustomFieldsForType(CustomUserDetails userDetails,
            String instituteId, String type, String typeId) {
        List<InstituteCustomField> allMappings = instituteCustomFiledService.getCusFieldByInstituteAndTypeAndTypeId(
                instituteId, type, typeId, List.of(CustomFieldStatusEnum.ACTIVE.name()));

        List<InstituteCustomFieldDTO> response = createDtoResponse(allMappings);
        return ResponseEntity.ok(response);
    }

    private List<InstituteCustomFieldDTO> createDtoResponse(List<InstituteCustomField> allMappings) {
        if (allMappings == null)
            return new ArrayList<>();
        List<InstituteCustomFieldDTO> response = new ArrayList<>();

        allMappings.forEach(mapping -> {
            response.add(InstituteCustomFieldDTO.builder()
                    .customField(instituteCustomFiledService.getCustomFieldDtoFromId(mapping.getCustomFieldId()))
                    .fieldId(mapping.getCustomFieldId())
                    .id(mapping.getId())
                    .instituteId(mapping.getInstituteId())
                    .groupInternalOrder(mapping.getGroupInternalOrder())
                    .groupName(mapping.getGroupName())
                    .individualOrder(mapping.getIndividualOrder())
                    .status(mapping.getStatus())
                    .type(mapping.getType())
                    .typeId(mapping.getTypeId())
                    .build());
        });

        return response;
    }

    public ResponseEntity<String> registerEnrollRequestInCustomFields(CustomUserDetails userDetails, String instituteId,
            EnrollRequestDto request) {
        try {
            Optional<Institute> institute = instituteRepository.findById(instituteId);
            if (institute.isEmpty())
                throw new VacademyException("Institute Not Found");

            if (request == null)
                throw new VacademyException("Invalid Request");

            List<CustomFieldValues> response = new ArrayList<>();

            request.getValues().forEach(value -> {
                response.add(CustomFieldValues.builder()
                        .customFieldId(value.getCustomFieldId())
                        .sourceType(value.getSourceType())
                        .sourceId(value.getSourceId())
                        .type(value.getType())
                        .typeId(value.getTypeId())
                        .value(value.getValue())
                        .build());
            });

            instituteCustomFiledService.updateOrCreateCustomFieldsValues(response);

            return ResponseEntity.ok("Done");
        } catch (Exception e) {
            throw new VacademyException("Failed To save Values");
        }
    }
}