package vacademy.io.admin_core_service.features.institute.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute.dto.InstituteSearchProjection;
import vacademy.io.admin_core_service.features.institute.manager.InstituteInitManager;
import vacademy.io.admin_core_service.features.institute.service.InstituteService;
import vacademy.io.admin_core_service.features.institute.service.UserInstituteService;
import vacademy.io.common.institute.dto.InstituteInfoDTO;
import vacademy.io.admin_core_service.config.cache.ClientCacheable;
import vacademy.io.admin_core_service.config.cache.CacheScope;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/public/institute/v1")
public class OpenInstituteController {

    @Autowired
    private UserInstituteService userInstituteService;

    @Autowired
    private InstituteInitManager instituteInitManager;

    @Autowired
    private InstituteService instituteService;


    @GetMapping("/details/{instituteId}")
    @ClientCacheable(maxAgeSeconds = 600, scope = CacheScope.PUBLIC)
    @Cacheable(value = "openInstituteDetails", key = "#instituteId")
    public ResponseEntity<InstituteInfoDTO> getInstituteDetails(@PathVariable String instituteId) {

        InstituteInfoDTO instituteInfoDTO = instituteInitManager.getPublicInstituteDetails(instituteId, true);
        return ResponseEntity.ok(instituteInfoDTO);
    }


    @GetMapping("/details-non-batches/{instituteId}")
    @ClientCacheable(maxAgeSeconds = 600, scope = CacheScope.PUBLIC)
    @Cacheable(value = "openInstituteDetails", key = "#instituteId")
    public ResponseEntity<InstituteInfoDTO> getInstituteDetailsNonBatches(@PathVariable String instituteId) {

        InstituteInfoDTO instituteInfoDTO = instituteInitManager.getPublicInstituteDetails(instituteId, false);
        return ResponseEntity.ok(instituteInfoDTO);
    }

    @GetMapping("/get/subdomain-or-id")
    @ClientCacheable(maxAgeSeconds = 600, scope = CacheScope.PUBLIC)
    @Cacheable(value = "openInstituteIdOrSubdomain", key = "(#instituteId != null ? 'id:' + #instituteId : '') + (#subdomain != null ? 'sub:' + #subdomain : '')")
    public ResponseEntity<String> getSubdomainForInstitute(@RequestParam(value = "instituteId", required = false) String instituteId,
                                                           @RequestParam(value = "subdomain", required = false) String subdomain) {

        return instituteInitManager.getInstituteIdOrSubDomain(instituteId, subdomain);
    }


    @GetMapping("/search")
    public ResponseEntity<List<InstituteSearchProjection>> searchInstitute(String searchName){
        return ResponseEntity.ok(instituteService.searchInstitute(searchName));
    }

}
