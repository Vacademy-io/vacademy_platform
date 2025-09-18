package vacademy.io.admin_core_service.features.slide.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.slide.dto.SlideTypeReadTimeProjection;
import vacademy.io.admin_core_service.features.slide.service.SlideService;
import vacademy.io.admin_core_service.config.cache.ClientCacheable;
import vacademy.io.admin_core_service.config.cache.CacheScope;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/open/slide/v1")
public class OpenSlideController {

    @Autowired
    private SlideService slideService;

    @GetMapping("/slide-counts-by-source-type")
    @ClientCacheable(maxAgeSeconds = 300, scope = CacheScope.PUBLIC)
    public ResponseEntity<List<SlideTypeReadTimeProjection>> getSlideCountsBySourceType(
        @RequestParam String packageSessionId
    ) {
        List<SlideTypeReadTimeProjection> result = slideService.getSlideCountsBySourceTypeForLearner(packageSessionId);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/learner-slide-counts-by-source-type")
    @ClientCacheable(maxAgeSeconds = 300, scope = CacheScope.PUBLIC)
    public ResponseEntity<List<SlideTypeReadTimeProjection>> getLearnerSlideCountsBySourceType(
        @RequestParam String packageSessionId
    ) {
        List<SlideTypeReadTimeProjection> result = slideService.getSlideCountsBySourceTypeForLearner(packageSessionId);
        return ResponseEntity.ok(result);
    }
}
