package vacademy.io.admin_core_service.features.learner_tracking.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_tracking.dto.ActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.dto.LearnerActivityProjection;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Timestamp;

@Service
@RequiredArgsConstructor
public class ActivityLogService {

    private final ActivityLogRepository activityLogRepository;

    public Page<LearnerActivityProjection> getStudentActivityBySlide(String slideId, int page, int size, CustomUserDetails user) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("lastActive").descending());
        return activityLogRepository.findStudentActivityBySlideId(slideId, pageable);
    }

    public ActivityLog saveActivityLog(ActivityLogDTO activityLogDTO,String userId,String slideId) {
        ActivityLog activityLog = new ActivityLog(activityLogDTO, userId, slideId);
        return activityLogRepository.save(activityLog);
    }

    public ActivityLog updateActivityLog(ActivityLogDTO activityLogDTO) {
        ActivityLog activityLog = activityLogRepository.findById(activityLogDTO.getId())
                .orElseThrow(() -> new VacademyException("Activity Log not found"));
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
