package vacademy.io.admin_core_service.features.user_account.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.user_account.dto.UserAccountLedgerEntryDTO;
import vacademy.io.admin_core_service.features.user_account.dto.UserAccountSummaryDTO;
import vacademy.io.admin_core_service.features.user_account.service.UserAccountLedgerService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/v1/user-account")
@RequiredArgsConstructor
public class UserAccountController {

    private final UserAccountLedgerService ledgerService;

    /**
     * GET /admin-core-service/v1/user-account/{userId}/summary?instituteId=
     * Returns balance, overdue, and totals for a user in an institute.
     */
    @GetMapping("/{userId}/summary")
    public ResponseEntity<UserAccountSummaryDTO> getSummary(
            @PathVariable String userId,
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(ledgerService.getSummary(userId, instituteId));
    }

    /**
     * GET /admin-core-service/v1/user-account/{userId}/ledger?instituteId=&page=0&size=20
     * Returns paginated chronological ledger entries (newest first).
     */
    @GetMapping("/{userId}/ledger")
    public ResponseEntity<Page<UserAccountLedgerEntryDTO>> getLedger(
            @PathVariable String userId,
            @RequestParam String instituteId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        return ResponseEntity.ok(
                ledgerService.getLedger(userId, instituteId, PageRequest.of(page, size)));
    }
}
