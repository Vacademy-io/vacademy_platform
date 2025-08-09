package vacademy.io.admin_core_service.features.common.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDTO;
import vacademy.io.admin_core_service.features.common.dto.InstituteCustomFieldDeleteRequestDTO;
import vacademy.io.admin_core_service.features.common.service.InstituteCustomFiledService;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteCustomFieldSetupDTO;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/common/custom-fields")
public class InstituteCustomFieldController {

    @Autowired
    private InstituteCustomFiledService instituteCustomFiledService;

    @GetMapping
    public ResponseEntity<List<InstituteCustomFieldDTO>> getInstituteCustomFields(
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(
                instituteCustomFiledService.findActiveCustomFieldsWithNullTypeId(instituteId));
    }

    @DeleteMapping
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
}
