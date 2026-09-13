package vacademy.io.admin_core_service.features.engagement.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.engagement.dto.EngagementTrackingDTO;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementAttempt;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementItem;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementPlan;
import vacademy.io.admin_core_service.features.engagement.entity.EngagementSlot;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementAttemptRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementItemRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementPlanRepository;
import vacademy.io.admin_core_service.features.engagement.repository.EngagementSlotRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

/** Read-only tracking for teachers: who did what on an item. */
@Service
@RequiredArgsConstructor
@Slf4j
public class EngagementTrackingService {

    private final EngagementItemRepository itemRepository;
    private final EngagementSlotRepository slotRepository;
    private final EngagementPlanRepository planRepository;
    private final EngagementAttemptRepository attemptRepository;

    @Transactional(readOnly = true)
    public EngagementTrackingDTO getItemTracking(String itemId, String instituteId) {
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

        List<EngagementTrackingDTO.Row> rows = new ArrayList<>();
        for (EngagementAttempt attempt : attemptRepository.findByItem(itemId)) {
            rows.add(new EngagementTrackingDTO.Row(
                    attempt.getUserId(),
                    attempt.getStatus(),
                    attempt.getIsCorrect(),
                    attempt.getScore() == null ? null : attempt.getScore().doubleValue(),
                    attempt.getPointsAwarded(),
                    attempt.getIsLate(),
                    attempt.getTimeSpentMs(),
                    attempt.getCompletedAt() == null ? null : attempt.getCompletedAt().toInstant().toString()));
        }

        return new EngagementTrackingDTO(
                item.getId(),
                item.getTitle(),
                item.getItemType(),
                attemptRepository.countCompletedForItem(itemId),
                attemptRepository.countCorrectForItem(itemId),
                rows);
    }
}
