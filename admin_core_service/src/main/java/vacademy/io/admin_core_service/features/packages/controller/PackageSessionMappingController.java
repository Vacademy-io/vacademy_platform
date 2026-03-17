package vacademy.io.admin_core_service.features.packages.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.packages.dto.ParentChildBatchMappingRequestDTO;
import vacademy.io.admin_core_service.features.packages.dto.ParentChildBatchMappingResponseDTO;
import vacademy.io.admin_core_service.features.packages.service.PackageSessionService;

@RestController
@RequestMapping("/admin-core-service/package-session/v1")
@RequiredArgsConstructor
public class PackageSessionMappingController {

    private final PackageSessionService packageSessionService;

    /**
     * Map a parent batch (package_session) to one or more child batches.
     *
     * Request (JSON, snake_case):
     * {
     *   "institute_id": "INSTITUTE_ID",
     *   "parent_package_session_id": "PARENT_ID",
     *   "child_package_session_ids": ["CHILD_1", "CHILD_2"]
     * }
     */
    @PutMapping("/parent-child-mapping")
    public ResponseEntity<ParentChildBatchMappingResponseDTO> mapParentAndChildren(
            @RequestBody ParentChildBatchMappingRequestDTO request) {

        ParentChildBatchMappingResponseDTO response = packageSessionService.mapParentAndChildren(
                request.getInstituteId(),
                request.getParentPackageSessionId(),
                request.getChildPackageSessionIds());

        return ResponseEntity.ok(response);
    }
}

