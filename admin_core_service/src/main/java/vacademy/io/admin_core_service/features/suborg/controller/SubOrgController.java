package vacademy.io.admin_core_service.features.suborg.controller;

import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute.entity.InstituteSubOrg;
import vacademy.io.admin_core_service.features.suborg.service.SubOrgService;
import vacademy.io.common.institute.dto.InstituteInfoDTO;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/institute/v1/sub-org")
@RequiredArgsConstructor
@Tag(name = "Sub-Organization Controller", description = "Endpoints for managing sub-organizations")
public class SubOrgController {

    private final SubOrgService subOrgService;

    @PostMapping("/create")
    public ResponseEntity<String> createSubOrg(
            @RequestBody InstituteInfoDTO instituteInfoDTO,
            @RequestParam String parentInstituteId) {
        return ResponseEntity.ok(subOrgService.createSubOrg(instituteInfoDTO, parentInstituteId));
    }

    @GetMapping("/get-all")
    public ResponseEntity<List<InstituteSubOrg>> getSubOrgs(
            @RequestParam String parentInstituteId) {
        return ResponseEntity.ok(subOrgService.getSubOrgs(parentInstituteId));
    }
}
