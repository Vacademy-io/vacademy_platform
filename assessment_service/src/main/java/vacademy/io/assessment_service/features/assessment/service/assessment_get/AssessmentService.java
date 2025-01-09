package vacademy.io.assessment_service.features.assessment.service.assessment_get;

import org.hibernate.Session;
import org.hibernate.SessionFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;

import java.util.Optional;

@Service
public class AssessmentService {

    @Autowired private SessionFactory sessionFactory;

    @Autowired
    private AssessmentRepository assessmentRepository;

    public Optional<Assessment> getAssessmentWithActiveSections(String assessmentId, String instituteId) {
        if(assessmentId == null) return Optional.empty();

        Session session = sessionFactory.openSession();
        session.enableFilter("activeSections").setParameter("status", "ACTIVE");
        // Fetch the assessment with active sections
        // Assuming you have a repository method to find an assessment by ID
        return assessmentRepository.findByAssessmentIdAndInstituteId(assessmentId, instituteId);
    }
}
