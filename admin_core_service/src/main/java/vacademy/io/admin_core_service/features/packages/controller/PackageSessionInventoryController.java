package vacademy.io.admin_core_service.features.packages.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.packages.dto.PackageSessionInventoryDTO;
import vacademy.io.admin_core_service.features.packages.service.PackageSessionService;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.Map;

@RestController
@RequestMapping("/admin-core-service/package-session/{packageSessionId}/inventory")
@RequiredArgsConstructor
public class PackageSessionInventoryController {

    private final PackageSessionService packageSessionService;

    @PutMapping("/update-capacity")
    public ResponseEntity<PackageSession> updateCapacity(@PathVariable String packageSessionId,
            @RequestBody PackageSessionInventoryDTO inventoryDTO) {
        return ResponseEntity.ok(packageSessionService.updateInventory(packageSessionId, inventoryDTO.getMaxSeats()));
    }

    @PostMapping("/reserve")
    public ResponseEntity<String> reserveSlot(@PathVariable String packageSessionId) {
        packageSessionService.reserveSlot(packageSessionId);
        return ResponseEntity.ok("Slot reserved successfully");
    }

    @PostMapping("/release")
    public ResponseEntity<String> releaseSlot(@PathVariable String packageSessionId) {
        packageSessionService.releaseSlot(packageSessionId);
        return ResponseEntity.ok("Slot released successfully");
    }

    @GetMapping("/availability")
    public ResponseEntity<Map<String, Object>> getAvailability(@PathVariable String packageSessionId) {
        return ResponseEntity.ok(packageSessionService.getAvailability(packageSessionId));
    }
}
