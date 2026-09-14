package vacademy.io.admin_core_service.features.engagement.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.engagement.dto.EngagementItemDTO;
import vacademy.io.admin_core_service.features.engagement.dto.EngagementItemRequest;
import vacademy.io.admin_core_service.features.engagement.dto.EngagementPlanDTO;
import vacademy.io.admin_core_service.features.engagement.dto.EngagementPlanRequest;
import vacademy.io.admin_core_service.features.engagement.dto.EngagementSlotDTO;
import vacademy.io.admin_core_service.features.engagement.dto.EngagementSlotRequest;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementAttempt;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementEnums;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementItem;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementPlan;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementSlot;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementAttemptRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementItemRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementPlanRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementSlotRepository;
import vacademy.io.admin_core_service.features.institute.service.InstituteTimezoneService;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/** Teacher/admin authoring: plans, slots, items. */
@Service
@RequiredArgsConstructor
@Slf4j
public class EngagementPlanService {

    private final EngagementPlanRepository planRepository;
    private final EngagementSlotRepository slotRepository;
    private final EngagementItemRepository itemRepository;
    private final EngagementAttemptRepository attemptRepository;
    private final InstituteTimezoneService instituteTimezoneService;
    private final EngagementScheduleResolver scheduleResolver;

    /**
     * Create the plan for every batch named in the request.
     *
     * A plan stays scoped to one batch — this writes one plan per id rather than
     * widening the schema — so the feed, tracking and leaderboards keep working
     * exactly as before. Returns one DTO per batch.
     */
    @Transactional
    public List<EngagementPlanDTO> createPlans(EngagementPlanRequest request, String instituteId,
                                               String userId) {
        List<String> targets = new ArrayList<>();
        if (request.getPackageSessionIds() != null) {
            for (String id : request.getPackageSessionIds()) {
                if (id != null && !id.isBlank() && !targets.contains(id)) targets.add(id);
            }
        }
        if (targets.isEmpty() && request.getPackageSessionId() != null
                && !request.getPackageSessionId().isBlank()) {
            targets.add(request.getPackageSessionId());
        }
        if (targets.isEmpty()) {
            throw new VacademyException("At least one batch is required");
        }

        List<EngagementPlanDTO> created = new ArrayList<>();
        for (String packageSessionId : targets) {
            // createPlan reads the batch off the request, so point it at each target in
            // turn. Slot/item ids in the payload are null on create, so every batch gets
            // its own rows rather than sharing them.
            request.setPackageSessionId(packageSessionId);
            created.add(createPlan(request, instituteId, userId));
        }
        return created;
    }

    @Transactional
    public EngagementPlanDTO createPlan(EngagementPlanRequest request, String instituteId, String userId) {
        if (request.getPackageSessionId() == null || request.getPackageSessionId().isBlank()) {
            throw new VacademyException("packageSessionId is required");
        }
        if (request.getTitle() == null || request.getTitle().isBlank()) {
            throw new VacademyException("title is required");
        }

        EngagementPlan plan = new EngagementPlan();
        plan.setInstituteId(instituteId);
        plan.setPackageSessionId(request.getPackageSessionId());
        plan.setTitle(request.getTitle());
        plan.setDescription(request.getDescription());
        plan.setSubjectId(request.getSubjectId());
        plan.setStatus(safeStatus(request.getStatus()));
        // Snapshot, not a live read — see EngagementPlan.timezone.
        plan.setTimezone(instituteTimezoneService.getTimezoneId(instituteId));
        plan.setDefaultMissPolicy(safeMissPolicy(request.getDefaultMissPolicy()));
        plan.setDefaultCatchUpDays(request.getDefaultCatchUpDays());
        plan.setDefaultCatchUpPercent(request.getDefaultCatchUpPercent());
        plan.setCreatedByUserId(userId);
        plan.setUpdatedAt(now());
        plan = planRepository.save(plan);

        if (request.getSlots() != null) {
            for (EngagementSlotRequest slotRequest : request.getSlots()) {
                upsertSlot(plan, slotRequest);
            }
        }
        return getPlan(plan.getId(), instituteId);
    }

    @Transactional
    public EngagementPlanDTO updatePlan(String planId, EngagementPlanRequest request, String instituteId) {
        EngagementPlan plan = requirePlan(planId, instituteId);
        if (request.getTitle() != null) plan.setTitle(request.getTitle());
        if (request.getDescription() != null) plan.setDescription(request.getDescription());
        if (request.getSubjectId() != null) plan.setSubjectId(request.getSubjectId());
        if (request.getStatus() != null) plan.setStatus(safeStatus(request.getStatus()));
        if (request.getDefaultMissPolicy() != null) {
            plan.setDefaultMissPolicy(safeMissPolicy(request.getDefaultMissPolicy()));
        }
        if (request.getDefaultCatchUpDays() != null) plan.setDefaultCatchUpDays(request.getDefaultCatchUpDays());
        if (request.getDefaultCatchUpPercent() != null) {
            plan.setDefaultCatchUpPercent(request.getDefaultCatchUpPercent());
        }
        plan.setUpdatedAt(now());
        planRepository.save(plan);

        if (request.getSlots() != null) {
            for (EngagementSlotRequest slotRequest : request.getSlots()) {
                upsertSlot(plan, slotRequest);
            }
        }
        return getPlan(planId, instituteId);
    }

    @Transactional
    public void deletePlan(String planId, String instituteId) {
        EngagementPlan plan = requirePlan(planId, instituteId);
        plan.setStatus(EngagementEnums.PlanStatus.DELETED.name());
        plan.setUpdatedAt(now());
        planRepository.save(plan);
    }

    @Transactional
    public EngagementSlotDTO upsertSlot(String planId, EngagementSlotRequest request, String instituteId) {
        EngagementPlan plan = requirePlan(planId, instituteId);
        EngagementSlot slot = upsertSlot(plan, request);
        return toSlotDto(plan, slot);
    }

    @Transactional
    public void deleteSlot(String slotId, String instituteId) {
        EngagementSlot slot = slotRepository.findById(slotId)
                .orElseThrow(() -> new VacademyException("Slot not found"));
        requirePlan(slot.getPlanId(), instituteId);
        slot.setStatus(EngagementEnums.SlotStatus.DELETED.name());
        slot.setUpdatedAt(now());
        slotRepository.save(slot);
    }

    @Transactional(readOnly = true)
    public EngagementPlanDTO getPlan(String planId, String instituteId) {
        EngagementPlan plan = requirePlan(planId, instituteId);
        List<EngagementSlotDTO> slots = new ArrayList<>();
        for (EngagementSlot slot : slotRepository.findActiveByPlan(planId)) {
            slots.add(toSlotDto(plan, slot));
        }
        return toPlanDto(plan, slots);
    }

    @Transactional(readOnly = true)
    public List<EngagementPlanDTO> listPlans(String instituteId, String packageSessionId) {
        List<EngagementPlan> plans = (packageSessionId == null || packageSessionId.isBlank())
                ? planRepository.findByInstitute(instituteId)
                : planRepository.findByPackageSession(packageSessionId);
        List<EngagementPlanDTO> out = new ArrayList<>();
        for (EngagementPlan plan : plans) {
            if (!Objects.equals(plan.getInstituteId(), instituteId)) continue;
            out.add(toPlanDto(plan, List.of()));
        }
        return out;
    }

    // ── internals ────────────────────────────────────────────────────────────

    private EngagementSlot upsertSlot(EngagementPlan plan, EngagementSlotRequest request) {
        EngagementSlot slot = (request.getId() == null || request.getId().isBlank())
                ? new EngagementSlot()
                : slotRepository.findById(request.getId())
                    .orElseThrow(() -> new VacademyException("Slot not found"));

        slot.setPlanId(plan.getId());
        slot.setTitle(request.getTitle());
        slot.setStartDate(parseDate(request.getStartDate(), "startDate"));
        slot.setEndDate(request.getEndDate() == null || request.getEndDate().isBlank()
                ? null : parseDate(request.getEndDate(), "endDate"));
        slot.setStartTime(parseTime(request.getStartTime(), "startTime"));
        slot.setEndTime(parseTime(request.getEndTime(), "endTime"));
        slot.setDowMask(request.getDowMask());
        slot.setRevealTime(request.getRevealTime() == null || request.getRevealTime().isBlank()
                ? null : parseTime(request.getRevealTime(), "revealTime"));
        slot.setNotifyTime(request.getNotifyTime() == null || request.getNotifyTime().isBlank()
                ? null : parseTime(request.getNotifyTime(), "notifyTime"));
        slot.setSortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder());
        slot.setUpdatedAt(now());

        validateSlot(slot);
        slot = slotRepository.save(slot);

        if (request.getItems() != null) {
            // Track what this call actually wrote, so anything else still active in the
            // slot can be retired below without guessing from timestamps.
            Set<String> touched = new HashSet<>();
            for (EngagementItemRequest itemRequest : request.getItems()) {
                touched.add(upsertItem(plan, slot, itemRequest));
            }
            retireItemsNotIn(slot, touched);
        }
        return slot;
    }

    /**
     * Soft-delete the slot's items this save did not write.
     *
     * An edit that removes a task has to remove it for learners too — otherwise the
     * composer shows three tasks, the teacher deletes one, saves, and learners keep
     * seeing all three. Attempts are left untouched: points already earned stay
     * earned and the tracking row stays readable.
     */
    private void retireItemsNotIn(EngagementSlot slot, Set<String> touchedItemIds) {
        for (EngagementItem existing : itemRepository.findActiveBySlot(slot.getId())) {
            if (touchedItemIds.contains(existing.getId())) continue;
            existing.setStatus(EngagementEnums.ItemStatus.DELETED.name());
            existing.setUpdatedAt(now());
            itemRepository.save(existing);
            log.info("[engagement] item {} removed from slot {} by an edit",
                    existing.getId(), slot.getId());
        }
    }

    /**
     * Create or update an item.
     *
     * An item that has ALREADY OPENED and been attempted is never edited in place:
     * the existing row is RETIRED and a new version is written. Attempts pin to the
     * version they were made against, so a teacher fixing a typo at noon cannot
     * retroactively invalidate the morning's scores.
     */
    private String upsertItem(EngagementPlan plan, EngagementSlot slot, EngagementItemRequest request) {
        boolean isNew = request.getId() == null || request.getId().isBlank();
        EngagementItem existing = isNew ? null : itemRepository.findById(request.getId())
                .orElseThrow(() -> new VacademyException("Item not found"));

        if (existing != null && hasOpenedAndBeenAttempted(plan, slot, existing)) {
            existing.setStatus(EngagementEnums.ItemStatus.RETIRED.name());
            existing.setUpdatedAt(now());
            itemRepository.save(existing);

            EngagementItem replacement = new EngagementItem();
            applyItemRequest(replacement, request, slot);
            replacement.setVersion(existing.getVersion() + 1);
            itemRepository.save(replacement);
            log.info("[engagement] item {} edited after open — retired, new version {} created",
                    existing.getId(), replacement.getVersion());
            return replacement.getId();
        }

        EngagementItem item = existing == null ? new EngagementItem() : existing;
        applyItemRequest(item, request, slot);
        if (existing != null) item.setVersion(existing.getVersion());
        return itemRepository.save(item).getId();
    }

    private void applyItemRequest(EngagementItem item, EngagementItemRequest request, EngagementSlot slot) {
        EngagementEnums.ItemType type = safeItemType(request.getItemType());
        item.setSlotId(slot.getId());
        item.setItemType(type.name());
        item.setTitle(request.getTitle() == null ? type.name() : request.getTitle());
        item.setSortOrder(request.getSortOrder() == null ? 0 : request.getSortOrder());
        item.setIsRequired(Boolean.TRUE.equals(request.getIsRequired()));
        item.setContentHtml(request.getContentHtml());
        item.setSlideId(request.getSlideId());
        item.setQuestionId(request.getQuestionId());
        item.setAssessmentId(request.getAssessmentId());
        item.setPayloadJson(request.getPayloadJson());
        item.setCompletionPoints(request.getCompletionPoints() == null ? 0 : request.getCompletionPoints());
        item.setCorrectPoints(request.getCorrectPoints() == null ? 0 : request.getCorrectPoints());
        item.setMaxScore(request.getMaxScore());
        // Only types the SERVER can grade are verifiable. A teacher-uploaded game
        // reports its own score and anyone with devtools can report any number.
        // Verifiable = the SERVER can decide the outcome itself. A course slide
        // qualifies: its completion is read from the learner's own progress, not
        // reported by the page.
        item.setIsVerifiable(type == EngagementEnums.ItemType.QUESTION_OF_DAY
                || type == EngagementEnums.ItemType.QUIZ
                || type == EngagementEnums.ItemType.COURSE_SLIDE);
        item.setMissPolicy(request.getMissPolicy() == null ? null : safeMissPolicy(request.getMissPolicy()));
        item.setCatchUpDays(request.getCatchUpDays());
        item.setCatchUpPercent(request.getCatchUpPercent());
        item.setStatus(EngagementEnums.ItemStatus.ACTIVE.name());
        item.setUpdatedAt(now());
    }

    private boolean hasOpenedAndBeenAttempted(EngagementPlan plan, EngagementSlot slot, EngagementItem item) {
        LocalDate today = LocalDate.now(scheduleResolver.zoneOf(plan));
        LocalDate lastRun = scheduleResolver.mostRecentRunDate(slot, today);
        if (lastRun == null) return false;
        boolean hasOpened = scheduleResolver.stateOn(plan, slot, item, lastRun)
                != EngagementScheduleResolver.SlotState.UPCOMING;
        if (!hasOpened) return false;
        return !attemptRepository.findByItem(item.getId()).isEmpty();
    }

    private EngagementPlan requirePlan(String planId, String instituteId) {
        EngagementPlan plan = planRepository.findById(planId)
                .orElseThrow(() -> new VacademyException("Plan not found"));
        // Cross-tenant guard: a plan id from another institute must not be readable.
        if (!Objects.equals(plan.getInstituteId(), instituteId)) {
            throw new VacademyException("Plan not found");
        }
        return plan;
    }

    private EngagementPlanDTO toPlanDto(EngagementPlan plan, List<EngagementSlotDTO> slots) {
        return EngagementPlanDTO.builder()
                .id(plan.getId())
                .instituteId(plan.getInstituteId())
                .packageSessionId(plan.getPackageSessionId())
                .title(plan.getTitle())
                .description(plan.getDescription())
                .subjectId(plan.getSubjectId())
                .status(plan.getStatus())
                .timezone(plan.getTimezone())
                .defaultMissPolicy(plan.getDefaultMissPolicy())
                .defaultCatchUpDays(plan.getDefaultCatchUpDays())
                .defaultCatchUpPercent(plan.getDefaultCatchUpPercent())
                .createdByUserId(plan.getCreatedByUserId())
                .createdAt(plan.getCreatedAt() == null ? null : plan.getCreatedAt().toInstant().toString())
                .slots(slots)
                .build();
    }

    private EngagementSlotDTO toSlotDto(EngagementPlan plan, EngagementSlot slot) {
        List<EngagementItemDTO> items = new ArrayList<>();
        for (EngagementItem item : itemRepository.findActiveBySlot(slot.getId())) {
            items.add(EngagementItemDTO.builder()
                    .id(item.getId())
                    .slotId(slot.getId())
                    .planId(plan.getId())
                    .packageSessionId(plan.getPackageSessionId())
                    .itemType(item.getItemType())
                    .title(item.getTitle())
                    .version(item.getVersion())
                    .sortOrder(item.getSortOrder())
                    .isRequired(item.getIsRequired())
                    // Admin view is unredacted — the teacher authored this content.
                    .contentHtml(item.getContentHtml())
                    .slideId(item.getSlideId())
                    .questionId(item.getQuestionId())
                    .assessmentId(item.getAssessmentId())
                    .payloadJson(item.getPayloadJson())
                    .completionPoints(item.getCompletionPoints())
                    .correctPoints(item.getCorrectPoints())
                    .maxScore(item.getMaxScore())
                    .completedCount(attemptRepository.countCompletedForItem(item.getId()))
                    .build());
        }
        return EngagementSlotDTO.builder()
                .id(slot.getId())
                .planId(slot.getPlanId())
                .title(slot.getTitle())
                .startDate(slot.getStartDate().toString())
                .endDate(slot.getEndDate() == null ? null : slot.getEndDate().toString())
                .startTime(slot.getStartTime().toString())
                .endTime(slot.getEndTime().toString())
                .dowMask(slot.getDowMask())
                .revealTime(slot.getRevealTime() == null ? null : slot.getRevealTime().toString())
                .notifyTime(slot.getNotifyTime() == null ? null : slot.getNotifyTime().toString())
                .sortOrder(slot.getSortOrder())
                .status(slot.getStatus())
                .items(items)
                .build();
    }

    private String safeStatus(String raw) {
        if (raw == null || raw.isBlank()) return EngagementEnums.PlanStatus.DRAFT.name();
        try {
            return EngagementEnums.PlanStatus.valueOf(raw).name();
        } catch (Exception e) {
            throw new VacademyException("Unknown plan status: " + raw);
        }
    }

    private String safeMissPolicy(String raw) {
        try {
            return EngagementEnums.MissPolicy.valueOf(raw).name();
        } catch (Exception e) {
            throw new VacademyException("Unknown miss policy: " + raw);
        }
    }

    private EngagementEnums.ItemType safeItemType(String raw) {
        try {
            return EngagementEnums.ItemType.valueOf(raw);
        } catch (Exception e) {
            throw new VacademyException("Unknown item type: " + raw);
        }
    }

    private LocalDate parseDate(String raw, String field) {
        try {
            return LocalDate.parse(raw);
        } catch (Exception e) {
            throw new VacademyException(field + " must be yyyy-MM-dd");
        }
    }

    private LocalTime parseTime(String raw, String field) {
        try {
            return LocalTime.parse(raw);
        } catch (Exception e) {
            throw new VacademyException(field + " must be HH:mm");
        }
    }

    private Timestamp now() {
        return new Timestamp(System.currentTimeMillis());
    }
}
