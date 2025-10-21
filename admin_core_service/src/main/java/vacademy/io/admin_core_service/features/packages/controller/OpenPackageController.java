package vacademy.io.admin_core_service.features.packages.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.packages.dto.PackageDetailDTO;
import vacademy.io.admin_core_service.features.packages.dto.LearnerPackageFilterDTO;
import vacademy.io.admin_core_service.features.packages.dto.PackageDetailV2DTO;
import vacademy.io.admin_core_service.features.packages.service.OpenPackageService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.admin_core_service.config.cache.ClientCacheable;
import vacademy.io.admin_core_service.config.cache.CacheScope;

@RestController
@RequestMapping("/admin-core-service/open/packages")
public class OpenPackageController {

    @Autowired
    private OpenPackageService openPackageService;

    @PostMapping("/v1/search")
    public ResponseEntity<Page<PackageDetailDTO>> getLearnerPackages(
            @RequestBody LearnerPackageFilterDTO filterDTO,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int page,
            @RequestParam(defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int size
    ) {
        Page<PackageDetailDTO> result = openPackageService.getLearnerPackageDetail(filterDTO,instituteId, page, size);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/v1/package-detail")
    @ClientCacheable(maxAgeSeconds = 300, scope = CacheScope.PUBLIC)
    public ResponseEntity<PackageDetailDTO> getPackageDetailById(@RequestParam("packageId") String packageId) {
        PackageDetailDTO result = openPackageService.getPackageDetailById(packageId);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/v2/search")
    public ResponseEntity<Page<PackageDetailV2DTO>> getLearnerPackagesV2(
            @RequestBody LearnerPackageFilterDTO filterDTO,
            @RequestParam("instituteId") String instituteId,
            @RequestParam(defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int page,
            @RequestParam(defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int size
    ) {
        Page<PackageDetailV2DTO> result = openPackageService.getLearnerPackageDetailV2(filterDTO, instituteId, page, size);
        return ResponseEntity.ok(result);
    }


}
