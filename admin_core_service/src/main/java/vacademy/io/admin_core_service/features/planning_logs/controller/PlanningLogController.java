package vacademy.io.admin_core_service.features.planning_logs.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.planning_logs.dto.PlanningLogBatchRequestDTO;
import vacademy.io.admin_core_service.features.planning_logs.dto.PlanningLogBatchResponseDTO;
import vacademy.io.admin_core_service.features.planning_logs.dto.PlanningLogFilterRequestDTO;
import vacademy.io.admin_core_service.features.planning_logs.dto.PlanningLogResponseDTO;
import vacademy.io.admin_core_service.features.planning_logs.dto.PlanningLogUpdateDTO;
import vacademy.io.admin_core_service.features.planning_logs.service.PlanningLogService;
import vacademy.io.common.auth.model.CustomUserDetails;

@Slf4j
@RestController
@RequestMapping("/admin-core-service/planning-logs/v1")
@RequiredArgsConstructor
public class PlanningLogController {

        private final PlanningLogService planningLogService;

        @PostMapping("/create")
        @CacheEvict(value = "planningLogsList", allEntries = true)
        public ResponseEntity<PlanningLogBatchResponseDTO> createPlanningLogs(
                        @Valid @RequestBody PlanningLogBatchRequestDTO request,
                        @RequestParam String instituteId,
                        @RequestAttribute("user") CustomUserDetails user) {

                log.info("POST /admin-core-service/planning-logs/v1/create - User: {}, Institute: {}, Count: {}",
                                user.getUserId(), instituteId, request.getLogs().size());

                PlanningLogBatchResponseDTO response = planningLogService.createPlanningLogsBatch(request, instituteId,
                                user);

                return ResponseEntity.status(HttpStatus.CREATED).body(response);
        }

        @PostMapping("/list")
        public ResponseEntity<Page<PlanningLogResponseDTO>> getPlanningLogs(
                        @Valid @RequestBody PlanningLogFilterRequestDTO request,
                        @RequestParam String instituteId,
                        @RequestParam(value = "pageNo", defaultValue = "0", required = false) int pageNo,
                        @RequestParam(value = "pageSize", defaultValue = "20", required = false) int pageSize,
                        @RequestAttribute("user") CustomUserDetails user) {

                log.info("POST /admin-core-service/planning-logs/v1/list - User: {}, Institute: {}, Page: {}, Size: {}",
                                user.getUserId(), instituteId, pageNo, pageSize);

                Page<PlanningLogResponseDTO> response = planningLogService.getPlanningLogs(request, instituteId, pageNo,
                                pageSize, user);

                return ResponseEntity.ok(response);
        }

        @PatchMapping("/{logId}")
        @CacheEvict(value = "planningLogsList", allEntries = true)
        public ResponseEntity<PlanningLogResponseDTO> updatePlanningLog(
                        @PathVariable String logId,
                        @Valid @RequestBody PlanningLogUpdateDTO request,
                        @RequestParam String instituteId,
                        @RequestAttribute("user") CustomUserDetails user) {

                log.info("PATCH /admin-core-service/planning-logs/v1/{} - User: {}, Institute: {}",
                                logId, user.getUserId(), instituteId);

                PlanningLogResponseDTO response = planningLogService.updatePlanningLog(logId, request, instituteId,
                                user);

                return ResponseEntity.ok(response);
        }

        @GetMapping("/generate-interval-type-id")
        public ResponseEntity<String> generateIntervalTypeId(
                        @RequestParam String intervalType,
                        @RequestParam String dateYYYYMMDD) {

                log.info("GET /admin-core-service/planning-logs/v1/generate-interval-type-id - IntervalType: {}, DateString: {}",
                                intervalType, dateYYYYMMDD);

                String intervalTypeId = planningLogService.generateIntervalTypeId(intervalType, dateYYYYMMDD);

                return ResponseEntity.ok(intervalTypeId);
        }
}
