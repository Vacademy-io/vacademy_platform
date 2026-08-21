package vacademy.io.community_service.feature.appregistry.controller;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.util.SuperAdminAuthUtil;
import vacademy.io.community_service.feature.appregistry.service.AppRegistryService;

import java.util.List;

/**
 * App Registration &amp; Store Management registry, consumed by the health-check dashboard's
 * App Registration module.
 *
 * <p>Mirrors exactly the five operations the dashboard's storage adapter expects, so turning on
 * {@code VITE_APP_REGISTRY_REMOTE=true} moves the team off per-browser localStorage and onto
 * shared storage with no other client change.
 */
@RestController
@RequestMapping("/community-service/super-admin/v1/app-registry")
public class AppRegistrySuperAdminController {

    @Autowired
    private AppRegistryService service;

    @GetMapping("/apps")
    public ResponseEntity<List<JsonNode>> list(@RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(service.listAll());
    }

    @GetMapping("/apps/{id}")
    public ResponseEntity<JsonNode> get(@RequestAttribute("user") CustomUserDetails user,
                                        @PathVariable String id) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(service.get(id));
    }

    @PutMapping("/apps/{id}")
    public ResponseEntity<JsonNode> upsert(@RequestAttribute("user") CustomUserDetails user,
                                           @PathVariable String id,
                                           @RequestBody JsonNode record) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(service.upsert(id, record));
    }

    @DeleteMapping("/apps/{id}")
    public ResponseEntity<Void> delete(@RequestAttribute("user") CustomUserDetails user,
                                       @PathVariable String id) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/apps/import")
    public ResponseEntity<List<JsonNode>> importAll(@RequestAttribute("user") CustomUserDetails user,
                                                    @RequestBody List<JsonNode> records) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(service.replaceAll(records));
    }
}
