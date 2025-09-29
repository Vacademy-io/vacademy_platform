package vacademy.io.admin_core_service.features.course_catalogue.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.course_catalogue.dtos.CourseCatalogueRequest;
import vacademy.io.admin_core_service.features.course_catalogue.dtos.CourseCatalogueResponse;
import vacademy.io.admin_core_service.features.course_catalogue.dtos.CreateCatalogueRequest;
import vacademy.io.admin_core_service.features.course_catalogue.manager.CourseCatalogueManager;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("admin-core-service/v1/course-catalogue")
public class CourseCatalogueController {

    @Autowired
    private CourseCatalogueManager catalogueManager;

    @PostMapping("/create")
    public ResponseEntity<List<CourseCatalogueResponse>> createCatalogues(@RequestAttribute("user") CustomUserDetails userDetails,
                                                                          @RequestBody CreateCatalogueRequest request,
                                                                          @RequestParam("instituteId") String instituteId) {
        return catalogueManager.createCataloguesForInstitute(userDetails, request, instituteId);
    }

    @PutMapping("/update")
    public ResponseEntity<CourseCatalogueResponse> updateCatalogue(@RequestAttribute("user") CustomUserDetails userDetails,
                                                                   @RequestParam("catalogueId") String catalogueId,
                                                                   @RequestBody CourseCatalogueRequest request) {
        return catalogueManager.updateCatalogue(userDetails, catalogueId, request);
    }

    @GetMapping("/institute/get-all")
    public ResponseEntity<List<CourseCatalogueResponse>> getAllCatalogues(@RequestAttribute("user") CustomUserDetails userDetails,
                                                                          @RequestParam("instituteId") String instituteId) {
        return catalogueManager.getAllCatalogues(userDetails, instituteId);
    }

    @GetMapping("/institute/source")
    public ResponseEntity<List<CourseCatalogueResponse>> getCataloguesForSource(@RequestAttribute("user") CustomUserDetails userDetails,
                                                                                @RequestParam("instituteId") String instituteId,
                                                                                @RequestParam("source") String source,
                                                                                @RequestParam("sourceId") String sourceId){
        return catalogueManager.getAllCataloguesForSourceAndSourceId(userDetails,instituteId,source,sourceId);
    }

    @GetMapping("/institute/default")
    public ResponseEntity<CourseCatalogueResponse> getDefaultCatalogue(@RequestAttribute("user") CustomUserDetails userDetails,
                                                                             @RequestParam("instituteId") String instituteId) {
        return catalogueManager.getDefaultCatalogueForInstitute(userDetails, instituteId);
    }

    @GetMapping("/institute/get/by-tag")
    public ResponseEntity<CourseCatalogueResponse> getByTag(@RequestAttribute("user") CustomUserDetails userDetails,
                                                            @RequestParam("instituteId") String instituteId,
                                                            @RequestParam("tagName") String tagName) {
        return catalogueManager.getCatalogueByTag(userDetails, instituteId, tagName);
    }


}
