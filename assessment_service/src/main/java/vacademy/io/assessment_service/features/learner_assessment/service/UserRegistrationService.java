package vacademy.io.assessment_service.features.learner_assessment.service;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentUserRegistration;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentBatchRegistrationRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentUserRegistrationRepository;

import java.util.Optional;

@Service
public class UserRegistrationService {

    @Autowired
    AssessmentUserRegistrationRepository assessmentUserRegistrationRepository;

    @Autowired
    AssessmentBatchRegistrationRepository assessmentBatchRegistrationRepository;

    public Optional<AssessmentUserRegistration> findByAssessmentIdAndUserId(String assessmentId, String userId) {
        return assessmentUserRegistrationRepository.findTopByUserIdAndAssessmentId(userId, assessmentId);
    }

}
