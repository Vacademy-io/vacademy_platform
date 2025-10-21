package vacademy.io.admin_core_service.features.enroll_invite.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.enroll_invite.dto.CoursePreviewResponseDTO;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

@Slf4j
@Service
public class EnrollInviteCoursePreviewService {

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private InstituteRepository instituteRepository;

    public String createPreview(String packageSessionId,String instituteId) {
        try {
            // Find the package session by ID
            Optional<PackageSession> packageSessionOpt = packageSessionRepository.findById(packageSessionId);
            if (packageSessionOpt.isEmpty()) {
                throw new VacademyException("Package session not found with ID: " + packageSessionId);
            }

            PackageSession packageSession = packageSessionOpt.get();
            PackageEntity packageEntity = packageSession.getPackageEntity();

            // Create the course preview response DTO
            CoursePreviewResponseDTO previewResponse = new CoursePreviewResponseDTO();

            // Map package entity fields to response DTO
            previewResponse.setCourse(packageEntity.getPackageName());
            previewResponse.setDescription(packageEntity.getCourseHtmlDescription());
            previewResponse.setLearningOutcome(packageEntity.getWhyLearn());
            previewResponse.setAboutCourse(packageEntity.getAboutTheCourse());
            previewResponse.setTargetAudience(packageEntity.getWhoShouldLearn());
            previewResponse.setCoursePreview(packageEntity.getCoursePreviewImageMediaId());
            previewResponse.setCourseBanner(packageEntity.getCourseBannerMediaId());

            // Set course media
            CoursePreviewResponseDTO.CourseMediaDTO courseMedia = new CoursePreviewResponseDTO.CourseMediaDTO();
            courseMedia.setType(""); // Default empty type
            courseMedia.setId(packageEntity.getCourseMediaId());
            previewResponse.setCourseMedia(courseMedia);

            // Set blob fields (same as media IDs for now)
            previewResponse.setCoursePreviewBlob(packageEntity.getCoursePreviewImageMediaId());
            previewResponse.setCourseBannerBlob(packageEntity.getCourseBannerMediaId());
            previewResponse.setCourseMediaBlob(packageEntity.getCourseMediaId());

            // Parse tags from comma-separated string
            if (StringUtils.hasText(packageEntity.getTags())) {
                List<String> tagsList = Arrays.asList(packageEntity.getTags().split(","));
                previewResponse.setTags(tagsList.stream()
                        .map(String::trim)
                        .filter(StringUtils::hasText)
                        .toList());
            } else {
                previewResponse.setTags(List.of());
            }
            Institute instituteEntity = instituteRepository.findById(instituteId).orElseThrow(() -> new VacademyException("Institute not found with ID: " + instituteId));
            // Set default boolean values
            previewResponse.setShowRelatedCourses(false);
            previewResponse.setIncludeInstituteLogo(true);
            previewResponse.setInstituteLogoFileId(instituteEntity.getLogoFileId()); // Default logo ID
            previewResponse.setRestrictToSameBatch(false);
            previewResponse.setIncludePaymentPlans(true);
            previewResponse.setCustomHtml("");

            // Convert to JSON string
            return objectMapper.writeValueAsString(previewResponse);

        } catch (Exception e) {
            log.error("Error creating course preview for packageSessionId: {}", packageSessionId, e);
            throw new VacademyException("Failed to create course preview: " + e.getMessage());
        }
    }
}
