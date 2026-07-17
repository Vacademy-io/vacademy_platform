package vacademy.io.community_service.feature.guide.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.util.SuperAdminAuthUtil;
import vacademy.io.community_service.feature.guide.dto.GuideDto;
import vacademy.io.community_service.feature.guide.dto.UpsertGuideRequest;
import vacademy.io.community_service.feature.guide.service.PortalGuideService;

import java.util.List;

/**
 * Self-service Guides for the super-admin portal: upload an HTML walkthrough + fill in its
 * details, no code change needed. Consumed by the health-check dashboard's Guides dock.
 */
@RestController
@RequestMapping("/community-service/super-admin/v1/guides")
public class PortalGuideController {

    @Autowired
    private PortalGuideService service;

    @GetMapping
    public ResponseEntity<List<GuideDto>> list(@RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(service.listAll());
    }

    @PostMapping
    public ResponseEntity<GuideDto> create(@RequestAttribute("user") CustomUserDetails user,
                                           @RequestBody UpsertGuideRequest request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(service.create(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<GuideDto> update(@RequestAttribute("user") CustomUserDetails user,
                                           @PathVariable String id,
                                           @RequestBody UpsertGuideRequest request) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(service.update(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@RequestAttribute("user") CustomUserDetails user,
                                       @PathVariable String id) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
