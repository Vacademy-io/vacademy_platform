package vacademy.io.community_service.feature.roadmap.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.util.SuperAdminAuthUtil;
import vacademy.io.community_service.feature.roadmap.dto.RoadmapDto;
import vacademy.io.community_service.feature.roadmap.dto.UpdateRoadmapRequest;
import vacademy.io.community_service.feature.roadmap.service.ProductRoadmapService;

/** Super-admin editor for the product roadmap shown to admin-dashboard users. */
@RestController
@RequestMapping("/community-service/super-admin/v1/roadmap")
public class RoadmapSuperAdminController {

    @Autowired
    private ProductRoadmapService service;

    @GetMapping
    public ResponseEntity<RoadmapDto> get(@RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(service.get());
    }

    @PutMapping
    public ResponseEntity<RoadmapDto> update(@RequestAttribute("user") CustomUserDetails user,
                                             @RequestBody UpdateRoadmapRequest request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(service.update(request != null ? request.getHtmlContent() : null));
    }
}
