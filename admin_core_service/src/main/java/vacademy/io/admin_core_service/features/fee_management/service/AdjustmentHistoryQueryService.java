package vacademy.io.admin_core_service.features.fee_management.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.fee_management.dto.AdjustmentHistoryDTO;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeeAdjustmentHistory;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeeAdjustmentHistoryRepository;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Read-side service for adjustment history — powers the "History" tab in the
 * AdjustmentDialog. DB-level pagination so installments with thousands of
 * events don't load the whole list at once.
 */
@Service
public class AdjustmentHistoryQueryService {

    @Autowired
    private StudentFeeAdjustmentHistoryRepository adjustmentHistoryRepository;

    @Autowired
    private AuthService authService;

    @Transactional(readOnly = true)
    public Page<AdjustmentHistoryDTO> getHistoryForInstallment(
            String studentFeePaymentId, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<StudentFeeAdjustmentHistory> eventsPage = adjustmentHistoryRepository
                .findByStudentFeePaymentIdOrderByCreatedAtDesc(studentFeePaymentId, pageable);

        if (eventsPage.isEmpty()) {
            return eventsPage.map(e -> toDTO(e, null));
        }

        List<String> actorIds = eventsPage.getContent().stream()
                .map(StudentFeeAdjustmentHistory::getActorUserId)
                .filter(id -> id != null && !id.isBlank() && !"MIGRATION".equals(id))
                .distinct()
                .collect(Collectors.toList());

        Map<String, UserDTO> userMap;
        try {
            userMap = actorIds.isEmpty()
                    ? Map.of()
                    : authService.getUsersFromAuthServiceByUserIds(actorIds).stream()
                            .collect(Collectors.toMap(UserDTO::getId, Function.identity(), (a, b) -> a));
        } catch (Exception e) {
            userMap = Map.of();
        }

        final Map<String, UserDTO> resolved = userMap;
        return eventsPage.map(event -> {
            UserDTO actor = resolved.get(event.getActorUserId());
            String actorName = actor != null
                    ? actor.getFullName()
                    : ("MIGRATION".equals(event.getActorUserId()) ? "System (migration)" : null);
            return toDTO(event, actorName);
        });
    }

    private AdjustmentHistoryDTO toDTO(StudentFeeAdjustmentHistory e, String actorName) {
        return AdjustmentHistoryDTO.builder()
                .id(e.getId())
                .studentFeePaymentId(e.getStudentFeePaymentId())
                .eventType(e.getEventType())
                .adjustmentType(e.getAdjustmentType())
                .amount(e.getAmount())
                .reason(e.getReason())
                .resultingStatus(e.getResultingStatus())
                .actorUserId(e.getActorUserId())
                .actorName(actorName)
                .actorRole(e.getActorRole())
                .previousEventId(e.getPreviousEventId())
                .metadata(e.getMetadata())
                .createdAt(e.getCreatedAt())
                .build();
    }
}
