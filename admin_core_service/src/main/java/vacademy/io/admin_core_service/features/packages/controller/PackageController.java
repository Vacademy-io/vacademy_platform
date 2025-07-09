package vacademy.io.admin_core_service.features.packages.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.packages.dto.LearnerPackageFilterDTO;
import vacademy.io.admin_core_service.features.packages.dto.PackageDetailDTO;
import vacademy.io.admin_core_service.features.packages.dto.PackageFilterDetailsDTO;
import vacademy.io.admin_core_service.features.packages.service.OpenPackageService;
import vacademy.io.admin_core_service.features.packages.service.PackageInitService;
import vacademy.io.admin_core_service.features.packages.service.PackageService;
import vacademy.io.common.auth.config.PageConstants;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/packages/v1")
public class PackageController {

    @Autowired
    private PackageService packageService;

    @Autowired
    private PackageInitService packageInitService;

    @PostMapping("/search")
    public ResponseEntity<Page<PackageDetailDTO>> getLearnerPackages(
        @RequestBody LearnerPackageFilterDTO filterDTO,
        @RequestParam("instituteId") String instituteId,
        @RequestParam(defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int page,
        @RequestParam(defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int size
    ) {
        Page<PackageDetailDTO> result = packageService.getcourseCatalogDetail(filterDTO,instituteId, page, size);
        return ResponseEntity.ok(result);
    }

   @GetMapping("/package-detail")
    public ResponseEntity<PackageDetailDTO> getPackageDetailById(@RequestParam("packageId") String packageId) {
        PackageDetailDTO result = packageService.getPackageDetailById(packageId);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/filter")
    public ResponseEntity<PackageFilterDetailsDTO>packageFilter(@RequestBody List<String>packageSessionIds) {
        PackageFilterDetailsDTO result = packageInitService.getPackageFilterDetails(packageSessionIds);
        return ResponseEntity.ok(result);
    }

}
