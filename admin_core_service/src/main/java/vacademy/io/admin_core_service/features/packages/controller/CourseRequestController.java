package vacademy.io.admin_core_service.features.packages.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.packages.dto.LearnerPackageFilterDTO;
import vacademy.io.admin_core_service.features.packages.dto.PackageDetailDTO;
import vacademy.io.admin_core_service.features.packages.service.CourseRequestService;
import vacademy.io.common.auth.config.PageConstants;

@RestController
@RequestMapping("/admin-core-service/v1/package/package-request")
public class CourseRequestController {

    @Autowired
    private  CourseRequestService courseRequestService;

    @PostMapping("/search")
    public ResponseEntity<Page<PackageDetailDTO>> getLearnerPackages(
        @RequestBody LearnerPackageFilterDTO filterDTO,
        @RequestParam("instituteId") String instituteId,
        @RequestParam(defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int page,
        @RequestParam(defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int size
    ) {
        Page<PackageDetailDTO> result = courseRequestService.getcourseCatalogDetail(filterDTO,instituteId, page, size);
        return ResponseEntity.ok(result);
    }

}
