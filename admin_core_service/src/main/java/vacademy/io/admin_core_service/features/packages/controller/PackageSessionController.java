package vacademy.io.admin_core_service.features.packages.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.packages.service.PackageSessionService;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/package-session")
@RequiredArgsConstructor
public class PackageSessionController {

    private final PackageSessionService packageSessionService;

    @GetMapping("/{packageSessionId}/children")
    public ResponseEntity<List<PackageSession>> getChildPackageSessions(@PathVariable String packageSessionId) {
        return ResponseEntity.ok(packageSessionService.findChildPackageSessions(packageSessionId));
    }
}

