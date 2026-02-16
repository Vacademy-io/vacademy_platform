package vacademy.io.admin_core_service.features.institute.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute.dto.BatchLookupRequest;
import vacademy.io.admin_core_service.features.institute.dto.BatchLookupResponse;
import vacademy.io.admin_core_service.features.institute.dto.BatchesSummaryResponse;
import vacademy.io.admin_core_service.features.institute.dto.InstituteDashboardResponse;
import vacademy.io.admin_core_service.features.institute.dto.InstituteSetupDTO;
import vacademy.io.admin_core_service.features.institute.dto.PaginatedPackageSessionResponse;
import vacademy.io.admin_core_service.features.institute.manager.InstituteInitManager;
import vacademy.io.admin_core_service.features.institute.service.UserInstituteService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.institute.dto.InstituteIdAndNameDTO;
import vacademy.io.common.institute.dto.InstituteInfoDTO;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/institute/v1")
public class UserInstituteController {

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(UserInstituteController.class);

    @Autowired
    private UserInstituteService instituteService;

    @Autowired
    private InstituteInitManager instituteInitManager;

    @PostMapping("/internal/create")
    public ResponseEntity<InstituteIdAndNameDTO> registerUserInstitutes(@RequestBody InstituteInfoDTO request) {
        // Debug logging for institute fields - to trace production issues
        log.info("[ADMIN-CORE-SERVICE] /internal/create - Received InstituteInfoDTO:");
        log.info("[ADMIN-CORE-SERVICE] board: {}", request != null ? request.getBoard() : "null (request is null)");
        log.info("[ADMIN-CORE-SERVICE] gstDetails: {}",
                request != null ? request.getGstDetails() : "null (request is null)");
        log.info("[ADMIN-CORE-SERVICE] affiliationNumber: {}",
                request != null ? request.getAffiliationNumber() : "null (request is null)");
        log.info("[ADMIN-CORE-SERVICE] staffStrength: {}",
                request != null ? request.getStaffStrength() : "null (request is null)");
        log.info("[ADMIN-CORE-SERVICE] schoolStrength: {}",
                request != null ? request.getSchoolStrength() : "null (request is null)");
        log.info("[ADMIN-CORE-SERVICE] Full InstituteInfoDTO: {}", request);

        InstituteIdAndNameDTO institutes = instituteService.saveInstitute(request);
        return ResponseEntity.ok(institutes);
    }

    @GetMapping("/details/{instituteId}")
    public ResponseEntity<InstituteInfoDTO> getInstituteDetails(@PathVariable String instituteId) {
        InstituteInfoDTO instituteInfoDTO = instituteInitManager.getInstituteDetails(instituteId, true);
        return ResponseEntity.ok(instituteInfoDTO);
    }

    @GetMapping("/details-non-batches/{instituteId}")
    public ResponseEntity<InstituteInfoDTO> getInstituteDetailsNonBatches(@PathVariable String instituteId) {
        InstituteInfoDTO instituteInfoDTO = instituteInitManager.getInstituteDetails(instituteId, false);
        return ResponseEntity.ok(instituteInfoDTO);
    }

    @GetMapping("/setup/{instituteId}")
    public ResponseEntity<InstituteSetupDTO> getInstituteSetupDetails(@PathVariable String instituteId) {
        InstituteSetupDTO instituteSetupDTO = instituteInitManager.getInstituteSetupDetails(instituteId, true);
        return ResponseEntity.ok(instituteSetupDTO);
    }

    @GetMapping("/setup-without-batches/{instituteId}")
    public ResponseEntity<InstituteSetupDTO> getInstituteSetupDetailsWithoutBatches(@PathVariable String instituteId) {
        InstituteSetupDTO instituteSetupDTO = instituteInitManager.getInstituteSetupDetails(instituteId, false);
        return ResponseEntity.ok(instituteSetupDTO);
    }

    @PostMapping("/institute-update")
    public ResponseEntity<String> updateInstitute(@RequestAttribute("user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId,
            @RequestBody InstituteInfoDTO instituteInfoDTO) {
        return instituteService.updateInstituteDetails(user, instituteId, instituteInfoDTO);
    }

    @GetMapping("/get-dashboard")
    @Cacheable(value = "instituteDashboard", key = "#user.id + ':' + #instituteId")
    public ResponseEntity<InstituteDashboardResponse> getInstituteDashboard(
            @RequestAttribute(name = "user") CustomUserDetails user,
            @RequestParam("instituteId") String instituteId) {
        return instituteService.getInstituteDashboardDetail(user, instituteId);
    }

    @PutMapping("/add-letterhead-file-id")
    public ResponseEntity<String> addLetterheadFileId(@RequestParam("instituteId") String instituteId,
            @RequestParam("letterheadFileId") String letterheadFileId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(instituteService.addLetterHeadFileId(instituteId, letterheadFileId, user));
    }

    @GetMapping("/get-letterhead-file-id")
    public ResponseEntity<String> getLetterheadFileId(@RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(instituteService.getLetterFileId(instituteId, user));
    }

    /**
     * Paginated endpoint to fetch package sessions (batches) for an institute.
     * Designed for scalability - fetches data in pages instead of all at once.
     * Supports search, filtering, and sorting.
     *
     * @param instituteId       The institute ID (required)
     * @param page              Page number, 0-indexed (default: 0)
     * @param size              Page size (default: 20, max recommended: 50)
     * @param sessionId         Optional filter by session ID
     * @param levelId           Optional filter by level ID
     * @param packageId         Optional filter by package/course ID
     * @param search            Optional search query (matches package, level,
     *                          session names)
     * @param packageSessionIds Optional filter by specific package session IDs
     * @param sortBy            Sort field: package_name, level_name, session_name,
     *                          created_at
     * @param sortDirection     Sort direction: ASC or DESC
     * @param statuses          Optional list of statuses (default: ACTIVE)
     * @return Paginated response with package sessions and metadata
     */
    @GetMapping("/paginated-batches/{instituteId}")
    public ResponseEntity<PaginatedPackageSessionResponse> getPaginatedBatches(
            @PathVariable String instituteId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String sessionId,
            @RequestParam(required = false) String levelId,
            @RequestParam(required = false) String packageId,
            @RequestParam(required = false) String search,
            @RequestParam(required = false) List<String> packageSessionIds,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) String sortDirection,
            @RequestParam(required = false) List<String> statuses) {

        PaginatedPackageSessionResponse response = instituteInitManager.getPaginatedPackageSessions(
                instituteId, page, size, sessionId, levelId, packageId, search,
                packageSessionIds, sortBy, sortDirection, statuses);
        return ResponseEntity.ok(response);
    }

    /**
     * Batch lookup endpoint to fetch specific batches by their IDs.
     * Used for ID resolution (displaying selected filter badges, showing batch
     * names in tables).
     *
     * @param instituteId The institute ID (required)
     * @param request     Request body containing list of batch IDs to fetch
     * @return Response with matching batches
     */
    @PostMapping("/batches-by-ids/{instituteId}")
    public ResponseEntity<BatchLookupResponse> getBatchesByIds(
            @PathVariable String instituteId,
            @RequestBody BatchLookupRequest request) {

        BatchLookupResponse response = instituteInitManager.getBatchesByIds(
                instituteId, request.getIds());
        return ResponseEntity.ok(response);
    }

    /**
     * Summary/aggregates endpoint for building filter dropdowns efficiently.
     * Returns unique packages, levels, sessions, and aggregate counts.
     *
     * @param instituteId The institute ID (required)
     * @param statuses    Optional list of statuses (default: ACTIVE)
     * @return Summary with filter options
     */
    @GetMapping("/batches-summary/{instituteId}")
    public ResponseEntity<BatchesSummaryResponse> getBatchesSummary(
            @PathVariable String instituteId,
            @RequestParam(required = false) List<String> statuses) {

        BatchesSummaryResponse response = instituteInitManager.getBatchesSummary(instituteId, statuses);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/sub-org")
    public ResponseEntity<String> createSubOrg(
            @RequestBody InstituteInfoDTO instituteInfoDTO,
            @RequestParam String parentInstituteId) {
        return ResponseEntity.ok(instituteService.createSubOrg(instituteInfoDTO, parentInstituteId));
    }

}
