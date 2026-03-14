package vacademy.io.admin_core_service.features.admission.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.admission.entity.AdmissionPipeline;
import vacademy.io.admin_core_service.features.admission.repository.AdmissionPipelineRepository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import vacademy.io.admin_core_service.features.admission.dto.PipelineUserListResponseDTO;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.common.auth.dto.ParentWithChildDTO;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Slf4j
public class AdmissionPipelineService {

    @Autowired
    private AdmissionPipelineRepository admissionPipelineRepository;

    @Autowired
    private AuthService authService;

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

    public Page<PipelineUserListResponseDTO> getPipelineUsersByStage(String instituteId, String packageSessionId, String stage, Pageable pageable) {
        Page<AdmissionPipeline> pipelinePage;
        if (StringUtils.hasText(packageSessionId)) {
            pipelinePage = admissionPipelineRepository.findByInstituteIdAndPackageSessionIdAndLeadStatus(instituteId, packageSessionId, stage, pageable);
        } else {
            pipelinePage = admissionPipelineRepository.findByInstituteIdAndLeadStatus(instituteId, stage, pageable);
        }

        // Collect distinct parent user IDs
        Set<String> parentUserIds = pipelinePage.getContent().stream()
                .map(AdmissionPipeline::getParentUserId)
                .filter(id -> StringUtils.hasText(id) && !"UNASSIGNED".equals(id))
                .collect(Collectors.toSet());

        // Fetch parent-child data from Auth Service
        Map<String, UserDTO> parentUserMap = new java.util.HashMap<>();
        Map<String, UserDTO> childUserMap = new java.util.HashMap<>();

        if (!parentUserIds.isEmpty()) {
            try {
                List<ParentWithChildDTO> parentWithChildList = authService.getUsersWithChildren(new java.util.ArrayList<>(parentUserIds));
                for (ParentWithChildDTO pc : parentWithChildList) {
                    if (pc.getParent() != null) {
                        parentUserMap.put(pc.getParent().getId(), pc.getParent());
                    }
                    if (pc.getChild() != null) {
                        childUserMap.put(pc.getChild().getId(), pc.getChild());
                    }
                }
            } catch (Exception e) {
                log.error("Failed to fetch users/children from auth service for pipeline users", e);
            }
        }

        return pipelinePage.map(pipeline -> {
            PipelineUserListResponseDTO dto = PipelineUserListResponseDTO.builder()
                    .pipelineId(pipeline.getId().toString())
                    .parentUserId(pipeline.getParentUserId())
                    .childUserId(pipeline.getChildUserId())
                    .currentStage(pipeline.getLeadStatus())
                    .sourceType(pipeline.getSourceType())
                    .enquiryDate(pipeline.getEnquiryDate())
                    .applicationDate(pipeline.getApplicationDate())
                    .admissionDate(pipeline.getAdmissionDate())
                    .enquiryId(pipeline.getEnquiryId())
                    .applicantId(pipeline.getApplicantId())
                    .build();

            // Populate Parent Details
            if (StringUtils.hasText(pipeline.getParentUserId()) && parentUserMap.containsKey(pipeline.getParentUserId())) {
                UserDTO parent = parentUserMap.get(pipeline.getParentUserId());
                dto.setParentName(parent.getFullName());
                dto.setParentEmail(parent.getEmail());
                dto.setParentPhone(parent.getMobileNumber());
            }

            // Populate Child Details
            if (StringUtils.hasText(pipeline.getChildUserId()) && childUserMap.containsKey(pipeline.getChildUserId())) {
                UserDTO child = childUserMap.get(pipeline.getChildUserId());
                dto.setStudentName(child.getFullName());
            }

            return dto;
        });
    }
}
