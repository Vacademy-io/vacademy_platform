package vacademy.io.admin_core_service.features.packages.controller;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.packages.service.BatchService;
import vacademy.io.admin_core_service.features.packages.dto.PackageDTOWithBatchDetails;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/batch/v1")
public class BatchController {

    private final BatchService batchService;

    public BatchController(BatchService batchService) {
        this.batchService = batchService;
    }

    @GetMapping("batches-by-session")
    public ResponseEntity<List<PackageDTOWithBatchDetails>> getBatchDetails(
            @RequestParam String sessionId,
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {

        List<PackageDTOWithBatchDetails> batchDetails = batchService.getBatchDetails(sessionId,instituteId, user);
        return ResponseEntity.ok(batchDetails);
    }

    @DeleteMapping("/delete-batches")
    public ResponseEntity<String>deleteBatches(@RequestBody String[]packageSessionIds,@RequestAttribute("user") CustomUserDetails userDetails){
        return ResponseEntity.ok(batchService.deletePackageSession(packageSessionIds,userDetails));
    }
}
