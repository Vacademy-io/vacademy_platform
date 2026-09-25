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
import vacademy.io.admin_core_service.features.engagement.dto.EngagementHistoryDTO;
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
import vacademy.io.admin_core_service.features.learner_operation.enums.LearnerOperationSourceEnum;
import vacademy.io.admin_core_service.features.learner_operation.entity.LearnerOperation;
import vacademy.io.admin_core_service.features.learner_operation.repository.LearnerOperationRepository;
import vacademy.io.admin_core_service.features.points_ledger.entity.PointsSourceType;
import vacademy.io.admin_core_service.features.points_ledger.service.PointsLedgerService;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collection;
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
    private static final int HISTORY_MAX_DAYS = 90;

    /**
     * The progress rows a finished slide can leave behind — one per slide type.
     *
     * A COURSE_SLIDE task is complete when ANY of these reads at or above the
     * threshold, because the teacher picks a slide without caring whether it happens
     * to be a video, a document or a quiz.
     */
    private static final List<String> SLIDE_COMPLETION_OPERATIONS = List.of(
            "PERCENTAGE_DOCUMENT_COMPLETED",
            "PERCENTAGE_VIDEO_WATCHED",
            "PERCENTAGE_QUESTION_COMPLETED",
            "PERCENTAGE_ASSIGNMENT_COMPLETED",
            "PERCENTAGE_QUIZ_COMPLETED",
            "PERCENTAGE_AUDIO_LISTENED",
            "PERCENTAGE_SCORM_COMPLETED",
            "PERCENTAGE_ASSESSMENT_DONE",
            "MARKED_AS_WATCHED");

    /** Percent of a slide that counts as done. */
    private static final double SLIDE_COMPLETE_THRESHOLD = 80.0;

    private final EngagementPlanRepository planRepository;
    private final EngagementSlotRepository slotRepository;
    private final EngagementItemRepository itemRepository;
    private final EngagementAttemptRepository attemptRepository;
    private final EngagementScheduleResolver scheduleResolver;
    private final EngagementSettingsService settingsService;
    private final PointsLedgerService pointsLedgerService;
    private final StudentSessionInstituteGroupMappingRepository enrollmentRepository;
    private final LearnerOperationRepository learnerOperationRepository;
    private final vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository packageSessionRepository;
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

        List<EngagementPlan> plans =
                planRepository.findPublishedForPackageSessions(packageSessionIds, instituteId);
        if (plans.isEmpty()) {
            return new EngagementFeedDTO(List.of(), List.of(), 0, 0, false);
        }

        Map<String, EngagementPlan> plansById = new HashMap<>();
        for (EngagementPlan plan : plans) plansById.put(plan.getId(), plan);

        // A learner in several batches needs each card to say which batch it is from.
        Map<String, String> batchNames = new HashMap<>();
        for (EngagementPlan plan : plans) {
            String psId = plan.getPackageSessionId();
            if (batchNames.containsKey(psId)) continue;
            try {
                packageSessionRepository.findBatchAndInstituteByPackageSessionId(psId)
                        .ifPresent(ctx -> batchNames.put(psId, ctx.getBatchName()));
            } catch (Exception ignored) {
                // A missing name is cosmetic; the card still renders.
            }
        }

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
        List<EngagementItemDTO> revealed = new ArrayList<>();
        int completedToday = 0;

        for (EngagementItem item : items) {
            // QUIZ has no authoring or learner path yet; showing it would be a dead card.
            if (EngagementEnums.ItemType.QUIZ.name().equals(item.getItemType())) continue;
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

                // The reveal moment: a task this learner completed, whose reveal time
                // has now passed, within the last two days. This is where the answer
                // key and explanation are finally allowed out. Only question and poll
                // items have anything to reveal; a finished reading or game is not news.
                boolean hasReveal = EngagementEnums.ItemType.QUESTION_OF_DAY.name().equals(item.getItemType())
                        || EngagementEnums.ItemType.POLL.name().equals(item.getItemType());
                if (isCompleted && hasReveal
                        && scheduleResolver.isRevealed(plan, slot, runDate)
                        && !runDate.isBefore(today.minusDays(2))) {
                    EngagementItemDTO shown = toLearnerDto(plan, slot, item, runDate, state, attempt,
                            completedCounts.getOrDefault(item.getId(), 0L));
                    shown.setPackageSessionName(batchNames.get(plan.getPackageSessionId()));
                    shown.setCorrectOptionId(readPayloadText(item.getPayloadJson(), "correctOptionId"));
                    shown.setExplanation(readPayloadText(item.getPayloadJson(), "explanation"));
                    shown.setSelectedOptionId(readResponseText(attempt, "selectedOptionId"));
                    revealed.add(shown);
                }

                if ((state == SlotState.OPEN || state == SlotState.CATCH_UP) && !isCompleted) {
                    EngagementItemDTO dto = toLearnerDto(plan, slot, item, runDate, state, attempt,
                            completedCounts.getOrDefault(item.getId(), 0L));
                    dto.setPackageSessionName(batchNames.get(plan.getPackageSessionId()));
                    live.add(dto);
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

        // Newest reveal first; the learner most wants last night's answer.
        revealed.sort(Comparator.comparing(EngagementItemDTO::getRevealAt,
                Comparator.nullsLast(Comparator.reverseOrder())));

        EngagementFeedDTO feed = new EngagementFeedDTO(live, upcoming, live.size(), completedToday, capApplied);
        feed.setRevealed(revealed);
        feed.setStreakDays(engagementStreak(userId, instituteId, plansById.values()));
        return feed;
    }

    /**
     * Required first, then whatever closes soonest, then the item's own order — so a
     * learner in several batches meets a deterministic, urgency-led queue.
     */
    // ── History ──────────────────────────────────────────────────────────────

    /**
     * Past occurrences for this learner, newest first.
     *
     * An attempt is per item, not per run date, so for a recurring slot the single
     * completion is filed under the occurrence that was in effect when it happened
     * (a late catch-up lands on the day it caught up FOR, not the day it was done).
     * Occurrences after that completion are skipped — the feed never showed them —
     * and earlier ones that have closed count as missed. Today's open tasks stay on
     * the home card, so history only carries today's entries once they are done or
     * closed.
     */
    @Transactional(readOnly = true)
    public EngagementHistoryDTO getHistory(String instituteId, String userId, int days) {
        int window = Math.max(1, Math.min(days, HISTORY_MAX_DAYS));
        LocalDate utcToday = LocalDate.now(ZoneId.of("UTC"));
        String from = utcToday.minusDays(window).toString();
        String to = utcToday.toString();
        EngagementHistoryDTO empty = new EngagementHistoryDTO(from, to, List.of(), 0, 0, 0, 0);

        List<String> packageSessionIds =
                enrollmentRepository.findPackageSessionIdsByUserIdAndInstituteId(userId, instituteId);
        if (packageSessionIds == null || packageSessionIds.isEmpty()) return empty;
        List<EngagementPlan> plans =
                planRepository.findPublishedForPackageSessions(packageSessionIds, instituteId);
        if (plans.isEmpty()) return empty;

        Map<String, EngagementPlan> plansById = new HashMap<>();
        Map<String, String> batchNames = new HashMap<>();
        for (EngagementPlan plan : plans) {
            plansById.put(plan.getId(), plan);
            String psId = plan.getPackageSessionId();
            if (!batchNames.containsKey(psId)) {
                try {
                    packageSessionRepository.findBatchAndInstituteByPackageSessionId(psId)
                            .ifPresent(ctx -> batchNames.put(psId, ctx.getBatchName()));
                } catch (Exception ignored) {
                    // Cosmetic.
                }
            }
        }

        List<EngagementSlot> slots = slotRepository.findInRange(
                new ArrayList<>(plansById.keySet()), utcToday.minusDays(window + 1), utcToday.plusDays(1));
        if (slots.isEmpty()) return empty;
        Map<String, EngagementSlot> slotsById = new HashMap<>();
        for (EngagementSlot slot : slots) slotsById.put(slot.getId(), slot);

        List<EngagementItem> items = itemRepository.findActiveBySlots(new ArrayList<>(slotsById.keySet()));
        if (items.isEmpty()) return empty;
        List<String> itemIds = items.stream().map(EngagementItem::getId).toList();

        Map<String, EngagementAttempt> attempts = new HashMap<>();
        for (EngagementAttempt attempt : attemptRepository.findByUserAndItems(userId, itemIds)) {
            attempts.put(attempt.getItemId(), attempt);
        }
        Map<String, Long> completedCounts = new HashMap<>();
        for (Object[] row : attemptRepository.countCompletedForItems(itemIds)) {
            completedCounts.put((String) row[0], ((Number) row[1]).longValue());
        }

        List<EngagementItemDTO> out = new ArrayList<>();
        int done = 0, missed = 0, catchUp = 0, points = 0;

        for (EngagementItem item : items) {
            if (EngagementEnums.ItemType.QUIZ.name().equals(item.getItemType())) continue;
            EngagementSlot slot = slotsById.get(item.getSlotId());
            if (slot == null) continue;
            EngagementPlan plan = plansById.get(slot.getPlanId());
            if (plan == null) continue;
            ZoneId zone = scheduleResolver.zoneOf(plan);
            LocalDate today = LocalDate.now(zone);
            LocalDate first = today.minusDays(window);
            EngagementAttempt attempt = attempts.get(item.getId());
            boolean completed = attempt != null
                    && EngagementEnums.AttemptStatus.COMPLETED.name().equals(attempt.getStatus());

            // Which occurrence the completion belongs to.
            LocalDate doneRun = null;
            if (completed && attempt.getCompletedAt() != null) {
                LocalDate doneLocal = attempt.getCompletedAt().toInstant().atZone(zone).toLocalDate();
                doneRun = scheduleResolver.mostRecentRunDate(slot, doneLocal);
                if (doneRun != null && Boolean.TRUE.equals(attempt.getIsLate())) {
                    // A late completion is a catch-up for the occurrence BEFORE the
                    // one running on the day it was done, when there was one.
                    LocalDate prior = scheduleResolver.mostRecentRunDate(slot, doneRun.minusDays(1));
                    if (prior != null) doneRun = prior;
                }
            }

            LocalDate last = today.isAfter(slot.effectiveEndDate()) ? slot.effectiveEndDate() : today;
            for (LocalDate run = last; !run.isBefore(first); run = run.minusDays(1)) {
                if (run.isBefore(slot.getStartDate())) break;
                if (!scheduleResolver.runsOn(slot, run)) continue;
                SlotState state = scheduleResolver.stateOn(plan, slot, item, run);
                if (state == SlotState.UPCOMING) continue;

                String status;
                if (completed && doneRun != null && run.equals(doneRun)) {
                    status = "DONE";
                } else if (completed && doneRun != null && run.isAfter(doneRun)) {
                    continue; // already done — the feed never asked for this occurrence
                } else if (state == SlotState.OPEN) {
                    continue; // still on the home card
                } else if (state == SlotState.CATCH_UP) {
                    status = "CATCH_UP";
                } else {
                    status = "MISSED";
                }

                EngagementItemDTO dto = toLearnerDto(plan, slot, item, run, state,
                        "DONE".equals(status) ? attempt : null,
                        completedCounts.getOrDefault(item.getId(), 0L));
                dto.setPackageSessionName(batchNames.get(plan.getPackageSessionId()));
                dto.setHistoryStatus(status);
                // History is a summary; the document itself is fetched on open.
                dto.setContentHtml(null);
                if ("DONE".equals(status)) {
                    done++;
                    points += attempt.getPointsAwarded() == null ? 0 : attempt.getPointsAwarded();
                    dto.setIsLate(attempt.getIsLate());
                    dto.setCompletedAt(attempt.getCompletedAt() == null
                            ? null : attempt.getCompletedAt().toInstant().toString());
                    if (scheduleResolver.isRevealed(plan, slot, run)) {
                        dto.setCorrectOptionId(readPayloadText(item.getPayloadJson(), "correctOptionId"));
                        dto.setExplanation(readPayloadText(item.getPayloadJson(), "explanation"));
                        dto.setSelectedOptionId(readResponseText(attempt, "selectedOptionId"));
                    }
                } else if ("CATCH_UP".equals(status)) {
                    catchUp++;
                } else {
                    missed++;
                }
                out.add(dto);
            }
        }

        out.sort(Comparator.comparing(EngagementItemDTO::getRunDate,
                        Comparator.nullsLast(Comparator.<String>reverseOrder()))
                .thenComparing(EngagementItemDTO::getOpensAt,
                        Comparator.nullsLast(Comparator.<String>reverseOrder())));
        return new EngagementHistoryDTO(from, to, out, done, missed, catchUp, points);
    }

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

    /**
     * Full payload for an item the learner may actually open right now.
     *
     * Opening is also the start signal: a STARTED attempt is recorded once, and the
     * reading and game gates measure from its startedAt on the server. Before this,
     * both gates trusted a timeSpentMs the client made up.
     */
    @Transactional
    public EngagementItemDTO getItem(String itemId, String instituteId, String userId) {
        Context ctx = loadContext(itemId, instituteId, userId);
        if (ctx.state == SlotState.UPCOMING) {
            throw new VacademyException("This task is not open yet");
        }
        if (ctx.state == SlotState.CLOSED) {
            throw new VacademyException("This task has closed");
        }
        attemptRepository.insertStartedIfAbsent(java.util.UUID.randomUUID().toString(), itemId,
                ctx.item.getVersion() == null ? 1 : ctx.item.getVersion(), userId, instituteId,
                ctx.plan.getPackageSessionId());
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

        Timestamp startedAt = existing.map(EngagementAttempt::getStartedAt).orElse(null);
        Grade grade = grade(ctx.item, type, request, instituteId, userId, startedAt);
        if (!grade.accepted) {
            throw new VacademyException(grade.rejectionReason);
        }

        int points = grade.points;
        boolean answerAlreadyOut = scheduleResolver.isRevealed(ctx.plan, ctx.slot, ctx.runDate);
        if (answerAlreadyOut && Boolean.TRUE.equals(grade.isCorrect)) {
            // Once the reveal has passed, the answer is out among classmates who
            // finished. Record the outcome, but only completion points are earned.
            points -= nz(ctx.item.getCorrectPoints());
        }
        boolean withholdResult = Boolean.TRUE.equals(ctx.item.getHideResultUntilReveal())
                && !answerAlreadyOut;
        if (withholdResult && Boolean.TRUE.equals(grade.isCorrect)) {
            // Hold the bonus back to the reveal. Awarding it now would tell the learner
            // they were right through the points, which is the same secret by another
            // route. EngagementRevealJob pays it out once the reveal time passes.
            points -= nz(ctx.item.getCorrectPoints());
        }
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
        attempt.setResponseJson(buildResponseJson(type, request));
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

    /**
     * What the learner actually submitted, kept for the teacher.
     *
     * The grader reads textAnswer/fileIds to decide the outcome, but nothing else
     * stored them — a written answer was validated, graded as "completed", and
     * thrown away. The teacher then had a row saying COMPLETED and no way to read
     * what was written.
     */
    private String buildResponseJson(EngagementEnums.ItemType type, EngagementSubmitRequest request) {
        try {
            com.fasterxml.jackson.databind.node.ObjectNode node = objectMapper.createObjectNode();
            if (request.getSelectedOptionId() != null) node.put("selectedOptionId", request.getSelectedOptionId());
            if (request.getTextAnswer() != null && !request.getTextAnswer().isBlank()) {
                node.put("textAnswer", request.getTextAnswer().trim());
            }
            if (request.getFileIds() != null && !request.getFileIds().isEmpty()) {
                com.fasterxml.jackson.databind.node.ArrayNode files = node.putArray("fileIds");
                request.getFileIds().forEach(files::add);
            }
            if (request.getScore() != null) node.put("score", request.getScore());
            if (request.getScrollPercent() != null) node.put("scrollPercent", request.getScrollPercent());
            // Anything the client chose to attach as free-form extra.
            if (request.getResponseJson() != null && !request.getResponseJson().isBlank()) {
                try {
                    node.set("extra", objectMapper.readTree(request.getResponseJson()));
                } catch (Exception ignored) {
                    node.put("extra", request.getResponseJson());
                }
            }
            return node.size() == 0 ? null : objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            log.warn("[engagement] could not serialise response for {}: {}", type, e.getMessage());
            return request.getResponseJson();
        }
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
                        EngagementSubmitRequest request, String instituteId, String userId,
                        Timestamp startedAt) {
        int completion = item.getCompletionPoints() == null ? 0 : item.getCompletionPoints();
        // Measured from the STARTED row written when the learner opened the item. A
        // missing row means the item was never opened through getItem.
        long serverElapsedMs = startedAt == null ? -1 : System.currentTimeMillis() - startedAt.getTime();

        switch (type) {
            case QUESTION_OF_DAY -> {
                String format = questionFormat(item);
                if ("TEXT".equals(format)) {
                    // Nothing to grade against: a written answer is read by the teacher
                    // in the tracking table, so it earns completion points only.
                    if (request.getTextAnswer() == null || request.getTextAnswer().isBlank()) {
                        return Grade.reject("Write your answer first");
                    }
                    return Grade.of(null, null, completion);
                }
                if ("UPLOAD".equals(format)) {
                    if (request.getFileIds() == null || request.getFileIds().isEmpty()) {
                        return Grade.reject("Attach your answer first");
                    }
                    return Grade.of(null, null, completion);
                }

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
                if (serverElapsedMs < 0) {
                    return Grade.reject("Open the reading first");
                }
                // scrollPercent is advisory (the server cannot see the page); the time
                // gate is the server's own clock since the item was opened.
                if (scroll < minScroll || serverElapsedMs < minMs) {
                    return Grade.reject("Finish reading before marking this complete");
                }
                return Grade.of(null, null, completion);
            }
            case GAME, QUIZ -> {
                if (serverElapsedMs < 0) {
                    return Grade.reject("Open the game first");
                }
                if (serverElapsedMs < settingsService.getMinGameMs(instituteId)) {
                    return Grade.reject("Play the game first");
                }
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
            case COURSE_SLIDE -> {
                // Read the learner's real progress on the slide rather than trusting a
                // "done" tap. A lesson finished the ordinary way in the study library
                // therefore also finishes this task, and nothing is tracked twice.
                if (item.getSlideId() == null || item.getSlideId().isBlank()) {
                    log.warn("[engagement] COURSE_SLIDE item {} has no slideId", item.getId());
                    return Grade.of(null, null, completion);
                }
                if (!hasCompletedSlide(userId, item.getSlideId())) {
                    return Grade.reject("Open the lesson and finish it to complete this task");
                }
                return Grade.of(null, null, completion);
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

    /** A field off the learner's stored response, or null. */
    private String readResponseText(EngagementAttempt attempt, String field) {
        if (attempt == null) return null;
        return readPayloadText(attempt.getResponseJson(), field);
    }

    /**
     * Consecutive institute-local days with at least one completed task, ending
     * today or yesterday. Yesterday counts so a learner who has not opened today's
     * task yet still sees the streak they are about to keep, not one already broken.
     */
    private int engagementStreak(String userId, String instituteId, Collection<EngagementPlan> plans) {
        ZoneId zone = plans.stream().findFirst().map(scheduleResolver::zoneOf)
                .orElse(java.time.ZoneId.of("Asia/Kolkata"));
        LocalDate today = LocalDate.now(zone);
        LocalDate from = today.minusDays(60);
        List<EngagementAttempt> attempts = attemptRepository.findCompletedBetween(
                userId, instituteId,
                Timestamp.from(from.atStartOfDay(zone).toInstant()),
                Timestamp.from(today.plusDays(1).atStartOfDay(zone).toInstant()));
        java.util.Set<LocalDate> days = new java.util.HashSet<>();
        for (EngagementAttempt a : attempts) {
            if (a.getCompletedAt() != null) {
                days.add(a.getCompletedAt().toInstant().atZone(zone).toLocalDate());
            }
        }
        LocalDate cursor = days.contains(today) ? today : today.minusDays(1);
        int streak = 0;
        while (days.contains(cursor) && streak < 365) {
            streak++;
            cursor = cursor.minusDays(1);
        }
        return streak;
    }

    /** MCQ (the default), TEXT or UPLOAD, from the item's payload. */
    private String questionFormat(EngagementItem item) {
        String format = readPayloadText(item.getPayloadJson(), "format");
        return (format == null || format.isBlank()) ? "MCQ" : format.toUpperCase();
    }

    /** True when any slide-progress row for this learner reads as finished. */
    private boolean hasCompletedSlide(String userId, String slideId) {
        for (String operation : SLIDE_COMPLETION_OPERATIONS) {
            Optional<LearnerOperation> row = learnerOperationRepository
                    .findByUserIdAndSourceAndSourceIdAndOperation(
                            userId, LearnerOperationSourceEnum.SLIDE.name(), slideId, operation);
            if (row.isEmpty() || row.get().getValue() == null) continue;
            String value = row.get().getValue().trim();
            // MARKED_AS_WATCHED carries a flag; the PERCENTAGE_* rows carry a number.
            if (value.equalsIgnoreCase("true")) return true;
            try {
                if (Double.parseDouble(value) >= SLIDE_COMPLETE_THRESHOLD) return true;
            } catch (NumberFormatException ignored) {
                // A non-numeric percentage is not evidence of completion.
            }
        }
        return false;
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
                .hideResultUntilReveal(item.getHideResultUntilReveal())
                .completedCount(completedCount);

        if (!locked) {
            // The reveal time alone must not un-redact: a catch-up question past its
            // reveal is still answerable, and shipping the key to it handed out the
            // answer (and the bonus). The key goes only to a learner who has finished,
            // or who can no longer submit.
            boolean finished = attempt != null
                    && EngagementEnums.AttemptStatus.COMPLETED.name().equals(attempt.getStatus());
            boolean submittable = state == SlotState.OPEN || state == SlotState.CATCH_UP;
            boolean keyVisible = revealed && (finished || !submittable);
            builder.contentHtml(item.getContentHtml())
                    .slideId(item.getSlideId())
                    .questionId(item.getQuestionId())
                    .assessmentId(item.getAssessmentId())
                    .payloadJson(redactPayload(item.getPayloadJson(), keyVisible));
        }

        if (attempt != null) {
            // Same rule as the submit response: a hide-until-reveal question must not
            // confirm the outcome on a refresh either, or the redaction is theatre.
            boolean withholdResult =
                    Boolean.TRUE.equals(item.getHideResultUntilReveal()) && !revealed;
            builder.attemptStatus(attempt.getStatus())
                    .isCorrect(withholdResult ? null : attempt.getIsCorrect())
                    .resultPending(withholdResult)
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
        boolean withholdResult =
                Boolean.TRUE.equals(ctx.item.getHideResultUntilReveal()) && !revealed;
        return new EngagementSubmitResponse(
                attempt.getId(),
                attempt.getStatus(),
                withholdResult ? null : attempt.getIsCorrect(),
                attempt.getPointsAwarded(),
                attempt.getIsLate(),
                attempt.getIsVerified(),
                revealed,
                revealed ? readPayloadText(ctx.item.getPayloadJson(), "correctOptionId") : null,
                revealed ? readPayloadText(ctx.item.getPayloadJson(), "explanation") : null,
                pointsLedgerService.getSummary(instituteId, userId).getTotalPoints(),
                withholdResult);
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
