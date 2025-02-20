package vacademy.io.admin_core_service.features.learner_tracking.service;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_tracking.dto.LearnerActivityProjection;
import vacademy.io.admin_core_service.features.learner_tracking.repository.ActivityLogRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

@Service
@RequiredArgsConstructor
public class ActivityLogService {

    private final ActivityLogRepository activityLogRepository;

    public Page<LearnerActivityProjection> getStudentActivityBySlide(String slideId, int page, int size, CustomUserDetails user) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("lastActive").descending());
        return activityLogRepository.findStudentActivityBySlideId(slideId, pageable);
    }
}
