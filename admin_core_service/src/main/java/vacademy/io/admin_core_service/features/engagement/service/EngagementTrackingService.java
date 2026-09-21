package vacademy.io.admin_core_service.features.engagement.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.engagement.dto.EngagementTrackingDTO;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementAttempt;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementItem;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementPlan;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementSlot;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementAttemptRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementItemRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementPlanRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementSlotRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.exceptions.VacademyException;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Read-only tracking for teachers: who did what on an item. */
@Service
@RequiredArgsConstructor
@Slf4j
public class EngagementTrackingService {

    private static final int MAX_PAGE_SIZE = 200;
    /** Bound on the export so one click cannot pull an unbounded result set. */
    private static final int EXPORT_LIMIT = 5000;

    private final EngagementItemRepository itemRepository;
    private final EngagementSlotRepository slotRepository;
    private final EngagementPlanRepository planRepository;
    private final EngagementAttemptRepository attemptRepository;
    private final AuthService authService;
    private final EngagementScheduleResolver scheduleResolver;
    private final vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository enrollmentRepository;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public EngagementTrackingDTO getItemTracking(String itemId, String instituteId, int page, int size) {
        EngagementItem item = requireItem(itemId, instituteId);

        int pageSize = Math.max(1, Math.min(size, MAX_PAGE_SIZE));
        Page<EngagementAttempt> attempts =
                attemptRepository.findPageByItem(itemId, PageRequest.of(Math.max(0, page), pageSize));

        List<EngagementTrackingDTO.Row> rows = toRows(attempts.getContent());

        EngagementTrackingDTO dto = new EngagementTrackingDTO();
        dto.setItemId(item.getId());
        dto.setTitle(item.getTitle());
        dto.setItemType(item.getItemType());
        dto.setCompletedCount(attemptRepository.countCompletedForItem(itemId));
        dto.setCorrectCount(attemptRepository.countCorrectForItem(itemId));
        dto.setRows(rows);
        dto.setPage(attempts.getNumber());
        dto.setPageSize(attempts.getSize());
        dto.setTotalRows(attempts.getTotalElements());
        dto.setTotalPages(attempts.getTotalPages());
        return dto;
    }

    /**
     * Every attempt on the item as CSV.
     *
     * Built here rather than in the browser so the export is the FULL result set, not
     * whatever page happened to be on screen — exporting only the visible page is a
     * quietly wrong answer a teacher would not notice.
     */
    @Transactional(readOnly = true)
    public String exportItemCsv(String itemId, String instituteId) {
        EngagementItem item = requireItem(itemId, instituteId);
        List<EngagementAttempt> attempts = attemptRepository.findByItem(itemId);
        if (attempts.size() > EXPORT_LIMIT) attempts = attempts.subList(0, EXPORT_LIMIT);
        List<EngagementTrackingDTO.Row> rows = toRows(attempts);

        StringBuilder csv = new StringBuilder();
        csv.append("Name,Username,Email,Status,Result,Score,Points,Late,Time spent (s),Completed at,Answer,Files\n");
        for (EngagementTrackingDTO.Row row : rows) {
            csv.append(csvCell(row.getFullName())).append(',')
               .append(csvCell(row.getUsername())).append(',')
               .append(csvCell(row.getEmail())).append(',')
               .append(csvCell(row.getStatus())).append(',')
               .append(csvCell(resultLabel(row))).append(',')
               .append(row.getScore() == null ? "" : row.getScore()).append(',')
               .append(row.getPointsAwarded()).append(',')
               .append(Boolean.TRUE.equals(row.getIsLate()) ? "yes" : "no").append(',')
               .append(row.getTimeSpentMs() == null ? "" : row.getTimeSpentMs() / 1000).append(',')
               .append(csvCell(row.getCompletedAt())).append(',')
               .append(csvCell(row.getTextAnswer())).append(',')
               .append(csvCell(row.getFileIds() == null ? "" : String.join(" ", row.getFileIds())))
               .append('\n');
        }
        log.info("[engagement] CSV export for item {} ({} rows)", itemId, rows.size());
        return csv.toString();
    }

    /**
     * Batch-level overview of a plan: every enrolled learner, how much they have done,
     * and who is slipping — the teacher's "who do I nudge" list. Missed = tasks whose
     * window has closed that the learner never completed, so a learner who joined
     * yesterday is not marked as missing a fortnight.
     */
    @Transactional(readOnly = true)
    public EngagementTrackingDTO.PlanOverview getPlanOverview(String planId, String instituteId) {
        EngagementPlan plan = planRepository.findById(planId)
                .orElseThrow(() -> new VacademyException("Plan not found"));
        if (!Objects.equals(plan.getInstituteId(), instituteId)) {
            throw new VacademyException("Plan not found");
        }

        LocalDate today = LocalDate.now(scheduleResolver.zoneOf(plan));
        List<EngagementItem> closedItems = new ArrayList<>();
        long totalItems = 0;
        for (EngagementSlot slot : slotRepository.findActiveByPlan(plan.getId())) {
            List<EngagementItem> items = itemRepository.findActiveBySlot(slot.getId());
            totalItems += items.size();
            LocalDate lastRun = scheduleResolver.mostRecentRunDate(slot, today);
            if (lastRun == null) continue;
            for (EngagementItem item : items) {
                EngagementScheduleResolver.SlotState state =
                        scheduleResolver.stateOn(plan, slot, item, lastRun);
                if (state == EngagementScheduleResolver.SlotState.CLOSED) closedItems.add(item);
            }
        }

        List<String> learnerIds = enrollmentRepository
                .findDistinctUserIdsByPackageSessionAndStatus(plan.getPackageSessionId(), List.of("ACTIVE"));
        Map<String, UserDTO> users = hydrateUsers(learnerIds);

        Map<String, List<EngagementAttempt>> attemptsByUser = new HashMap<>();
        for (EngagementItem item : closedItems) {
            for (EngagementAttempt a : attemptRepository.findByItem(item.getId())) {
                attemptsByUser.computeIfAbsent(a.getUserId(), k -> new ArrayList<>()).add(a);
            }
        }
        // Completions on still-open items count toward "completed" too.
        for (EngagementSlot slot : slotRepository.findActiveByPlan(plan.getId())) {
            for (EngagementItem item : itemRepository.findActiveBySlot(slot.getId())) {
                if (closedItems.contains(item)) continue;
                for (EngagementAttempt a : attemptRepository.findByItem(item.getId())) {
                    attemptsByUser.computeIfAbsent(a.getUserId(), k -> new ArrayList<>()).add(a);
                }
            }
        }

        java.util.Set<String> closedIds = new java.util.HashSet<>();
        for (EngagementItem i : closedItems) closedIds.add(i.getId());

        List<EngagementTrackingDTO.LearnerProgress> rows = new ArrayList<>();
        long active = 0, slipping = 0;
        for (String userId : learnerIds) {
            List<EngagementAttempt> mine = attemptsByUser.getOrDefault(userId, List.of());
            long completed = mine.stream().filter(a -> "COMPLETED".equals(a.getStatus())).count();
            long correct = mine.stream().filter(a -> Boolean.TRUE.equals(a.getIsCorrect())).count();
            long points = mine.stream().mapToLong(a -> a.getPointsAwarded() == null ? 0 : a.getPointsAwarded()).sum();
            java.util.Set<String> doneClosed = new java.util.HashSet<>();
            for (EngagementAttempt a : mine) {
                if ("COMPLETED".equals(a.getStatus()) && closedIds.contains(a.getItemId())) doneClosed.add(a.getItemId());
            }
            long missed = closedIds.size() - doneClosed.size();
            String last = mine.stream()
                    .filter(a -> a.getCompletedAt() != null)
                    .map(a -> a.getCompletedAt().toInstant().toString())
                    .max(String::compareTo).orElse(null);
            if (completed > 0) active++;
            if (missed >= 3) slipping++;
            UserDTO u = users.get(userId);
            rows.add(new EngagementTrackingDTO.LearnerProgress(
                    userId,
                    u == null ? null : u.getFullName(),
                    u == null ? null : u.getUsername(),
                    completed, correct, points, missed, last));
        }
        // Most missed first — the nudge list reads top-down.
        rows.sort((a, b) -> Long.compare(b.getMissed(), a.getMissed()));

        return new EngagementTrackingDTO.PlanOverview(
                plan.getId(), plan.getTitle(), closedIds.size(), totalItems,
                learnerIds.size(), active, slipping, rows);
    }

    // ── internals ────────────────────────────────────────────────────────────

    private Map<String, Object> parseResponse(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            return objectMapper.readValue(json, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    @SuppressWarnings("unchecked")
    private List<String> fileIdsOf(Map<String, Object> response) {
        Object raw = response.get("fileIds");
        if (raw instanceof List<?> list) {
            List<String> out = new ArrayList<>();
            for (Object o : list) if (o != null) out.add(String.valueOf(o));
            return out;
        }
        return null;
    }

    private List<EngagementTrackingDTO.Row> toRows(List<EngagementAttempt> attempts) {
        Map<String, UserDTO> users = hydrateUsers(
                attempts.stream().map(EngagementAttempt::getUserId).toList());

        List<EngagementTrackingDTO.Row> rows = new ArrayList<>();
        for (EngagementAttempt attempt : attempts) {
            UserDTO user = users.get(attempt.getUserId());
            Map<String, Object> response = parseResponse(attempt.getResponseJson());
            rows.add(new EngagementTrackingDTO.Row(
                    attempt.getUserId(),
                    user == null ? null : user.getFullName(),
                    user == null ? null : user.getUsername(),
                    user == null ? null : user.getEmail(),
                    attempt.getStatus(),
                    attempt.getIsCorrect(),
                    attempt.getScore() == null ? null : attempt.getScore().doubleValue(),
                    attempt.getPointsAwarded(),
                    attempt.getIsLate(),
                    attempt.getTimeSpentMs(),
                    attempt.getCompletedAt() == null ? null : attempt.getCompletedAt().toInstant().toString(),
                    response.get("textAnswer") == null ? null : String.valueOf(response.get("textAnswer")),
                    fileIdsOf(response),
                    response.get("selectedOptionId") == null ? null : String.valueOf(response.get("selectedOptionId"))));
        }
        return rows;
    }

    /**
     * Names come from auth_service over HTTP — admin_core has no users table to join.
     * A failure leaves names null rather than failing the whole table: a teacher is
     * better served by ids than by an error page.
     */
    private Map<String, UserDTO> hydrateUsers(Collection<String> userIds) {
        List<String> ids = userIds.stream()
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .toList();
        if (ids.isEmpty()) return Map.of();
        Map<String, UserDTO> out = new HashMap<>();
        try {
            for (UserDTO user : authService.getUsersFromAuthServiceByUserIds(new ArrayList<>(ids))) {
                if (user != null && user.getId() != null) out.put(user.getId(), user);
            }
        } catch (Exception e) {
            log.warn("[engagement] learner name hydration failed: {}", e.getMessage());
        }
        return out;
    }

    private EngagementItem requireItem(String itemId, String instituteId) {
        EngagementItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new VacademyException("Item not found"));
        EngagementSlot slot = slotRepository.findById(item.getSlotId())
                .orElseThrow(() -> new VacademyException("Item not found"));
        EngagementPlan plan = planRepository.findById(slot.getPlanId())
                .orElseThrow(() -> new VacademyException("Item not found"));
        // Cross-tenant guard: an item id from another institute must not be readable.
        if (!Objects.equals(plan.getInstituteId(), instituteId)) {
            throw new VacademyException("Item not found");
        }
        return item;
    }

    private String resultLabel(EngagementTrackingDTO.Row row) {
        if (row.getIsCorrect() == null) return "";
        return Boolean.TRUE.equals(row.getIsCorrect()) ? "Correct" : "Wrong";
    }

    /** RFC-4180 quoting: a learner's name can legitimately contain a comma or quote. */
    private String csvCell(String value) {
        if (value == null) return "";
        String escaped = value.replace("\"", "\"\"");
        return "\"" + escaped + "\"";
    }
}
