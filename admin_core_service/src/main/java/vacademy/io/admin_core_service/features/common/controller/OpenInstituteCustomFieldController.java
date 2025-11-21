package vacademy.io.admin_core_service.features.common.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.common.manager.InstituteCustomFieldManager;
import vacademy.io.admin_core_service.features.common.service.InstituteCustomFiledService;
import vacademy.io.admin_core_service.features.institute_learner.dto.InstituteCustomFieldSetupDTO;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/open/common/custom-fields")
public class OpenInstituteCustomFieldController {

    @Autowired
    private InstituteCustomFiledService instituteCustomFiledService;

    @Autowired
    private InstituteCustomFieldManager instituteCustomFieldManager;

    @GetMapping("/setup")
    public ResponseEntity<List<InstituteCustomFieldSetupDTO>> getInstituteCustomFieldsSetup(
        @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(
            instituteCustomFiledService.findUniqueActiveCustomFieldsByInstituteId(instituteId));
    }
}
