package vacademy.io.admin_core_service.features.migration.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.migration.dto.v2.*;
import vacademy.io.admin_core_service.features.migration.service.MigrationV2Service;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * Controller for V2 Migration APIs
 * 
 * Provides simplified, direct JSON-based migration endpoints:
 * - API 1: Import Users (with custom fields and payment gateway tokens)
 * - API 2: Import Enrollments (with subscriptions and practice memberships)
 */
@RestController
@RequestMapping("/admin-core-service/migration/v2")
@RequiredArgsConstructor
@Slf4j
public class MigrationV2Controller {

    private final MigrationV2Service migrationV2Service;

    /**
     * API 1: Bulk User Import
     * 
     * Creates or finds users, creates student profiles, stores custom fields,
     * and optionally links payment gateway tokens.
     * 
     * @param instituteId The institute ID
     * @param request     The bulk user import request
     * @param user        The authenticated user
     * @return Bulk import response with per-user results
     */
    @PostMapping("/{instituteId}/import-users")
    public ResponseEntity<BulkUserImportResponseDTO> importUsers(
            @PathVariable("instituteId") String instituteId,
            @RequestBody BulkUserImportRequestDTO request,
            @AuthenticationPrincipal CustomUserDetails user) {

        log.info("V2 Migration: Import users request for institute {} with {} users, dryRun={}",
                instituteId,
                request.getUsers() != null ? request.getUsers().size() : 0,
                request.isDryRun());

        BulkUserImportResponseDTO response = migrationV2Service.importUsers(
                instituteId, request, user);

        log.info("V2 Migration: Import users completed. Success: {}, Failed: {}, Skipped: {}",
                response.getSuccessCount(), response.getFailureCount(), response.getSkippedCount());

        return ResponseEntity.ok(response);
    }

    /**
     * API 2: Bulk Enrollment Import
     * 
     * Links users to package sessions, creates UserPlans with payment
     * configuration,
     * handles subscription lifecycle, and manages practice memberships.
     * 
     * IMPORTANT: For practice memberships, process root admin enrollments BEFORE
     * member enrollments to ensure SubOrg and UserPlan exist.
     * 
     * @param instituteId The institute ID
     * @param request     The bulk enrollment import request
     * @param user        The authenticated user
     * @return Bulk import response with per-enrollment results
     */
    @PostMapping("/{instituteId}/import-enrollments")
    public ResponseEntity<BulkEnrollmentImportResponseDTO> importEnrollments(
            @PathVariable("instituteId") String instituteId,
            @RequestBody BulkEnrollmentImportRequestDTO request,
            @AuthenticationPrincipal CustomUserDetails user) {

        log.info("V2 Migration: Import enrollments request for institute {} with {} enrollments, dryRun={}",
                instituteId,
                request.getEnrollments() != null ? request.getEnrollments().size() : 0,
                request.isDryRun());

        BulkEnrollmentImportResponseDTO response = migrationV2Service.importEnrollments(
                instituteId, request, user);

        log.info("V2 Migration: Import enrollments completed. Success: {}, Failed: {}, Skipped: {}",
                response.getSuccessCount(), response.getFailureCount(), response.getSkippedCount());

        return ResponseEntity.ok(response);
    }
}
