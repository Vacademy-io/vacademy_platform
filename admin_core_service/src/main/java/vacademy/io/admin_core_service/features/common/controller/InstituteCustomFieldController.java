package vacademy.io.admin_core_service.features.common.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.common.dto.CustomFieldDTO;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDeleteRequestDTO;
import vacademy.io.admin_core_service.features.common.dto.request.EnrollRequestDto;
import vacademy.io.admin_core_service.features.common.dto.request.InstituteCustomFieldMappingRequest;
import vacademy.io.admin_core_service.features.common.manager.InstituteCustomFieldManager;
import vacademy.io.admin_core_service.features.common.service.InstituteCustomFiledService;
import vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.CustomFieldDto;
import vacademy.io.admin_core_service.features.institute.dto.settings.custom_field.CustomFieldSettingRequest;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteCustomFieldSetupDTO;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/common/custom-fields")
public class InstituteCustomFieldController {

    @Autowired
    private InstituteCustomFiledService instituteCustomFiledService;

    @Autowired
    private InstituteCustomFieldManager instituteCustomFieldManager;

    @GetMapping
    public ResponseEntity<List<InstituteCustomFieldDTO>> getInstituteCustomFields(
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(
                instituteCustomFiledService.findActiveCustomFieldsWithNullTypeId(instituteId));
    }

    @DeleteMapping("/delete-bulk")
    public ResponseEntity<String> softDeleteInstituteCustomField(
            @RequestBody List<InstituteCustomFieldDeleteRequestDTO> request, @RequestParam String instituteId) {
        int updated = instituteCustomFiledService.softDeleteInstituteCustomFieldsBulk(
                request, instituteId);
        return ResponseEntity.ok(updated > 0 ? "success" : "no-op");
    }

    @GetMapping("/setup")
    public ResponseEntity<List<InstituteCustomFieldSetupDTO>> getInstituteCustomFieldsSetup(
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(
                instituteCustomFiledService.findUniqueActiveCustomFieldsByInstituteId(instituteId));
    }

    @PostMapping("/create")
    public ResponseEntity<String> createCustomFieldForInstitute(@RequestParam("user") CustomUserDetails userDetails,
                                                                @RequestParam("instituteId") String instituteId,
                                                                @RequestParam(value = "fieldId", required = false) String fieldId,
                                                                @RequestBody CustomFieldDTO request){
        return instituteCustomFieldManager.createCustomFieldForInstitute(userDetails,request, instituteId, fieldId);
    }

    @PostMapping("/map-custom-field")
    public ResponseEntity<String> mapCustomField(@RequestParam("user") CustomUserDetails userDetails,
                                                 @RequestParam("instituteId") String instituteId,
                                                 @RequestBody InstituteCustomFieldMappingRequest request) {
        return instituteCustomFieldManager.mapCustomFieldWithUsage(userDetails, instituteId, request);
    }

    @DeleteMapping("/delete-multiple-mapping")
    public ResponseEntity<String> deleteMappings(@RequestParam("user") CustomUserDetails userDetails,
                                                 @RequestParam("instituteId") String instituteId,
                                                 @RequestBody List<String> request) {
        return instituteCustomFieldManager.deleteMultipleMapping(userDetails, instituteId, request);
    }

    @DeleteMapping("/delete-Custom-field/multiple")
    public ResponseEntity<String> deleteCustomField(@RequestParam("user") CustomUserDetails userDetails,
                                                    @RequestParam("instituteId") String instituteId,
                                                    @RequestParam("isPersist") String isPersist,
                                                    @RequestParam("commaSeparatedFieldsIds") String commaSeparatedFieldsIds,
                                                    @RequestBody CustomFieldSettingRequest request) {
        return instituteCustomFieldManager.deleteMultipleCustomFields(userDetails, instituteId, request, commaSeparatedFieldsIds, isPersist);
    }

    @GetMapping("/get-custom-fields")
    public ResponseEntity<List<InstituteCustomFieldDTO>> getCustomFieldsForType(@RequestParam("user") CustomUserDetails userDetails,
                                                         @RequestParam("instituteId") String instituteId,
                                                         @RequestParam("type")String type,
                                                         @RequestParam("typeId") String typeId) {
        return instituteCustomFieldManager.getCustomFieldsForType(userDetails, instituteId, type,typeId);
    }

    @PostMapping("/register-enroll-request")
    public ResponseEntity<String> registerEnrollRequestInCustomFields(@RequestParam("user") CustomUserDetails userDetails,
                                                                                             @RequestParam("instituteId") String instituteId,
                                                                                             @RequestBody EnrollRequestDto request) {
        return instituteCustomFieldManager.registerEnrollRequestInCustomFields(userDetails, instituteId, request);
    }

}
