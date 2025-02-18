package vacademy.io.admin_core_service.features.slide.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.slide.dto.SlideDetailWithOperationProjection;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.admin_core_service.features.slide.repository.SlideRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@Service
public class LearnerSlideService {
    @Autowired
    private SlideRepository slideRepository;

    public List<SlideDetailWithOperationProjection> getLearnerSlides(String userId, String chapterId, CustomUserDetails user) {
        return slideRepository.findSlideDetailsWithOperationByChapterId(userId, chapterId, SlideStatus.PUBLISHED.name());
    }
}
