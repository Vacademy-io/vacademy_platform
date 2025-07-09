package vacademy.io.assessment_service.features.assessment.service.bulk_entry_services;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentBatchRegistration;
import vacademy.io.assessment_service.features.assessment.enums.AssessmentStatus;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentBatchRegistrationRepository;
import vacademy.io.common.auth.enums.CompanyStatus;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@Service
public class AssessmentBatchRegistrationService {

    @Autowired
    private AssessmentBatchRegistrationRepository repository;

    public void addMultipleRegistrations(List<AssessmentBatchRegistration> registrations) {
        repository.saveAll(registrations);
    }

    public boolean existsByInstituteAndAssessmentAndBatch(String instituteId, String assessmentId, String batchId) {
        return repository.existsByInstituteIdAndAssessmentIdAndBatchId(instituteId, assessmentId, batchId);
    }

    public void softDeleteRegistrationsByIds(List<String> ids, String instituteId, String assessmentId) {
        repository.softDeleteByIds(ids, instituteId, assessmentId);
    }

    public void hardDeleteRegistrationsByIds(List<String> ids, String instituteId, String assessmentId) {
        repository.hardDeleteByIds(ids, instituteId, assessmentId);
    }

    public Integer countAssessmentsForBatch(List<String> batchId, CustomUserDetails userDetails, String instituteId) {
        return repository.countDistinctAssessmentsByBatchAndFilters(batchId, instituteId, List.of(CompanyStatus.ACTIVE.name()), List.of(AssessmentStatus.PUBLISHED.name()));
    }
}
