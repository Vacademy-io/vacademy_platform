package vacademy.io.admin_core_service.features.audience.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.entity.Audience;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.entity.LeadStatus;
import vacademy.io.admin_core_service.features.audience.entity.LeadStatusHistory;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.audience.repository.LeadStatusHistoryRepository;
import vacademy.io.admin_core_service.features.audience.repository.LeadStatusRepository;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Mirrors a user's conversion-status change onto every audience_response they own within the
 * institute (audience_response.lead_status_id), keeping the leads list — which reads
 * lead_status_id first — in sync with a side-view status change, and recording a
 * lead_status_history row per response so the change shows up in the disposition report.
 *
 * <p>This lives in its own bean, separate from {@link UserLeadProfileService}, purely so the
 * mirror can run in a {@link Propagation#REQUIRES_NEW REQUIRES_NEW} transaction. That is what
 * makes it genuinely best-effort: if a mirror write fails, only this inner transaction rolls
 * back — the caller's primary conversion_status update is untouched. Were this a private method
 * on the caller (as it was originally), a failing statement would mark the caller's shared
 * transaction rollback-only, and the caller's own try/catch could not save it — the commit would
 * still throw UnexpectedRollbackException ("Transaction silently rolled back…").</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LeadStatusMirrorService {

    private final LeadStatusRepository leadStatusRepository;
    private final AudienceResponseRepository audienceResponseRepository;
    private final AudienceRepository audienceRepository;
    private final LeadStatusHistoryRepository leadStatusHistoryRepository;

    /**
     * Push the user's chosen conversion status down onto every audience_response they own within
     * the institute, by resolving the matching lead_status catalog row and stamping its id on
     * audience_response.lead_status_id, plus a lead_status_history row per updated response.
     *
     * <p>Update-only: never creates anything if the status_key has no catalog row or the user has
     * no responses in this institute. Per-response triggers are NOT re-emitted; the caller's
     * profile-level LEAD_STATUS_CHANGED event already records this change at the correct grain.</p>
     *
     * <p>Runs in its own REQUIRES_NEW transaction so a failure here cannot roll back the caller's
     * conversion_status update — the caller wraps this in a best-effort try/catch.</p>
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void syncResponsesLeadStatus(String userId, String instituteId, String statusKey, String actorUserId) {
        LeadStatus target = leadStatusRepository.findByInstituteIdAndStatusKey(instituteId, statusKey).orElse(null);
        if (target == null) return;

        List<AudienceResponse> responses = audienceResponseRepository.findByUserIdOrStudentUserId(userId, userId);
        if (responses.isEmpty()) return;

        // Responses carry audienceId, not instituteId — resolve the institute per response so
        // we only touch rows belonging to THIS institute (a user can be a lead in several).
        Set<String> audienceIds = responses.stream()
                .map(AudienceResponse::getAudienceId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<String, String> audienceToInstitute = audienceIds.isEmpty() ? Collections.emptyMap()
                : audienceRepository.findAllById(audienceIds).stream()
                        .collect(Collectors.toMap(Audience::getId, Audience::getInstituteId, (a, b) -> a));

        List<AudienceResponse> toUpdate = responses.stream()
                .filter(r -> instituteId.equals(audienceToInstitute.get(r.getAudienceId())))
                .filter(r -> !target.getId().equals(r.getLeadStatusId()))
                .collect(Collectors.toList());

        if (toUpdate.isEmpty()) return;

        List<LeadStatusHistory> historyRecords = toUpdate.stream()
                .map(r -> LeadStatusHistory.builder()
                        .audienceResponseId(r.getId())
                        .instituteId(instituteId)
                        .fromStatusId(r.getLeadStatusId())
                        .toStatusId(target.getId())
                        .changedByUserId(actorUserId)
                        .source("MANUAL")
                        .build())
                .collect(Collectors.toList());

        toUpdate.forEach(r -> r.setLeadStatusId(target.getId()));
        audienceResponseRepository.saveAll(toUpdate);
        leadStatusHistoryRepository.saveAll(historyRecords);
    }
}
