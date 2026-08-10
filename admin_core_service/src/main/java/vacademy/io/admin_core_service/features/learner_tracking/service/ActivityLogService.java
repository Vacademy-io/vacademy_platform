package vacademy.io.admin_core_service.features.learner_tracking.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerSessionStatusEnum;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.LearnerActivityProjection;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.ActivityLogAccessDeniedException;
import vacademy.io.common.exceptions.ResourceNotFoundException;

import java.sql.Timestamp;
import java.util.List;
import java.util.Objects;

@Slf4j
@Service
@RequiredArgsConstructor
public class ActivityLogService {

    private final ActivityLogRepository activityLogRepository;

    public Page<LearnerActivityProjection> getStudentActivityBySlide(String slideId, String packageSessionId, String search, int page, int size, CustomUserDetails user) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("lastActive").descending());
        // Scope the activity list to learners enrolled in this batch. A slide is shared across
        // multiple batches (chapter_package_session_mapping), so filtering by slideId alone leaks
        // learners from other batches. ENROLLED = ACTIVE + INACTIVE (matches the batch learner count).
        List<String> statusList = List.of(
                LearnerSessionStatusEnum.ACTIVE.name(),
                LearnerSessionStatusEnum.INACTIVE.name());
        // Search runs in SQL, not on the current page: the client only ever holds one page, so a
        // client-side filter can never find a learner sitting on a later page. Blank means no filter.
        String searchTerm = StringUtils.hasText(search) ? search.trim() : null;
        return activityLogRepository.findStudentActivityBySlideId(slideId, packageSessionId, searchTerm, statusList, pageable);
    }

    // Clients generate the activity id, so save() is an upsert: an id that
    // already exists is merged, not inserted. The same guards as
    // LearnerTrackingService.saveActivityLog therefore apply here — without
    // them any authenticated learner could pass another learner's activity id
    // and overwrite (or re-parent) that row, taking its tracked responses
    // with it. userId must be the authenticated principal, never a request
    // parameter.
    public ActivityLog saveActivityLog(ActivityLogDTO activityLogDTO, String userId, String slideId) {
        if (StringUtils.hasText(activityLogDTO.getId())) {
            ActivityLog existing = activityLogRepository.findById(activityLogDTO.getId()).orElse(null);
            if (existing != null) {
                if (!Objects.equals(existing.getUserId(), userId)) {
                    log.warn("User {} attempted to write activity {} owned by {}", userId, existing.getId(),
                            existing.getUserId());
                    throw new ActivityLogAccessDeniedException(existing.getId());
                }
                if (StringUtils.hasText(existing.getSlideId()) && !existing.getSlideId().equals(slideId)) {
                    log.warn("Refusing to re-parent activity {} from slide {} to slide {} (user {}). "
                            + "Keeping the original slide; the client sent a stale slideId.",
                            existing.getId(), existing.getSlideId(), slideId, userId);
                    updateActivityFields(existing, activityLogDTO);
                    return activityLogRepository.save(existing);
                }
            }
        }
        return activityLogRepository.save(new ActivityLog(activityLogDTO, userId, slideId));
    }

    // activityId comes from the client; the resolved row must belong to the
    // caller before it is mutated (its tracked responses are deleted and
    // replaced by every per-type service that calls this).
    public ActivityLog updateActivityLog(ActivityLogDTO activityLogDTO, String userId) {
        ActivityLog activityLog = activityLogRepository.findById(activityLogDTO.getId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Activity log " + activityLogDTO.getId() + " not found"));
        if (!Objects.equals(activityLog.getUserId(), userId)) {
            log.warn("User {} attempted to update activity {} owned by {}", userId, activityLog.getId(),
                    activityLog.getUserId());
            throw new ActivityLogAccessDeniedException(activityLog.getId());
        }
        updateActivityFields(activityLog, activityLogDTO);
        return activityLogRepository.save(activityLog);
    }

    private void updateActivityFields(ActivityLog activityLog, ActivityLogDTO activityLogDTO) {
        if (activityLogDTO.getStartTimeInMillis() != null) {
            activityLog.setStartTime(new Timestamp(activityLogDTO.getStartTimeInMillis()));
        }
        if (activityLogDTO.getEndTimeInMillis() != null) {
            activityLog.setEndTime(new Timestamp(activityLogDTO.getEndTimeInMillis()));
        }
        if (activityLogDTO.getPercentageWatched() != null) {
            activityLog.setPercentageWatched(activityLogDTO.getPercentageWatched());
        }
    }
}
