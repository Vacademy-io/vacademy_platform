package vacademy.io.admin_core_service.features.slide.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.slide.dto.SlideTypeCountProjection;
import vacademy.io.admin_core_service.features.slide.service.SlideService;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/open/slide/v1")
public class OpenSlideController {

    @Autowired
    private SlideService slideService;

    @GetMapping("/slide-counts-by-source-type")
    public ResponseEntity<List<SlideTypeCountProjection>> getSlideCountsBySourceType(
        @RequestParam String packageSessionId
    ) {
        List<SlideTypeCountProjection> result = slideService.getSlideCountsBySourceType(packageSessionId);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/learner-slide-counts-by-source-type")
    public ResponseEntity<List<SlideTypeCountProjection>> getLearnerSlideCountsBySourceType(
        @RequestParam String packageSessionId
    ) {
        List<SlideTypeCountProjection> result = slideService.getSlideCountsBySourceTypeForLearner(packageSessionId);
        return ResponseEntity.ok(result);
    }
}
