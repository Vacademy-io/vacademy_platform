package vacademy.io.admin_core_service.features.packages.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.packages.dto.InventoryStatsDTO;
import vacademy.io.admin_core_service.features.packages.dto.PackageSessionInventoryDTO;
import vacademy.io.admin_core_service.features.packages.service.PackageSessionService;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/admin-core-service/package-session")
@RequiredArgsConstructor
public class PackageSessionInventoryController {

    private final PackageSessionService packageSessionService;

    @PutMapping("/{packageSessionId}/inventory/update-capacity")
    public ResponseEntity<PackageSession> updateCapacity(@PathVariable String packageSessionId,
            @RequestBody PackageSessionInventoryDTO inventoryDTO) {
        return ResponseEntity.ok(packageSessionService.updateInventory(packageSessionId, inventoryDTO.getMaxSeats(), inventoryDTO.getAvailableSlots()));
    }

    @PostMapping("/{packageSessionId}/inventory/reserve")
    public ResponseEntity<String> reserveSlot(@PathVariable String packageSessionId) {
        packageSessionService.reserveSlot(packageSessionId);
        return ResponseEntity.ok("Slot reserved successfully");
    }

    @PostMapping("/{packageSessionId}/inventory/release")
    public ResponseEntity<String> releaseSlot(@PathVariable String packageSessionId) {
        packageSessionService.releaseSlot(packageSessionId);
        return ResponseEntity.ok("Slot released successfully");
    }

    @GetMapping("/{packageSessionId}/inventory/availability")
    public ResponseEntity<Map<String, Object>> getAvailability(@PathVariable String packageSessionId) {
        return ResponseEntity.ok(packageSessionService.getAvailability(packageSessionId));
    }

    @PostMapping("/inventory/batch-availability")
    public ResponseEntity<Map<String, Map<String, Object>>> getBatchAvailability(
            @RequestBody List<String> packageSessionIds) {
        return ResponseEntity.ok(packageSessionService.getBatchAvailability(packageSessionIds));
    }

    @GetMapping("/inventory/stats")
    public ResponseEntity<InventoryStatsDTO> getInventoryStats(@RequestParam String instituteId) {
        return ResponseEntity.ok(packageSessionService.getInventoryStats(instituteId));
    }
}
