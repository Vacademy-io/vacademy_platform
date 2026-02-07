package vacademy.io.admin_core_service.features.subject.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_study_library.dto.LearnerModuleDTOWithDetails;
import vacademy.io.admin_core_service.features.module.service.LearnerModuleDetailsService;
import vacademy.io.admin_core_service.features.subject.dto.SubjectDTOWithDetails;
import vacademy.io.admin_core_service.features.subject.repository.SubjectRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.institute.dto.SubjectDTO;
import vacademy.io.common.institute.entity.student.Subject;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class LearnerSubjectService {
    private final SubjectRepository subjectRepository;
    private final LearnerModuleDetailsService learnerModuleDetailsService;

    @org.springframework.transaction.annotation.Transactional(readOnly = true)
    public List<SubjectDTOWithDetails> subjectDTOWithDetails(String packageSessionId, String userId,
            CustomUserDetails user) {
        List<Subject> subjects = subjectRepository.findDistinctSubjectsByPackageSessionId(packageSessionId);
        List<SubjectDTOWithDetails> subjectDTOWithDetailsList = new ArrayList<>();
        for (Subject subject : subjects) {
            List<LearnerModuleDTOWithDetails> moduleDTOWithDetails = learnerModuleDetailsService
                    .getModulesDetailsWithChapters(subject.getId(), packageSessionId, userId, user);
            SubjectDTOWithDetails subjectDTOWithDetails = new SubjectDTOWithDetails();
            subjectDTOWithDetails.setModules(moduleDTOWithDetails);
            subjectDTOWithDetails.setSubjectDTO(new SubjectDTO(subject));
            subjectDTOWithDetailsList.add(subjectDTOWithDetails);
        }
        return subjectDTOWithDetailsList;
    }
}
