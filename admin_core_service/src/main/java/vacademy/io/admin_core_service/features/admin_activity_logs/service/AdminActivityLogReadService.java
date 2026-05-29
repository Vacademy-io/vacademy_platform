package vacademy.io.admin_core_service.features.admin_activity_logs.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.criteria.Predicate;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVPrinter;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.admin_activity_logs.dto.AdminActivityLogFilterDTO;
import vacademy.io.admin_core_service.features.admin_activity_logs.dto.AdminActivityLogResponseDTO;
import vacademy.io.admin_core_service.features.admin_activity_logs.entity.AdminActivityLog;
import vacademy.io.admin_core_service.features.admin_activity_logs.repository.AdminActivityLogRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.io.IOException;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Service
public class AdminActivityLogReadService {

    private static final Logger logger = LoggerFactory.getLogger(AdminActivityLogReadService.class);

    @Autowired
    private AdminActivityLogRepository repository;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Paginated, filtered read of audit rows scoped to a single institute.
     * Tenant isolation is non-negotiable: {@code instituteId} comes from the
     * authenticated request, never from the filter body.
     */
    @Transactional(readOnly = true)
    public Page<AdminActivityLogResponseDTO> list(String instituteId,
            AdminActivityLogFilterDTO filter,
            Pageable pageable) {
        if (instituteId == null || instituteId.isBlank()) {
            throw new VacademyException("Missing institute context for audit log read");
        }
        Specification<AdminActivityLog> spec = buildSpec(instituteId, filter);
        return repository.findAll(spec, pageable).map(this::toDto);
    }

    /** Hard cap on rows per export so a single click can't produce a 500 MB file. */
    private static final int MAX_EXPORT_ROWS = 50_000;

    /** Page size for the chunked load — keeps memory bounded for huge windows. */
    private static final int EXPORT_PAGE_SIZE = 1_000;

    /**
     * Build a CSV of audit rows matching the filter, scoped to one institute.
     * Columns are flat-text columns suitable for opening in Excel; the JSON
     * request/before payloads are intentionally omitted — they're available
     * via {@link #findById}.
     */
    @Transactional(readOnly = true)
    public byte[] exportCsv(String instituteId, AdminActivityLogFilterDTO filter) {
        if (instituteId == null || instituteId.isBlank()) {
            throw new VacademyException("Missing institute context for audit log export");
        }
        Specification<AdminActivityLog> spec = buildSpec(instituteId, filter);
        Sort sort = Sort.by(Sort.Direction.DESC, "createdAt");

        StringWriter writer = new StringWriter();
        long written = 0;

        try (CSVPrinter printer = new CSVPrinter(writer, CSVFormat.DEFAULT.builder()
                .setHeader(
                        "When (UTC)",
                        "Actor name",
                        "Actor email",
                        "Activity",
                        "Action",
                        "Resource",
                        "Entity ID",
                        "HTTP method",
                        "Endpoint",
                        "Status",
                        "Latency (ms)",
                        "IP address")
                .build())) {

            int pageIndex = 0;
            outer:
            while (true) {
                Page<AdminActivityLog> page = repository.findAll(
                        spec, PageRequest.of(pageIndex, EXPORT_PAGE_SIZE, sort));
                if (page.isEmpty()) {
                    break;
                }
                for (AdminActivityLog row : page) {
                    printer.printRecord(
                            row.getCreatedAt() != null ? row.getCreatedAt().toInstant().toString() : "",
                            nullToEmpty(row.getActorName()),
                            nullToEmpty(row.getActorEmail()),
                            nullToEmpty(row.getDescription()),
                            nullToEmpty(row.getAction()),
                            nullToEmpty(row.getEntityType()),
                            nullToEmpty(row.getEntityId()),
                            nullToEmpty(row.getHttpMethod()),
                            nullToEmpty(row.getEndpoint()),
                            row.getResponseStatus() != null ? row.getResponseStatus().toString() : "",
                            row.getResponseTimeMs() != null ? row.getResponseTimeMs().toString() : "",
                            nullToEmpty(row.getIpAddress()));
                    written++;
                    if (written >= MAX_EXPORT_ROWS) {
                        logger.warn("Audit CSV export hit hard cap of {} rows for institute={}; "
                                + "result may be truncated", MAX_EXPORT_ROWS, instituteId);
                        break outer;
                    }
                }
                if (!page.hasNext()) {
                    break;
                }
                pageIndex++;
            }
            printer.flush();
        } catch (IOException e) {
            // StringWriter never throws IOException; this is here only to
            // satisfy CSVPrinter's checked signature.
            throw new VacademyException("Failed to build audit CSV: " + e.getMessage());
        }

        return writer.toString().getBytes(StandardCharsets.UTF_8);
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    @Transactional(readOnly = true)
    public AdminActivityLogResponseDTO findById(String instituteId, String id) {
        AdminActivityLog log = repository.findById(id)
                .orElseThrow(() -> new VacademyException("Audit log not found: " + id));
        if (!log.getInstituteId().equals(instituteId)) {
            // Don't leak existence across tenants — same error as "not found".
            throw new VacademyException("Audit log not found: " + id);
        }
        return toDto(log);
    }

    private Specification<AdminActivityLog> buildSpec(String instituteId,
            AdminActivityLogFilterDTO filter) {
        return (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            predicates.add(cb.equal(root.get("instituteId"), instituteId));

            if (filter != null) {
                if (filter.getStartDate() != null) {
                    predicates.add(cb.greaterThanOrEqualTo(root.get("createdAt"), filter.getStartDate()));
                }
                if (filter.getEndDate() != null) {
                    predicates.add(cb.lessThanOrEqualTo(root.get("createdAt"), filter.getEndDate()));
                }
                if (filter.getActorId() != null && !filter.getActorId().isBlank()) {
                    predicates.add(cb.equal(root.get("actorId"), filter.getActorId()));
                }
                if (filter.getEntityType() != null && !filter.getEntityType().isBlank()) {
                    predicates.add(cb.equal(root.get("entityType"), filter.getEntityType()));
                }
                if (filter.getEntityId() != null && !filter.getEntityId().isBlank()) {
                    predicates.add(cb.equal(root.get("entityId"), filter.getEntityId()));
                }
                if (filter.getAction() != null && !filter.getAction().isBlank()) {
                    predicates.add(cb.equal(root.get("action"), filter.getAction()));
                }
            }
            return cb.and(predicates.toArray(new Predicate[0]));
        };
    }

    private AdminActivityLogResponseDTO toDto(AdminActivityLog log) {
        return AdminActivityLogResponseDTO.builder()
                .id(log.getId())
                .instituteId(log.getInstituteId())
                .actorId(log.getActorId())
                .actorName(log.getActorName())
                .actorEmail(log.getActorEmail())
                .entityType(log.getEntityType())
                .entityId(log.getEntityId())
                .action(log.getAction())
                .httpMethod(log.getHttpMethod())
                .endpoint(log.getEndpoint())
                .description(log.getDescription())
                .requestPayload(deserializeJson(log.getRequestPayload(), log.getId(), "request_payload"))
                .beforePayload(deserializeJson(log.getBeforePayload(), log.getId(), "before_payload"))
                .ipAddress(log.getIpAddress())
                .userAgent(log.getUserAgent())
                .responseStatus(log.getResponseStatus())
                .responseTimeMs(log.getResponseTimeMs())
                .createdAt(log.getCreatedAt())
                .build();
    }

    private Object deserializeJson(String json, String rowId, String field) {
        if (json == null) {
            return null;
        }
        try {
            return objectMapper.readValue(json, Object.class);
        } catch (JsonProcessingException e) {
            logger.warn("Failed to deserialize {} for audit row id={}", field, rowId, e);
            return json;
        }
    }
}
