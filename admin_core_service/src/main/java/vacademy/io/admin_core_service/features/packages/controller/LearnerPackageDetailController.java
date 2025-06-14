package vacademy.io.admin_core_service.features.packages.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.packages.dto.LearnerPackageDetailProjection;
import vacademy.io.admin_core_service.features.packages.dto.LearnerPackageFilterDTO;
import vacademy.io.admin_core_service.features.packages.service.LearnerPackageService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/learner-packages/v1")
public class LearnerPackageDetailController {

    @Autowired
    private LearnerPackageService learnerPackageService;

    @PostMapping("/search")
    public ResponseEntity<Page<LearnerPackageDetailProjection>> getLearnerPackages(
            @RequestBody LearnerPackageFilterDTO filterDTO,
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size
    ) {
        Page<LearnerPackageDetailProjection> result = learnerPackageService.getLearnerPackageDetail(filterDTO, user, page, size);
        return ResponseEntity.ok(result);
    }
}
