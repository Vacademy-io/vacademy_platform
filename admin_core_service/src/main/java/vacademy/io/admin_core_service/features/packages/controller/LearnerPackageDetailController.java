package vacademy.io.admin_core_service.features.packages.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.packages.dto.PackageDetailDTO;
import vacademy.io.admin_core_service.features.packages.dto.LearnerPackageFilterDTO;
import vacademy.io.admin_core_service.features.packages.service.LearnerPackageService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.admin_core_service.config.cache.ClientCacheable;
import vacademy.io.admin_core_service.config.cache.CacheScope;

@RestController
@RequestMapping("/admin-core-service/learner-packages/v1")
public class LearnerPackageDetailController {

    @Autowired
    private LearnerPackageService learnerPackageService;

    @PostMapping("/search")
    public ResponseEntity<Page<PackageDetailDTO>> getLearnerPackages(
            @RequestBody LearnerPackageFilterDTO filterDTO,
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int page,
            @RequestParam(defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int size
    ) {
        Page<PackageDetailDTO> result = learnerPackageService.getLearnerPackageDetail(filterDTO, user,instituteId, page, size);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/package-detail")
    @ClientCacheable(maxAgeSeconds = 120, scope = CacheScope.PUBLIC)
    public ResponseEntity<PackageDetailDTO> getPackageDetailById(@RequestParam("packageId") String packageId) {
        PackageDetailDTO result = learnerPackageService.getPackageDetailById(packageId);
        return ResponseEntity.ok(result);
    }
}
