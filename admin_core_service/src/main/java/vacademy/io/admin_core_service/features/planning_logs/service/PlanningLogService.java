package vacademy.io.admin_core_service.features.planning_logs.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.planning_logs.dto.PlanningLogBatchRequestDTO;
import vacademy.io.admin_core_service.features.planning_logs.dto.PlanningLogBatchResponseDTO;
import vacademy.io.admin_core_service.features.planning_logs.dto.PlanningLogFilterRequestDTO;
import vacademy.io.admin_core_service.features.planning_logs.dto.PlanningLogRequestDTO;
import vacademy.io.admin_core_service.features.planning_logs.dto.PlanningLogResponseDTO;
import vacademy.io.admin_core_service.features.planning_logs.dto.PlanningLogUpdateDTO;
import vacademy.io.admin_core_service.features.planning_logs.entity.TeacherPlanningLog;
import vacademy.io.admin_core_service.features.planning_logs.repository.TeacherPlanningLogRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class PlanningLogService {

        private final TeacherPlanningLogRepository planningLogRepository;

        private static final String STATUS_ACTIVE = "ACTIVE";
        private static final String LOG_TYPE_PLANNING = "planning";
        private static final String LOG_TYPE_DIARY_LOG = "diary_log";

        // Interval type constants
        private static final String INTERVAL_DAILY = "daily";
        private static final String INTERVAL_WEEKLY = "weekly";
        private static final String INTERVAL_MONTHLY = "monthly";
        private static final String INTERVAL_YEARLY_MONTH = "yearly_month";
        private static final String INTERVAL_YEARLY_QUARTER = "yearly_quarter";

        // Regex patterns for interval type ID validation
        private static final Pattern DAILY_PATTERN = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$"); // YYYY-MM-DD
        private static final Pattern WEEKLY_PATTERN = Pattern.compile("^\\d{4}_D0[1-7]$"); // YYYY_D0X (day of week,
                                                                                           // 1-7)
        private static final Pattern MONTHLY_PATTERN = Pattern.compile("^\\d{4}_\\d{2}_W0[1-5]$"); // YYYY_MM_W0X (week
                                                                                                   // of month)
        private static final Pattern YEARLY_MONTH_PATTERN = Pattern.compile("^\\d{4}_M(0[1-9]|1[0-2])$"); // YYYY_MXX
                                                                                                          // (month)
        private static final Pattern QUARTERLY_PATTERN = Pattern.compile("^\\d{4}_Q0[1-4]$"); // YYYY_Q0X (quarter)

        @Transactional
        public PlanningLogResponseDTO createPlanningLog(PlanningLogRequestDTO request, String instituteId,
                        CustomUserDetails user) {
                log.info("Creating planning log for user: {}, institute: {}, logType: {}",
                                user.getUserId(), instituteId, request.getLogType());

                // Validate enum fields
                validateLogType(request.getLogType());
                validateIntervalType(request.getIntervalType());
                validateIntervalTypeId(request.getIntervalType(), request.getIntervalTypeId());

                // Create entity
                TeacherPlanningLog planningLog = TeacherPlanningLog.builder()
                                .id(UUID.randomUUID().toString())
                                .createdByUserId(user.getUserId())
                                .logType(request.getLogType())
                                .entity(request.getEntity())
                                .entityId(request.getEntityId())
                                .intervalType(request.getIntervalType())
                                .intervalTypeId(request.getIntervalTypeId())
                                .title(request.getTitle())
                                .description(request.getDescription())
                                .content(request.getContentHtml())
                                .subjectId(request.getSubjectId())
                                .commaSeparatedFileIds(request.getCommaSeparatedFileIds())
                                .status(STATUS_ACTIVE)
                                .instituteId(instituteId)
                                .build();

                // Save to database
                TeacherPlanningLog savedLog = planningLogRepository.save(planningLog);

                log.info("Successfully created planning log with ID: {}", savedLog.getId());

                // Convert to response DTO
                return mapToResponseDTO(savedLog);
        }

        private void validateLogType(String logType) {
                if (!LOG_TYPE_PLANNING.equals(logType) && !LOG_TYPE_DIARY_LOG.equals(logType)) {
                        throw new IllegalArgumentException(
                                        String.format("Invalid log_type: %s. Must be 'planning' or 'diary_log'",
                                                        logType));
                }
        }

        private void validateIntervalType(String intervalType) {
                if (!INTERVAL_DAILY.equals(intervalType) &&
                                !INTERVAL_WEEKLY.equals(intervalType) &&
                                !INTERVAL_MONTHLY.equals(intervalType) &&
                                !INTERVAL_YEARLY_MONTH.equals(intervalType) &&
                                !INTERVAL_YEARLY_QUARTER.equals(intervalType)) {
                        throw new IllegalArgumentException(
                                        String.format("Invalid interval_type: %s. Must be one of: daily, weekly, monthly, yearly_month, yearly_quarter",
                                                        intervalType));
                }
        }

        private void validateIntervalTypeId(String intervalType, String intervalTypeId) {
                switch (intervalType) {
                        case INTERVAL_DAILY:
                                if (!DAILY_PATTERN.matcher(intervalTypeId).matches()) {
                                        throw new IllegalArgumentException(
                                                        String.format("Invalid interval_type_id for daily: %s. Expected format: YYYY-MM-DD",
                                                                        intervalTypeId));
                                }
                                // Additional validation: check if it's a valid date
                                try {
                                        LocalDate.parse(intervalTypeId, DateTimeFormatter.ISO_LOCAL_DATE);
                                } catch (DateTimeParseException e) {
                                        throw new IllegalArgumentException(
                                                        String.format("Invalid date format for interval_type_id: %s",
                                                                        intervalTypeId));
                                }
                                break;

                        case INTERVAL_WEEKLY:
                                if (!WEEKLY_PATTERN.matcher(intervalTypeId).matches()) {
                                        throw new IllegalArgumentException(
                                                        String.format("Invalid interval_type_id for weekly: %s. Expected format: YYYY_D0X (e.g., 2025_D02 for Tuesday)",
                                                                        intervalTypeId));
                                }
                                break;

                        case INTERVAL_MONTHLY:
                                if (!MONTHLY_PATTERN.matcher(intervalTypeId).matches()) {
                                        throw new IllegalArgumentException(
                                                        String.format("Invalid interval_type_id for monthly: %s. Expected format: YYYY_MM_W0X (e.g., 2025_03_W03 for 3rd week of March)",
                                                                        intervalTypeId));
                                }
                                break;

                        case INTERVAL_YEARLY_MONTH:
                                if (!YEARLY_MONTH_PATTERN.matcher(intervalTypeId).matches()) {
                                        throw new IllegalArgumentException(
                                                        String.format("Invalid interval_type_id for yearly_month: %s. Expected format: YYYY_MXX (e.g., 2025_M07 for July)",
                                                                        intervalTypeId));
                                }
                                break;

                        case INTERVAL_YEARLY_QUARTER:
                                if (!QUARTERLY_PATTERN.matcher(intervalTypeId).matches()) {
                                        throw new IllegalArgumentException(
                                                        String.format("Invalid interval_type_id for yearly_quarter: %s. Expected format: YYYY_Q0X (e.g., 2024_Q03 for 3rd quarter)",
                                                                        intervalTypeId));
                                }
                                break;

                        default:
                                throw new IllegalArgumentException("Invalid interval_type: " + intervalType);
                }
        }

        private PlanningLogResponseDTO mapToResponseDTO(TeacherPlanningLog entity) {
                return PlanningLogResponseDTO.builder()
                                .id(entity.getId())
                                .createdByUserId(entity.getCreatedByUserId())
                                .logType(entity.getLogType())
                                .entity(entity.getEntity())
                                .entityId(entity.getEntityId())
                                .intervalType(entity.getIntervalType())
                                .intervalTypeId(entity.getIntervalTypeId())
                                .title(entity.getTitle())
                                .description(entity.getDescription())
                                .contentHtml(entity.getContent())
                                .subjectId(entity.getSubjectId())
                                .commaSeparatedFileIds(entity.getCommaSeparatedFileIds())
                                .status(entity.getStatus())
                                .instituteId(entity.getInstituteId())
                                .createdAt(entity.getCreatedAt())
                                .updatedAt(entity.getUpdatedAt())
                                .build();
        }

        @Transactional
        @CacheEvict(value = "planningLogsList", allEntries = true)
        public PlanningLogBatchResponseDTO createPlanningLogsBatch(PlanningLogBatchRequestDTO request,
                        String instituteId, CustomUserDetails user) {
                log.info("Creating batch of {} planning logs for user: {}, institute: {}",
                                request.getLogs().size(), user.getUserId(), instituteId);

                List<PlanningLogResponseDTO> createdLogs = new ArrayList<>();

                for (PlanningLogRequestDTO logRequest : request.getLogs()) {
                        PlanningLogResponseDTO createdLog = createPlanningLog(logRequest, instituteId, user);
                        createdLogs.add(createdLog);
                }

                log.info("Successfully created {} planning logs", createdLogs.size());

                return PlanningLogBatchResponseDTO.builder()
                                .logs(createdLogs)
                                .totalCreated(createdLogs.size())
                                .message(String.format("Successfully created %d planning log(s)", createdLogs.size()))
                                .build();
        }

        /**
         * Helper method to check if a filter list is empty or contains only empty/blank
         * strings
         */
        private boolean isFilterEmpty(List<String> filterList) {
                return filterList == null || filterList.isEmpty()
                                || filterList.stream().allMatch(s -> s == null || s.trim().isEmpty());
        }

        @Cacheable(value = "planningLogsList", key = "#instituteId + '-' + #pageNo + '-' + #pageSize + '-' + #filter.hashCode()")
        public Page<PlanningLogResponseDTO> getPlanningLogs(PlanningLogFilterRequestDTO filter, String instituteId,
                        int pageNo, int pageSize, CustomUserDetails user) {
                log.info("Fetching planning logs for institute: {}, user: {}, page: {}, size: {}",
                                instituteId, user.getUserId(), pageNo, pageSize);

                // Fetch all logs for the institute (including deleted)
                List<TeacherPlanningLog> allLogs = planningLogRepository
                                .findByInstituteIdOrderByCreatedAtDesc(instituteId);

                // Apply filters (ignore empty strings in arrays)
                List<TeacherPlanningLog> filteredLogs = allLogs.stream()
                                .filter(log -> isFilterEmpty(filter.getIntervalTypes())
                                                || filter.getIntervalTypes().contains(log.getIntervalType()))
                                .filter(log -> isFilterEmpty(filter.getIntervalTypeIds())
                                                || filter.getIntervalTypeIds().contains(log.getIntervalTypeId()))
                                .filter(log -> isFilterEmpty(filter.getCreatedByUserIds())
                                                || filter.getCreatedByUserIds().contains(log.getCreatedByUserId()))
                                .filter(log -> isFilterEmpty(filter.getLogTypes())
                                                || filter.getLogTypes().contains(log.getLogType()))
                                .filter(log -> isFilterEmpty(filter.getEntityIds())
                                                || filter.getEntityIds().contains(log.getEntityId()))
                                .filter(log -> isFilterEmpty(filter.getSubjectIds())
                                                || filter.getSubjectIds().contains(log.getSubjectId()))
                                .filter(log -> isFilterEmpty(filter.getStatuses())
                                                || filter.getStatuses().contains(log.getStatus()))
                                .toList();

                // Apply pagination
                int start = pageNo * pageSize;
                int end = Math.min(start + pageSize, filteredLogs.size());

                List<TeacherPlanningLog> paginatedLogs = start < filteredLogs.size()
                                ? filteredLogs.subList(start, end)
                                : new ArrayList<>();

                // Convert to DTOs
                List<PlanningLogResponseDTO> responseDTOs = paginatedLogs.stream()
                                .map(this::mapToResponseDTO)
                                .toList();

                log.info("Found {} planning logs after filtering, returning page {} with {} items",
                                filteredLogs.size(), pageNo, responseDTOs.size());

                // Create pageable and return Page
                Pageable pageable = PageRequest.of(pageNo, pageSize,
                                Sort.by(Sort.Direction.DESC, "createdAt"));

                return new PageImpl<>(responseDTOs, pageable, filteredLogs.size());
        }

        @Transactional
        @CacheEvict(value = "planningLogsList", allEntries = true)
        public PlanningLogResponseDTO updatePlanningLog(String logId, PlanningLogUpdateDTO updateDTO,
                        String instituteId, CustomUserDetails user) {
                log.info("Updating planning log: {} for user: {}, institute: {}", logId, user.getUserId(), instituteId);

                // Find the log
                TeacherPlanningLog planningLog = planningLogRepository.findByIdAndInstituteId(logId, instituteId)
                                .orElseThrow(() -> new IllegalArgumentException(
                                                "Planning log not found with id: " + logId));

                // Verify user has permission (created by this user)
                if (!planningLog.getCreatedByUserId().equals(user.getUserId())) {
                        throw new IllegalArgumentException("You don't have permission to update this planning log");
                }

                // Update only non-null fields
                if (updateDTO.getTitle() != null) {
                        planningLog.setTitle(updateDTO.getTitle());
                }
                if (updateDTO.getDescription() != null) {
                        planningLog.setDescription(updateDTO.getDescription());
                }
                if (updateDTO.getContentHtml() != null) {
                        planningLog.setContent(updateDTO.getContentHtml());
                }
                if (updateDTO.getCommaSeparatedFileIds() != null) {
                        planningLog.setCommaSeparatedFileIds(updateDTO.getCommaSeparatedFileIds());
                }
                if (updateDTO.getStatus() != null) {
                        planningLog.setStatus(updateDTO.getStatus());
                }

                // Save updated entity
                TeacherPlanningLog updatedLog = planningLogRepository.save(planningLog);

                log.info("Successfully updated planning log: {}", logId);

                return mapToResponseDTO(updatedLog);
        }
}
