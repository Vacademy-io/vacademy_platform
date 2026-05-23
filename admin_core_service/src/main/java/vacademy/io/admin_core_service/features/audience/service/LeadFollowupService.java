package vacademy.io.admin_core_service.features.audience.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.audience.dto.CloseLeadFollowupRequest;
import vacademy.io.admin_core_service.features.audience.dto.CreateLeadFollowupRequest;
import vacademy.io.admin_core_service.features.audience.dto.LeadFollowupDto;
import vacademy.io.admin_core_service.features.audience.dto.UpdateLeadFollowupRequest;
import vacademy.io.admin_core_service.features.audience.entity.Audience;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;
import vacademy.io.admin_core_service.features.audience.entity.LeadFollowup;
import vacademy.io.admin_core_service.features.audience.enums.LeadFollowupStatus;
import vacademy.io.admin_core_service.features.audience.repository.AudienceRepository;
import vacademy.io.admin_core_service.features.audience.repository.AudienceResponseRepository;
import vacademy.io.admin_core_service.features.audience.repository.LeadFollowupRepository;
import vacademy.io.admin_core_service.features.timeline.service.TimelineEventService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class LeadFollowupService {

    private final LeadFollowupRepository leadFollowupRepository;
    private final TimelineEventService timelineEventService;
    private final AudienceResponseRepository audienceResponseRepository;
    private final AudienceRepository audienceRepository;

    @Transactional
    public LeadFollowupDto create(CreateLeadFollowupRequest request, CustomUserDetails user) {
        String instituteId = resolveInstituteId(request.getAudienceResponseId(), request.getInstituteId());

        LeadFollowup followup = LeadFollowup.builder()
                .audienceResponseId(request.getAudienceResponseId())
                .instituteId(instituteId)
                .createdBy(user.getUserId())
                .scheduleTime(request.getScheduleTime())
                .content(request.getContent())
                .build();

        LeadFollowup saved = leadFollowupRepository.save(followup);

        String studentUserId = audienceResponseRepository.findById(request.getAudienceResponseId())
                .map(AudienceResponse::getUserId)
                .orElse(null);

        timelineEventService.logEvent(
                "LEAD", request.getAudienceResponseId(),
                "FOLLOWUP_SCHEDULED",
                "ADMIN", user.getUserId(), user.getUsername(),
                "Follow-up scheduled",
                request.getContent(),
                Map.of("followupId", saved.getId(), "scheduleTime", String.valueOf(request.getScheduleTime())),
                studentUserId
        );

        return LeadFollowupDto.from(saved);
    }

    @Transactional(readOnly = true)
    public List<LeadFollowupDto> listForLead(String audienceResponseId) {
        return leadFollowupRepository
                .findByAudienceResponseIdOrderByScheduleTimeAsc(audienceResponseId)
                .stream()
                .map(LeadFollowupDto::from)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<LeadFollowupDto> myPending(CustomUserDetails user) {
        return leadFollowupRepository
                .findByCreatedByAndIsClosedFalseOrderByScheduleTimeAsc(user.getUserId())
                .stream()
                .map(LeadFollowupDto::from)
                .collect(Collectors.toList());
    }

    @Transactional
    public LeadFollowupDto update(String id, UpdateLeadFollowupRequest request) {
        LeadFollowup followup = findOrThrow(id);
        if (Boolean.TRUE.equals(followup.getIsClosed())) {
            throw new VacademyException("Cannot update a closed follow-up");
        }
        if (request.getScheduleTime() != null) followup.setScheduleTime(request.getScheduleTime());
        if (request.getContent() != null) followup.setContent(request.getContent());
        return LeadFollowupDto.from(leadFollowupRepository.save(followup));
    }

    @Transactional
    public LeadFollowupDto close(String id, CloseLeadFollowupRequest request, CustomUserDetails user) {
        LeadFollowup followup = findOrThrow(id);
        if (Boolean.TRUE.equals(followup.getIsClosed())) {
            throw new VacademyException("Follow-up is already closed");
        }

        String status = LeadFollowupStatus.COMPLETED.name();

        Timestamp now = new Timestamp(System.currentTimeMillis());
        followup.setStatus(status);
        followup.setIsClosed(true);
        followup.setCloserReason(request.getCloserReason());
        followup.setClosedBy(user.getUserId());
        followup.setClosedAt(now);

        LeadFollowup saved = leadFollowupRepository.save(followup);

        String studentUserId = audienceResponseRepository.findById(followup.getAudienceResponseId())
                .map(AudienceResponse::getUserId)
                .orElse(null);

        timelineEventService.logEvent(
                "LEAD", followup.getAudienceResponseId(),
                "FOLLOWUP_CLOSED",
                "ADMIN", user.getUserId(), user.getUsername(),
                "Follow-up " + status.toLowerCase(),
                request.getCloserReason(),
                Map.of("followupId", id, "status", status),
                studentUserId
        );

        return LeadFollowupDto.from(saved);
    }

    private LeadFollowup findOrThrow(String id) {
        return leadFollowupRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Follow-up not found: " + id));
    }

    /** Derive instituteId from the audience response chain when the caller didn't supply it. */
    private String resolveInstituteId(String audienceResponseId, String providedInstituteId) {
        if (providedInstituteId != null && !providedInstituteId.isBlank()) {
            return providedInstituteId;
        }
        return audienceResponseRepository.findById(audienceResponseId)
                .map(AudienceResponse::getAudienceId)
                .flatMap(audienceRepository::findById)
                .map(Audience::getInstituteId)
                .orElseThrow(() -> new VacademyException("Cannot resolve institute for response: " + audienceResponseId));
    }
}
