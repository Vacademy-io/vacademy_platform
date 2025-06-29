package vacademy.io.admin_core_service.features.common.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.common.dto.RatingDTO;
import vacademy.io.admin_core_service.features.common.dto.RatingDetailDTO;
import vacademy.io.admin_core_service.features.common.dto.RatingFilterDTO;
import vacademy.io.admin_core_service.features.common.dto.RatingSummaryProjection;
import vacademy.io.admin_core_service.features.common.service.RatingService;
import vacademy.io.common.auth.config.PageConstants;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/open/rating")
public class OperRatingController {
    @Autowired
    private RatingService ratingService;


    @PostMapping("/get-package-ratings")
    public ResponseEntity<Page<RatingDetailDTO>> getPackageRatings(@RequestBody RatingFilterDTO ratingFilterDTO,
                                                                   @RequestParam(defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
                                                                   @RequestParam(defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize) {
        return ResponseEntity.ok(ratingService.getRatingsForPackage(ratingFilterDTO,pageNo,pageSize));
    }

    @PostMapping("/get-source-ratings")
    public ResponseEntity<Page<RatingDetailDTO>> getSourceRatings(@RequestBody RatingFilterDTO ratingFilterDTO,
                                                                  @RequestParam(defaultValue = PageConstants.DEFAULT_PAGE_NUMBER) int pageNo,
                                                                  @RequestParam(defaultValue = PageConstants.DEFAULT_PAGE_SIZE) int pageSize) {
        return ResponseEntity.ok(ratingService.getRatingsForSource(ratingFilterDTO,pageNo,pageSize, null));
    }

    @GetMapping("/summary")
    public ResponseEntity<RatingSummaryProjection> getSourceRatingsSummary(String sourceType,
                                                                           String sourceId) {
        return ResponseEntity.ok(ratingService.getRatingSummaryProjectionForSource(sourceType, sourceId));
    }

    @GetMapping("/package-summary")
    public ResponseEntity<RatingSummaryProjection> getPackageRatingsSummary(String sourceType,
                                                                            String sourceId) {
        return ResponseEntity.ok(ratingService.getRatingSummaryProjectionForPackage(sourceType, sourceId));
    }
}
