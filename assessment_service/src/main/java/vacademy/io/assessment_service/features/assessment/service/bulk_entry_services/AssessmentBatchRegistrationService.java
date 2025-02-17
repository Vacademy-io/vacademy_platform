package vacademy.io.assessment_service.features.assessment.service.bulk_entry_services;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentBatchRegistration;
import vacademy.io.assessment_service.features.assessment.repository.AssessmentBatchRegistrationRepository;
import vacademy.io.common.auth.enums.CompanyStatus;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;

@Service
public class AssessmentBatchRegistrationService {

    @Autowired
    private AssessmentBatchRegistrationRepository repository;

    public void addMultipleRegistrations(List<AssessmentBatchRegistration> registrations) {
        repository.saveAll(registrations);
    }

    public void softDeleteRegistrationsByIds(List<String> ids, String instituteId, String assessmentId) {
        repository.softDeleteByIds(ids, instituteId, assessmentId);
    }

    public Integer countAssessmentsForBatch(String batchId, CustomUserDetails userDetails, String instituteId) {
        return repository.countDistinctAssessmentsByBatchAndFilters(batchId,instituteId,List.of(CompanyStatus.ACTIVE.name()));
    }
}
