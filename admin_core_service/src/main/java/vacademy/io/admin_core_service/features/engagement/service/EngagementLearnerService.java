package vacademy.io.admin_core_service.features.engagement.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.engagement.dto.EngagementFeedDTO;
import vacademy.io.admin_core_service.features.engagement.dto.EngagementItemDTO;
import vacademy.io.admin_core_service.features.engagement.dto.EngagementSubmitRequest;
import vacademy.io.admin_core_service.features.engagement.dto.EngagementSubmitResponse;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementAttempt;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementEnums;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementItem;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementPlan;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementSlot;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementAttemptRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementItemRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementPlanRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementSlotRepository;
import vacademy.io.admin_core_service.features.engagement.service.EngagementScheduleResolver.SlotState;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.points_ledger.entity.PointsSourceType;
import vacademy.io.admin_core_service.features.points_ledger.service.PointsLedgerService;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

/** Everything the learner side of daily engagement does: feed, open, submit. */
@Service
@RequiredArgsConstructor
@Slf4j
public class EngagementLearnerService {

    /** How many days ahead the locked "coming up" strip looks. */
    private static final int UPCOMING_DAYS = 7;

    private final EngagementPlanRepository planRepository;
    private final EngagementSlotRepository slotRepository;
    private final EngagementItemRepository itemRepository;
    private final EngagementAttemptRepository attemptRepository;
    private final EngagementScheduleResolver scheduleResolver;
    private final EngagementSettingsService settingsService;
    private final PointsLedgerService pointsLedgerService;
    private final StudentSessionInstituteGroupMappingRepository enrollmentRepository;
    private final ObjectMapper objectMapper;

    // ── Feed ─────────────────────────────────────────────────────────────────

    /**
     * Today's items across every batch the learner is enrolled in.
     *
     * Items hidden by the daily cap are NOT recorded as missed — a learner in four
     * batches would otherwise accumulate failures for work they were never shown.
     */
    @Transactional(readOnly = true)
    public EngagementFeedDTO getFeed(String instituteId, String userId) {
        List<String> packageSessionIds =
                enrollmentRepository.findPackageSessionIdsByUserIdAndInstituteId(userId, instituteId);
        if (packageSessionIds == null || packageSessionIds.isEmpty()) {
            return new EngagementFeedDTO(List.of(), List.of(), 0, 0, false);
        }

        List<EngagementPlan> plans = planRepository.findPublishedForPackageSessions(packageSessionIds);
        if (plans.isEmpty()) {
            return new EngagementFeedDTO(List.of(), List.of(), 0, 0, false);
        }

        Map<String, EngagementPlan> plansById = new HashMap<>();
        for (EngagementPlan plan : plans) plansById.put(plan.getId(), plan);

        // The slot query is date-bounded; the plan's own timezone decides which local
        // date that is, so widen by a day on each side and let the resolver judge.
        LocalDate probeFrom = LocalDate.now(ZoneId.of("UTC")).minusDays(1);
        LocalDate probeTo = LocalDate.now(ZoneId.of("UTC")).plusDays(UPCOMING_DAYS + 1);
        List<EngagementSlot> slots =
                slotRepository.findInRange(new ArrayList<>(plansById.keySet()), probeFrom, probeTo);
        if (slots.isEmpty()) {
            return new EngagementFeedDTO(List.of(), List.of(), 0, 0, false);
        }

        Map<String, EngagementSlot> slotsById = new HashMap<>();
        for (EngagementSlot slot : slots) slotsById.put(slot.getId(), slot);

        List<EngagementItem> items = itemRepository.findActiveBySlots(new ArrayList<>(slotsById.keySet()));
        if (items.isEmpty()) {
            return new EngagementFeedDTO(List.of(), List.of(), 0, 0, false);
        }

        Map<String, EngagementAttempt> attempts = new HashMap<>();
        for (EngagementAttempt attempt :
                attemptRepository.findByUserAndItems(userId, items.stream().map(EngagementItem::getId).toList())) {
            attempts.put(attempt.getItemId(), attempt);
        }

        Map<String, Long> completedCounts = new HashMap<>();
        for (Object[] row : attemptRepository.countCompletedForItems(
                items.stream().map(EngagementItem::getId).toList())) {
            completedCounts.put((String) row[0], ((Number) row[1]).longValue());
        }

        List<EngagementItemDTO> live = new ArrayList<>();
        List<EngagementItemDTO> upcoming = new ArrayList<>();
        int completedToday = 0;

        for (EngagementItem item : items) {
            EngagementSlot slot = slotsById.get(item.getSlotId());
            if (slot == null) continue;
            EngagementPlan plan = plansById.get(slot.getPlanId());
            if (plan == null) continue;

            ZoneId zone = scheduleResolver.zoneOf(plan);
            LocalDate today = LocalDate.now(zone);
            EngagementAttempt attempt = attempts.get(item.getId());

            // Today's occurrence (or the most recent one still inside catch-up).
            LocalDate runDate = scheduleResolver.runsOn(slot, today)
                    ? today
                    : scheduleResolver.mostRecentRunDate(slot, today);

            if (runDate != null) {
                SlotState state = scheduleResolver.stateOn(plan, slot, item, runDate);
                boolean isCompleted = attempt != null
                        && EngagementEnums.AttemptStatus.COMPLETED.name().equals(attempt.getStatus());
                if (isCompleted && runDate.equals(today)) completedToday++;

                if ((state == SlotState.OPEN || state == SlotState.CATCH_UP) && !isCompleted) {
                    live.add(toLearnerDto(plan, slot, item, runDate, state, attempt,
                            completedCounts.getOrDefault(item.getId(), 0L)));
                    continue;
                }
            }

            // Locked future occurrence — metadata only.
            //
            // Search from TOMORROW when today's occurrence is already spent (closed,
            // or completed above). Searching from today would return today's date for
            // any daily slot and park a finished task in "Coming up" with today on it.
            LocalDate searchFrom = (runDate != null && runDate.equals(today))
                    ? today.plusDays(1)
                    : today;
            LocalDate nextRun = nextRunDate(slot, searchFrom);
            if (nextRun != null && !nextRun.isAfter(today.plusDays(UPCOMING_DAYS))) {
                upcoming.add(toLearnerDto(plan, slot, item, nextRun, SlotState.UPCOMING, null,
                        completedCounts.getOrDefault(item.getId(), 0L)));
            }
        }

        live.sort(feedOrder());
        upcoming.sort(Comparator.comparing(EngagementItemDTO::getRunDate,
                Comparator.nullsLast(Comparator.naturalOrder())));

        int cap = settingsService.getDailyItemCap(instituteId);
        boolean capApplied = live.size() > cap;
        if (capApplied) live = new ArrayList<>(live.subList(0, cap));

        return new EngagementFeedDTO(live, upcoming, live.size(), completedToday, capApplied);
    }

    /**
     * Required first, then whatever closes soonest, then the item's own order — so a
     * learner in several batches meets a deterministic, urgency-led queue.
     */
    private Comparator<EngagementItemDTO> feedOrder() {
        return Comparator
                .comparing((EngagementItemDTO d) -> !Boolean.TRUE.equals(d.getIsRequired()))
                .thenComparing(EngagementItemDTO::getClosesAt, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(EngagementItemDTO::getSortOrder, Comparator.nullsLast(Comparator.naturalOrder()));
    }

    /** Next local date on/after today that the slot runs; null if it never runs again. */
    private LocalDate nextRunDate(EngagementSlot slot, LocalDate today) {
        LocalDate cursor = today.isBefore(slot.getStartDate()) ? slot.getStartDate() : today;
        for (int i = 0; i < 8; i++) {
            if (cursor.isAfter(slot.effectiveEndDate())) return null;
            if (scheduleResolver.runsOn(slot, cursor)) return cursor;
            cursor = cursor.plusDays(1);
        }
        return null;
    }

    // ── Open one item ────────────────────────────────────────────────────────

    /** Full payload for an item the learner may actually open right now. */
    @Transactional(readOnly = true)
    public EngagementItemDTO getItem(String itemId, String instituteId, String userId) {
        Context ctx = loadContext(itemId, instituteId, userId);
        if (ctx.state == SlotState.UPCOMING) {
            throw new VacademyException("This task is not open yet");
        }
        if (ctx.state == SlotState.CLOSED) {
            throw new VacademyException("This task has closed");
        }
        EngagementAttempt attempt =
                attemptRepository.findByItemIdAndUserId(itemId, userId).orElse(null);
        return toLearnerDto(ctx.plan, ctx.slot, ctx.item, ctx.runDate, ctx.state, attempt,
                attemptRepository.countCompletedForItem(itemId));
    }

    // ── Submit ───────────────────────────────────────────────────────────────

    /**
     * Complete an item: grade it, write the attempt, award points.
     *
     * The unique index on (item_id, user_id) is the concurrency guard — a
     * double-tapped submit collides there rather than scoring twice — and the
     * ledger's idempotency key is the second line of defence.
     */
    @Transactional
    public EngagementSubmitResponse submit(String itemId, String instituteId, String userId,
                                           EngagementSubmitRequest request) {
        Context ctx = loadContext(itemId, instituteId, userId);
        if (ctx.state == SlotState.UPCOMING) throw new VacademyException("This task is not open yet");
        if (ctx.state == SlotState.CLOSED) throw new VacademyException("This task has closed");

        Optional<EngagementAttempt> existing = attemptRepository.findByItemIdAndUserId(itemId, userId);
        if (existing.isPresent()
                && EngagementEnums.AttemptStatus.COMPLETED.name().equals(existing.get().getStatus())) {
            return buildResponse(ctx, existing.get(), instituteId, userId);
        }

        EngagementEnums.ItemType type = itemType(ctx.item);
        boolean isLate = ctx.state == SlotState.CATCH_UP;

        Grade grade = grade(ctx.item, type, request, instituteId);
        if (!grade.accepted) {
            throw new VacademyException(grade.rejectionReason);
        }

        int points = grade.points;
        if (isLate) {
            int percent = scheduleResolver.resolveCatchUpPercent(ctx.plan, ctx.item);
            points = (int) Math.floor(points * (percent / 100.0));
        }

        EngagementAttempt attempt = existing.orElseGet(EngagementAttempt::new);
        attempt.setItemId(itemId);
        attempt.setItemVersion(ctx.item.getVersion());
        attempt.setUserId(userId);
        attempt.setInstituteId(instituteId);
        attempt.setPackageSessionId(ctx.plan.getPackageSessionId());
        attempt.setStatus(EngagementEnums.AttemptStatus.COMPLETED.name());
        attempt.setIsCorrect(grade.isCorrect);
        attempt.setScore(grade.score);
        attempt.setMaxScore(ctx.item.getMaxScore() == null
                ? null : BigDecimal.valueOf(ctx.item.getMaxScore()));
        attempt.setResponseJson(request.getResponseJson());
        attempt.setTimeSpentMs(request.getTimeSpentMs());
        attempt.setPointsAwarded(points);
        attempt.setIsLate(isLate);
        attempt.setIsVerified(Boolean.TRUE.equals(ctx.item.getIsVerifiable()));
        if (attempt.getStartedAt() == null) attempt.setStartedAt(now());
        attempt.setCompletedAt(now());
        attempt.setUpdatedAt(now());

        try {
            attempt = attemptRepository.saveAndFlush(attempt);
        } catch (DataIntegrityViolationException e) {
            // Concurrent submit won the race; its row is the authoritative one.
            EngagementAttempt winner = attemptRepository.findByItemIdAndUserId(itemId, userId)
                    .orElseThrow(() -> new VacademyException("Could not record this attempt"));
            return buildResponse(ctx, winner, instituteId, userId);
        }

        if (points != 0) {
            pointsLedgerService.award(
                    userId,
                    instituteId,
                    ctx.plan.getPackageSessionId(),
                    PointsSourceType.ENGAGEMENT_ITEM,
                    itemId,
                    points,
                    ctx.item.getTitle(),
                    // Version in the key so a re-issued item version can award again,
                    // while a retry of the same submit cannot.
                    "ENGAGEMENT_ITEM:" + itemId + ":v" + ctx.item.getVersion() + ":" + userId);
        }

        return buildResponse(ctx, attempt, instituteId, userId);
    }

    // ── Grading ──────────────────────────────────────────────────────────────

    private record Grade(boolean accepted, String rejectionReason, Boolean isCorrect,
                         BigDecimal score, int points) {
        static Grade reject(String reason) { return new Grade(false, reason, null, null, 0); }
        static Grade of(Boolean correct, BigDecimal score, int points) {
            return new Grade(true, null, correct, score, points);
        }
    }

    private Grade grade(EngagementItem item, EngagementEnums.ItemType type,
                        EngagementSubmitRequest request, String instituteId) {
        int completion = item.getCompletionPoints() == null ? 0 : item.getCompletionPoints();

        switch (type) {
            case QUESTION_OF_DAY -> {
                String correctOptionId = readPayloadText(item.getPayloadJson(), "correctOptionId");
                if (correctOptionId == null) {
                    // Nothing to grade against — treat as completion-only rather than
                    // silently marking every learner wrong.
                    log.warn("[engagement] item {} has no correctOptionId; scoring completion only", item.getId());
                    return Grade.of(null, null, completion);
                }
                if (request.getSelectedOptionId() == null || request.getSelectedOptionId().isBlank()) {
                    return Grade.reject("An answer is required");
                }
                boolean correct = correctOptionId.equals(request.getSelectedOptionId());
                int points = completion + (correct ? nz(item.getCorrectPoints()) : 0);
                return Grade.of(correct, BigDecimal.valueOf(correct ? 1 : 0), points);
            }
            case READING_HTML, VISUAL_NOTE -> {
                // Dwell + scroll is a patience signal, not a comprehension one. It gates
                // completion points only, and those are kept small by design.
                int minScroll = settingsService.getMinScrollPercent(instituteId);
                long minMs = settingsService.getMinReadMs(instituteId);
                int scroll = request.getScrollPercent() == null ? 0 : request.getScrollPercent();
                long spent = request.getTimeSpentMs() == null ? 0 : request.getTimeSpentMs();
                if (scroll < minScroll || spent < minMs) {
                    return Grade.reject("Finish reading before marking this complete");
                }
                return Grade.of(null, null, completion);
            }
            case GAME, QUIZ -> {
                double reported = request.getScore() == null ? 0 : request.getScore();
                // Clamp: the page reports its own score and cannot be trusted.
                double max = item.getMaxScore() == null ? reported : item.getMaxScore();
                double clamped = Math.max(0, Math.min(reported, max));
                int points = completion;
                boolean scoreMayEarnPoints = Boolean.TRUE.equals(item.getIsVerifiable())
                        || settingsService.isUnverifiedScoreBonusEnabled(instituteId);
                if (scoreMayEarnPoints && max > 0) {
                    points += (int) Math.round(nz(item.getCorrectPoints()) * (clamped / max));
                }
                return Grade.of(null, BigDecimal.valueOf(clamped), points);
            }
            case POLL -> {
                if (request.getSelectedOptionId() == null || request.getSelectedOptionId().isBlank()) {
                    return Grade.reject("Pick an option");
                }
                return Grade.of(null, null, completion);
            }
            default -> {
                return Grade.of(null, null, completion);
            }
        }
    }

    // ── DTO assembly + redaction ─────────────────────────────────────────────

    /**
     * Build the learner-facing DTO.
     *
     * An UPCOMING item carries NO content: no HTML, no slide, no question, no
     * payload. Shipping tomorrow's payload and hiding it with CSS puts tomorrow's
     * answer one devtools panel away, and in a ranked batch somebody will look.
     * An open question's answer key is stripped until the reveal time passes.
     */
    private EngagementItemDTO toLearnerDto(EngagementPlan plan, EngagementSlot slot, EngagementItem item,
                                           LocalDate runDate, SlotState state,
                                           EngagementAttempt attempt, long completedCount) {
        ZoneId zone = scheduleResolver.zoneOf(plan);
        boolean locked = state == SlotState.UPCOMING;
        boolean revealed = !locked && scheduleResolver.isRevealed(plan, slot, runDate);

        EngagementItemDTO.EngagementItemDTOBuilder builder = EngagementItemDTO.builder()
                .id(item.getId())
                .slotId(slot.getId())
                .planId(plan.getId())
                .packageSessionId(plan.getPackageSessionId())
                .itemType(item.getItemType())
                .title(item.getTitle())
                .version(item.getVersion())
                .sortOrder(item.getSortOrder())
                .isRequired(item.getIsRequired())
                .completionPoints(item.getCompletionPoints())
                .correctPoints(item.getCorrectPoints())
                .maxScore(item.getMaxScore())
                .state(state.name())
                .runDate(runDate == null ? null : runDate.toString())
                .opensAt(instant(runDate, slot.getStartTime(), zone))
                .closesAt(instant(runDate, slot.getEndTime(), zone))
                .revealAt(instant(runDate, slot.effectiveRevealTime(), zone))
                .isRevealed(revealed)
                .pointsPercent(state == SlotState.CATCH_UP
                        ? scheduleResolver.resolveCatchUpPercent(plan, item) : 100)
                .completedCount(completedCount);

        if (!locked) {
            builder.contentHtml(item.getContentHtml())
                    .slideId(item.getSlideId())
                    .questionId(item.getQuestionId())
                    .assessmentId(item.getAssessmentId())
                    .payloadJson(redactPayload(item.getPayloadJson(), revealed));
        }

        if (attempt != null) {
            builder.attemptStatus(attempt.getStatus())
                    .isCorrect(attempt.getIsCorrect())
                    .pointsAwarded(attempt.getPointsAwarded());
        }
        return builder.build();
    }

    /** Strip the answer key from a question payload until the reveal time passes. */
    private String redactPayload(String payloadJson, boolean revealed) {
        if (payloadJson == null || payloadJson.isBlank() || revealed) return payloadJson;
        try {
            JsonNode node = objectMapper.readTree(payloadJson);
            if (!node.isObject()) return payloadJson;
            ObjectNode copy = ((ObjectNode) node).deepCopy();
            copy.remove("correctOptionId");
            copy.remove("correctOptionIds");
            copy.remove("explanation");
            copy.remove("answer");
            return objectMapper.writeValueAsString(copy);
        } catch (Exception e) {
            // Unparseable payload: withhold it entirely rather than risk leaking a key.
            log.warn("[engagement] could not redact payload, withholding it: {}", e.getMessage());
            return null;
        }
    }

    private EngagementSubmitResponse buildResponse(Context ctx, EngagementAttempt attempt,
                                                   String instituteId, String userId) {
        boolean revealed = scheduleResolver.isRevealed(ctx.plan, ctx.slot, ctx.runDate);
        return new EngagementSubmitResponse(
                attempt.getId(),
                attempt.getStatus(),
                attempt.getIsCorrect(),
                attempt.getPointsAwarded(),
                attempt.getIsLate(),
                attempt.getIsVerified(),
                revealed,
                revealed ? readPayloadText(ctx.item.getPayloadJson(), "correctOptionId") : null,
                revealed ? readPayloadText(ctx.item.getPayloadJson(), "explanation") : null,
                pointsLedgerService.getSummary(instituteId, userId).getTotalPoints());
    }

    // ── Context loading ──────────────────────────────────────────────────────

    private record Context(EngagementPlan plan, EngagementSlot slot, EngagementItem item,
                           LocalDate runDate, SlotState state) {}

    /**
     * Load an item with its slot and plan, verifying the learner is actually enrolled
     * in the owning batch. Without this check any learner could submit to any item id.
     */
    private Context loadContext(String itemId, String instituteId, String userId) {
        EngagementItem item = itemRepository.findById(itemId)
                .orElseThrow(() -> new VacademyException("Task not found"));
        if (!EngagementEnums.ItemStatus.ACTIVE.name().equals(item.getStatus())) {
            throw new VacademyException("Task not found");
        }
        EngagementSlot slot = slotRepository.findById(item.getSlotId())
                .orElseThrow(() -> new VacademyException("Task not found"));
        EngagementPlan plan = planRepository.findById(slot.getPlanId())
                .orElseThrow(() -> new VacademyException("Task not found"));

        if (!Objects.equals(plan.getInstituteId(), instituteId)
                || !EngagementEnums.PlanStatus.PUBLISHED.name().equals(plan.getStatus())) {
            throw new VacademyException("Task not found");
        }
        List<String> enrolled =
                enrollmentRepository.findPackageSessionIdsByUserIdAndInstituteId(userId, instituteId);
        if (enrolled == null || !enrolled.contains(plan.getPackageSessionId())) {
            throw new VacademyException("Task not found");
        }

        LocalDate today = LocalDate.now(scheduleResolver.zoneOf(plan));
        LocalDate runDate = scheduleResolver.runsOn(slot, today)
                ? today
                : scheduleResolver.mostRecentRunDate(slot, today);
        if (runDate == null) {
            LocalDate next = nextRunDate(slot, today);
            return new Context(plan, slot, item, next, SlotState.UPCOMING);
        }
        return new Context(plan, slot, item, runDate,
                scheduleResolver.stateOn(plan, slot, item, runDate));
    }

    // ── small helpers ────────────────────────────────────────────────────────

    private EngagementEnums.ItemType itemType(EngagementItem item) {
        try {
            return EngagementEnums.ItemType.valueOf(item.getItemType());
        } catch (Exception e) {
            throw new VacademyException("Unsupported task type: " + item.getItemType());
        }
    }

    private String readPayloadText(String payloadJson, String field) {
        if (payloadJson == null || payloadJson.isBlank()) return null;
        try {
            JsonNode node = objectMapper.readTree(payloadJson);
            JsonNode value = node.get(field);
            return value == null || value.isNull() ? null : value.asText();
        } catch (Exception e) {
            return null;
        }
    }

    private String instant(LocalDate date, java.time.LocalTime time, ZoneId zone) {
        if (date == null || time == null) return null;
        return LocalDateTime.of(date, time).atZone(zone).toInstant().toString();
    }

    private int nz(Integer value) {
        return value == null ? 0 : value;
    }

    private Timestamp now() {
        return new Timestamp(System.currentTimeMillis());
    }
}
