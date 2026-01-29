package vacademy.io.admin_core_service.features.applicant.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.applicant.dto.ApplicantDTO;
import vacademy.io.admin_core_service.features.applicant.dto.ApplicantFilterDTO;
import vacademy.io.admin_core_service.features.applicant.dto.ApplicationStageDTO;
import vacademy.io.admin_core_service.features.applicant.entity.Applicant;
import vacademy.io.admin_core_service.features.applicant.entity.ApplicantStage;
import vacademy.io.admin_core_service.features.applicant.entity.ApplicationStage;
import vacademy.io.admin_core_service.features.applicant.repository.ApplicantRepository;
import vacademy.io.admin_core_service.features.applicant.repository.ApplicantStageRepository;
import vacademy.io.admin_core_service.features.applicant.repository.ApplicationStageRepository;
import vacademy.io.common.exceptions.VacademyException;
import java.util.UUID;
import java.util.Optional;

@Service
public class ApplicantService {

        @Autowired
        private ApplicantRepository applicantRepository;

        @Autowired
        private ApplicationStageRepository applicationStageRepository;

        @Autowired
        private ApplicantStageRepository applicantStageRepository;

        /**
         * Create a new Application Stage configuration
         */
        @Transactional
        public String createApplicationStage(ApplicationStageDTO stageDTO) {
                ApplicationStage stage = ApplicationStage.builder()
                                .stageName(stageDTO.getStageName())
                                .sequence(stageDTO.getSequence())
                                .source(stageDTO.getSource())
                                .sourceId(stageDTO.getSourceId())
                                .instituteId(stageDTO.getInstituteId())
                                .configJson(stageDTO.getConfigJson())
                                .type(stageDTO.getType())
                                .build();

                return applicationStageRepository.save(stage).getId().toString();
        }

        /**
         * Onboard a new Applicant for a given Application Stage
         */
        @Transactional
        public String onboardApplicant(ApplicantDTO applicantDTO) {
                // Validate that the application stage exists
                ApplicationStage appStage = applicationStageRepository
                                .findById(java.util.UUID.fromString(applicantDTO.getApplicationStageId()))
                                .orElseThrow(() -> new VacademyException("Application Stage not found"));

                // Create Applicant
                // Helper: Generate a random tracking ID for now (Placeholder for Auth User ID)
                String temporaryTrackingId = java.util.UUID.randomUUID().toString();

                Applicant applicant = Applicant.builder()
                                .trackingId(temporaryTrackingId)
                                .applicationStageId(applicantDTO.getApplicationStageId())
                                .applicationStageStatus(applicantDTO.getApplicationStageStatus())
                                .overallStatus(applicantDTO.getOverallStatus())
                                .build();

                Applicant savedApplicant = applicantRepository.save(applicant);

                // Create initial Applicant Stage entry
                // Note: For now we create one entry linked to the main stage.
                // In valid flow, there might be multiple steps (stages) derived from the main
                // config.
                ApplicantStage applicantStage = ApplicantStage.builder()
                                .applicantId(savedApplicant.getId().toString())
                                .stageId(appStage.getId().toString())
                                .stageStatus("INITIATED")
                                .build();

                applicantStageRepository.save(applicantStage);

                return savedApplicant.getId().toString();
        }

        /**
         * Get Applicants based on filters (institute, source, sourceId)
         */
        public Page<ApplicantDTO> getApplicants(ApplicantFilterDTO filterDTO) {
                Pageable pageable = PageRequest.of(
                                filterDTO.getPage() != null ? filterDTO.getPage() : 0,
                                filterDTO.getSize() != null ? filterDTO.getSize() : 20,
                                Sort.by(Sort.Direction.DESC, "createdAt"));

                Page<Applicant> applicants = applicantRepository.findApplicantsWithFilters(
                                filterDTO.getInstituteId(),
                                filterDTO.getSource(),
                                filterDTO.getSourceId(),
                                pageable);

                // Batch fetch Application Stages to avoid N+1
                java.util.Set<UUID> stageIds = applicants.stream()
                                .map(a -> UUID.fromString(a.getApplicationStageId()))
                                .collect(java.util.stream.Collectors.toSet());

                java.util.Map<String, ApplicationStage> stageMap = applicationStageRepository.findAllById(stageIds)
                                .stream()
                                .collect(java.util.stream.Collectors.toMap(
                                                s -> s.getId().toString(),
                                                s -> s));

                return applicants.map(applicant -> {
                        ApplicantDTO dto = new ApplicantDTO(applicant);
                        ApplicationStage stage = stageMap.get(applicant.getApplicationStageId());
                        if (stage != null) {
                                dto.setSourceDetails(stage.getSource(), stage.getSourceId());
                        }
                        return dto;
                });
        }

        /**
         * Get Application Stages based on filters
         */
        public java.util.List<ApplicationStageDTO> getApplicationStages(String instituteId, String source,
                        String sourceId) {
                return applicationStageRepository.findByFilters(instituteId, source, sourceId)
                                .stream()
                                .map(stage -> new ApplicationStageDTO(stage))
                                .collect(java.util.stream.Collectors.toList());
        }
}
