package vacademy.io.admin_core_service.features.admission.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.admission.entity.AdmissionPipeline;
import vacademy.io.admin_core_service.features.admission.repository.AdmissionPipelineRepository;

import java.util.Date;
import java.util.Optional;

@Service
@Slf4j
public class AdmissionPipelineService {

    @Autowired
    private AdmissionPipelineRepository admissionPipelineRepository;

    public void recordEnquiry(String instituteId, String packageSessionId, String parentUserId, String childUserId, String enquiryId, String sourceType) {
        if (!StringUtils.hasText(enquiryId)) {
            return;
        }
        
        // Prevent late-bound SQL transaction exception by sanitizing inputs 
        packageSessionId = StringUtils.hasText(packageSessionId) ? packageSessionId : "UNASSIGNED";
        parentUserId = StringUtils.hasText(parentUserId) ? parentUserId : "UNASSIGNED";
        childUserId = StringUtils.hasText(childUserId) ? childUserId : "UNASSIGNED";

        try {
            Optional<AdmissionPipeline> existing = admissionPipelineRepository.findByEnquiryId(enquiryId);
            if (existing.isPresent()) {
                return;
            }

            AdmissionPipeline pipeline = AdmissionPipeline.builder()
                    .instituteId(instituteId)
                    .packageSessionId(packageSessionId)
                    .parentUserId(parentUserId)
                    .childUserId(childUserId)
                    .enquiryId(enquiryId)
                    .leadStatus("ENQUIRY")
                    .sourceType(sourceType)
                    .enquiryDate(new Date())
                    .build();

            admissionPipelineRepository.save(pipeline);
            log.info("Pipeline: Recorded new Enquiry - {}", enquiryId);

        } catch (Exception e) {
            log.error("Pipeline Tracking Error: Failed to record enquiry {}", enquiryId, e);
        }
    }

    public void recordApplication(String instituteId, String packageSessionId, String parentUserId, String childUserId, String enquiryId, String applicantId, String sourceType) {
        if (!StringUtils.hasText(applicantId)) {
            return;
        }
        
        // Prevent late-bound SQL transaction exception by sanitizing inputs 
        packageSessionId = StringUtils.hasText(packageSessionId) ? packageSessionId : "UNASSIGNED";
        parentUserId = StringUtils.hasText(parentUserId) ? parentUserId : "UNASSIGNED";
        childUserId = StringUtils.hasText(childUserId) ? childUserId : "UNASSIGNED";

        try {
            AdmissionPipeline pipeline = null;

            if (StringUtils.hasText(enquiryId)) {
                pipeline = admissionPipelineRepository.findByEnquiryId(enquiryId).orElse(null);
            }

            if (pipeline == null && StringUtils.hasText(applicantId)) {
                pipeline = admissionPipelineRepository.findByApplicantId(applicantId).orElse(null);
            }

            if (pipeline == null && StringUtils.hasText(childUserId) && StringUtils.hasText(instituteId)) {
                pipeline = admissionPipelineRepository.findByChildUserIdAndInstituteId(childUserId, instituteId).orElse(null);
            }

            if (pipeline != null) {
                pipeline.setApplicantId(applicantId);
                if (!"ADMITTED".equals(pipeline.getLeadStatus())) {
                    pipeline.setLeadStatus("APPLICATION");
                    if (pipeline.getApplicationDate() == null) {
                        pipeline.setApplicationDate(new Date());
                    }
                }
            } else {
                pipeline = AdmissionPipeline.builder()
                        .instituteId(instituteId)
                        .packageSessionId(packageSessionId)
                        .parentUserId(parentUserId)
                        .childUserId(childUserId)
                        .applicantId(applicantId)
                        .leadStatus("APPLICATION")
                        .sourceType(sourceType != null ? sourceType : "MANUAL")
                        .applicationDate(new Date())
                        .build();
            }

            admissionPipelineRepository.save(pipeline);
            log.info("Pipeline: Recorded Application - {}", applicantId);

        } catch (Exception e) {
            log.error("Pipeline Tracking Error: Failed to record application {}", applicantId, e);
        }
    }

    public void recordAdmission(String instituteId, String packageSessionId, String parentUserId, String childUserId, String enquiryId, String applicantId, String sourceType) {
        if (!StringUtils.hasText(childUserId)) {
            return;
        }
        
        // Prevent late-bound SQL transaction exception by sanitizing inputs 
        packageSessionId = StringUtils.hasText(packageSessionId) ? packageSessionId : "UNASSIGNED";
        parentUserId = StringUtils.hasText(parentUserId) ? parentUserId : "UNASSIGNED";
        childUserId = StringUtils.hasText(childUserId) ? childUserId : "UNASSIGNED";

        try {
            AdmissionPipeline pipeline = null;

            if (StringUtils.hasText(applicantId)) {
                pipeline = admissionPipelineRepository.findByApplicantId(applicantId).orElse(null);
            }

            if (pipeline == null && StringUtils.hasText(enquiryId)) {
                pipeline = admissionPipelineRepository.findByEnquiryId(enquiryId).orElse(null);
            }

            if (pipeline == null && StringUtils.hasText(childUserId) && StringUtils.hasText(instituteId)) {
                pipeline = admissionPipelineRepository.findByChildUserIdAndInstituteId(childUserId, instituteId).orElse(null);
            }

            if (pipeline != null) {
                pipeline.setLeadStatus("ADMITTED");
                if (pipeline.getAdmissionDate() == null) {
                    pipeline.setAdmissionDate(new Date());
                }
            } else {
                pipeline = AdmissionPipeline.builder()
                        .instituteId(instituteId)
                        .packageSessionId(packageSessionId)
                        .parentUserId(parentUserId)
                        .childUserId(childUserId)
                        .leadStatus("ADMITTED")
                        .sourceType(sourceType != null ? sourceType : "MANUAL")
                        .admissionDate(new Date())
                        .build();
            }

            admissionPipelineRepository.save(pipeline);
            log.info("Pipeline: Recorded Admission for Student User - {}", childUserId);

        } catch (Exception e) {
            log.error("Pipeline Tracking Error: Failed to record admission for student {}", childUserId, e);
        }
    }
}
