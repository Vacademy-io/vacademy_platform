package vacademy.io.assessment_service.features.assessment.service.assessment_get;

import org.hibernate.Session;
import org.hibernate.SessionFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentInstituteMapping;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentStatus;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentInstituteMappingRepository;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Optional;

@Service
public class AssessmentService {

    @Autowired
    private SessionFactory sessionFactory;

    @Autowired
    private AssessmentRepository assessmentRepository;

    @Autowired
    private AssessmentInstituteMappingRepository assessmentInstituteMappingRepository;

    public Optional<Assessment> getAssessmentWithActiveSections(String assessmentId, String instituteId) {
        if (assessmentId == null) return Optional.empty();

        Session session = sessionFactory.openSession();
        session.enableFilter("activeSections").setParameter("status", "ACTIVE");
        // Fetch the assessment with active sections
        // Assuming you have a repository method to find an assessment by ID
        return assessmentRepository.findByAssessmentIdAndInstituteId(assessmentId, instituteId);
    }

    public ResponseEntity<String> deleteAssessment(CustomUserDetails user, String assessmentId, String instituteId) {
        Optional<AssessmentInstituteMapping> optionalAssessmentInstituteMapping = assessmentInstituteMappingRepository.findByAssessmentIdAndInstituteId(assessmentId, instituteId);
        if (optionalAssessmentInstituteMapping.isEmpty()) throw new VacademyException("Assessment Not Found");

        Assessment assessment = optionalAssessmentInstituteMapping.get().getAssessment();
        assessment.setStatus(AssessmentStatus.DELETED.name());
        assessmentRepository.save(assessment);

        return ResponseEntity.ok("Done");
    }
}
