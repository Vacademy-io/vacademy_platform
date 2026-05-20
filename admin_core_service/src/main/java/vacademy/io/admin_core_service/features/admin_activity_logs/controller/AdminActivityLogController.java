package vacademy.io.admin_core_service.features.admin_activity_logs.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.admin_activity_logs.dto.AdminActivityLogFilterDTO;
import vacademy.io.admin_core_service.features.admin_activity_logs.dto.AdminActivityLogResponseDTO;
import vacademy.io.admin_core_service.features.admin_activity_logs.service.AdminActivityLogReadService;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

@RestController
@RequestMapping("/admin-core-service/audit/v1")
public class AdminActivityLogController {

    @Autowired
    private AdminActivityLogReadService readService;

    @GetMapping("/logs")
    public ResponseEntity<Page<AdminActivityLogResponseDTO>> list(
            HttpServletRequest request,
            @RequestParam(required = false) Long startDate,
            @RequestParam(required = false) Long endDate,
            @RequestParam(required = false) String actorId,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String entityId,
            @RequestParam(required = false) String action,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        String instituteId = requireInstituteId(request);

        AdminActivityLogFilterDTO filter = AdminActivityLogFilterDTO.builder()
                .startDate(startDate != null ? new Timestamp(startDate) : null)
                .endDate(endDate != null ? new Timestamp(endDate) : null)
                .actorId(actorId)
                .entityType(entityType)
                .entityId(entityId)
                .action(action)
                .build();

        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt"));
        return ResponseEntity.ok(readService.list(instituteId, filter, pageable));
    }

    @GetMapping("/logs/{id}")
    public ResponseEntity<AdminActivityLogResponseDTO> getById(
            HttpServletRequest request,
            @PathVariable String id) {
        String instituteId = requireInstituteId(request);
        return ResponseEntity.ok(readService.findById(instituteId, id));
    }

    /**
     * Stream a CSV export of the rows matching the same filter set used by
     * the list endpoint. Honors the active date range, resource, activity,
     * and actor filters. Capped server-side at 50,000 rows.
     */
    @GetMapping(value = "/logs/export.csv", produces = "text/csv")
    public ResponseEntity<byte[]> exportCsv(
            HttpServletRequest request,
            @RequestParam(required = false) Long startDate,
            @RequestParam(required = false) Long endDate,
            @RequestParam(required = false) String actorId,
            @RequestParam(required = false) String entityType,
            @RequestParam(required = false) String entityId,
            @RequestParam(required = false) String action) {

        String instituteId = requireInstituteId(request);

        AdminActivityLogFilterDTO filter = AdminActivityLogFilterDTO.builder()
                .startDate(startDate != null ? new Timestamp(startDate) : null)
                .endDate(endDate != null ? new Timestamp(endDate) : null)
                .actorId(actorId)
                .entityType(entityType)
                .entityId(entityId)
                .action(action)
                .build();

        byte[] csv = readService.exportCsv(instituteId, filter);

        String filename = "admin-activity-logs-"
                + LocalDate.now().format(DateTimeFormatter.ISO_LOCAL_DATE) + ".csv";

        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("text/csv"))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + filename + "\"")
                .body(csv);
    }

    private String requireInstituteId(HttpServletRequest request) {
        String instituteId = request.getHeader("clientId");
        if (instituteId == null || instituteId.isBlank()) {
            throw new VacademyException("Missing clientId header");
        }
        return instituteId;
    }
}
