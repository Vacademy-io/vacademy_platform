package vacademy.io.admin_core_service.features.course_catalogue.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.course_catalogue.dtos.CourseCatalogueResponse;
import vacademy.io.admin_core_service.features.course_catalogue.manager.CourseCatalogueManager;
import vacademy.io.admin_core_service.config.cache.ClientCacheable;
import vacademy.io.admin_core_service.config.cache.CacheScope;

@RestController
@RequestMapping("/admin-core-service/public/course-catalogue/v1")
public class PublicCourseCatalogueController {

    @Autowired
    private CourseCatalogueManager catalogueManager;

    @GetMapping("/institute/get/by-tag")
    @ClientCacheable(maxAgeSeconds = 600, scope = CacheScope.PUBLIC)
    public ResponseEntity<CourseCatalogueResponse> getByTag(@RequestParam("instituteId") String instituteId,
                                                           @RequestParam("tagName") String tagName) {
        return catalogueManager.getCatalogueByTagPublic(instituteId, tagName);
    }
}
