package vacademy.io.admin_core_service.features.coding_submission.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.coding_submission.dto.CodingSubmissionDto;
import vacademy.io.admin_core_service.features.coding_submission.dto.CodingSubmissionSummaryDto;
import vacademy.io.admin_core_service.features.coding_submission.dto.SubmitCodingRequestDto;
import vacademy.io.admin_core_service.features.coding_submission.service.CodingSubmissionService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/coding/submissions")
public class CodingSubmissionController {

    @Autowired
    private CodingSubmissionService service;

    @PostMapping
    public ResponseEntity<CodingSubmissionDto> submit(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestBody SubmitCodingRequestDto request) {
        return ResponseEntity.ok(service.submit(user, request));
    }

    @GetMapping
    public ResponseEntity<Page<CodingSubmissionSummaryDto>> list(
            @RequestAttribute("user") CustomUserDetails user,
            @RequestParam("slideId") String slideId,
            @RequestParam(value = "learnerId", required = false) String learnerId,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        return ResponseEntity.ok(service.list(user, slideId, learnerId, page, size));
    }

    @GetMapping("/{id}")
    public ResponseEntity<CodingSubmissionDto> get(
            @RequestAttribute("user") CustomUserDetails user,
            @PathVariable("id") String id) {
        return ResponseEntity.ok(service.get(user, id));
    }
}
