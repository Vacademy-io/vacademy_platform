package vacademy.io.admin_core_service.features.course.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.course.dto.AddCourseDTO;
import vacademy.io.admin_core_service.features.course.dto.AddFacultyToCourseDTO;
import vacademy.io.admin_core_service.features.faculty.service.FacultyService;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.learner_invitation.enums.LearnerInvitationSourceTypeEnum;
import vacademy.io.admin_core_service.features.learner_invitation.services.LearnerInvitationService;
import vacademy.io.admin_core_service.features.level.service.LevelService;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageInstituteRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.packages.service.PackageService;
import vacademy.io.admin_core_service.features.packages.service.PackageSessionService;
import vacademy.io.admin_core_service.features.session.dto.AddNewSessionDTO;
import vacademy.io.admin_core_service.features.session.service.SessionService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.PackageDTO;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.PackageInstitute;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.session.Session;

import java.util.*;
import java.util.stream.Collectors;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class CourseService {

    private final PackageRepository packageRepository;
    private final LevelService levelService;
    private final PackageSessionService packageSessionService;
    private final SessionService sessionService;
    private final PackageInstituteRepository packageInstituteRepository;
    private final InstituteRepository instituteRepository;
    private final PackageSessionRepository packageSessionRepository;
    private final LearnerInvitationService learnerInvitationService;
    private final FacultyService facultyService;
    private final PackageService packageService;

    @Transactional
    public String addCourse(AddCourseDTO addCourseDTO, CustomUserDetails user, String instituteId) {
        PackageEntity savedPackage;

        // Set created_by_user_id from user context if not already set in DTO
        if (!StringUtils.hasText(addCourseDTO.getCreatedByUserId()) && user != null) {
            addCourseDTO.setCreatedByUserId(user.getId());
        }

        if (addCourseDTO.getNewCourse()) {
            savedPackage = getCourse(addCourseDTO,instituteId);
        } else {
            savedPackage = packageRepository.findById(addCourseDTO.getId())
                    .orElseThrow(() -> new VacademyException("Package not found"));
            updateCourseDetails(addCourseDTO, savedPackage);
        }

        savedPackage = packageRepository.save(savedPackage);
        createPackageInstitute(savedPackage, instituteId);

        if (addCourseDTO.getContainLevels()) {
            createPackageSession(savedPackage, addCourseDTO.getSessions(), user, instituteId);
        } else {
            createPackageSessionForDefaultLevelAndSession(savedPackage, addCourseDTO.getAddFacultyToCourse(), instituteId, user);
        }

        return savedPackage.getId();
    }

    private void createPackageSessionForDefaultLevelAndSession(PackageEntity savedPackage,
                                                               List<AddFacultyToCourseDTO> addFacultyToCourseDTOS,
                                                               String instituteId,
                                                               CustomUserDetails user) {
        Level level = levelService.getLevelById("DEFAULT");
        Session session = sessionService.getSessionById("DEFAULT");
        packageSessionService.createPackageSession(level, session, savedPackage, null, new Date(), instituteId, user, addFacultyToCourseDTOS);
    }

    private void createPackageSession(PackageEntity savedPackage,
                                      List<AddNewSessionDTO> addNewSessionDTOS,
                                      CustomUserDetails user,
                                      String instituteId) {
        if (Objects.isNull(addNewSessionDTOS) || addNewSessionDTOS.isEmpty()) {
            throw new VacademyException("Levels and Sessions cannot be null or empty. You must provide at least one level.");
        }

        for (AddNewSessionDTO addNewSessionDTO : addNewSessionDTOS) {
            addNewSessionDTO.getLevels().forEach(level -> level.setPackageId(savedPackage.getId()));
            sessionService.addNewSession(addNewSessionDTO, instituteId, user);
        }
    }

    private void validateRequest(AddCourseDTO addCourseDTO) {
        if (Objects.isNull(addCourseDTO) || Objects.isNull(addCourseDTO.getCourseName())) {
            throw new VacademyException("Invalid request: Course name cannot be null");
        }
    }

    public PackageEntity getCourse(AddCourseDTO addCourseDTO,String instituteId) {
        validateRequest(addCourseDTO);
        Optional<PackageEntity>optionalPackageEntity = packageRepository.findTopByPackageNameAndSessionStatusAndInstitute(addCourseDTO.getCourseName(),
                List.of(PackageStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
                List.of(PackageStatusEnum.ACTIVE.name(), PackageStatusEnum.DRAFT.name()),
                instituteId);
        if (optionalPackageEntity.isPresent()) {
            return optionalPackageEntity.get();
        }
        PackageEntity packageEntity = new PackageEntity();
        packageEntity.setPackageName(addCourseDTO.getCourseName());
        packageEntity.setThumbnailFileId(addCourseDTO.getThumbnailFileId());
        
        // Set status - default to DRAFT for teacher approval workflow
        if (StringUtils.hasText(addCourseDTO.getStatus())) {
            packageEntity.setStatus(addCourseDTO.getStatus());
        } else {
            packageEntity.setStatus(PackageStatusEnum.ACTIVE.name());
        }
        
        // Set created by user ID for teacher approval workflow
        if (StringUtils.hasText(addCourseDTO.getCreatedByUserId())) {
            packageEntity.setCreatedByUserId(addCourseDTO.getCreatedByUserId());
        }
        
        // Set original course ID if this is a copy
        if (StringUtils.hasText(addCourseDTO.getOriginalCourseId())) {
            packageEntity.setOriginalCourseId(addCourseDTO.getOriginalCourseId());
        }
        
        // Set version number
        if (addCourseDTO.getVersionNumber() != null) {
            packageEntity.setVersionNumber(addCourseDTO.getVersionNumber());
        } else {
            packageEntity.setVersionNumber(1); // Default version
        }
        
        packageEntity.setIsCoursePublishedToCatalaouge(addCourseDTO.getIsCoursePublishedToCatalaouge());
        packageEntity.setCoursePreviewImageMediaId(addCourseDTO.getCoursePreviewImageMediaId());
        packageEntity.setCourseBannerMediaId(addCourseDTO.getCourseBannerMediaId());
        packageEntity.setCourseMediaId(addCourseDTO.getCourseMediaId());
        packageEntity.setWhyLearn(addCourseDTO.getWhyLearnHtml());
        packageEntity.setWhoShouldLearn(addCourseDTO.getWhoShouldLearnHtml());
        packageEntity.setAboutTheCourse(addCourseDTO.getAboutTheCourseHtml());

        if (addCourseDTO.getTags() != null && !addCourseDTO.getTags().isEmpty()) {
            packageEntity.setTags(addCourseDTO.getTags().stream()
                    .map(String::toLowerCase)
                    .map(String::trim)
                    .collect(Collectors.joining(",")));
        }

        packageEntity.setCourseDepth(addCourseDTO.getCourseDepth());
        packageEntity.setCourseHtmlDescription(addCourseDTO.getCourseHtmlDescription());
        return packageRepository.save(packageEntity);
    }

    public PackageEntity updateCourseDetails(AddCourseDTO addCourseDTO, PackageEntity packageEntity) {
        validateRequest(addCourseDTO);

        if (isNotBlank(addCourseDTO.getCourseName())) {
            packageEntity.setPackageName(addCourseDTO.getCourseName());
        }

        if (isNotBlank(addCourseDTO.getThumbnailFileId())) {
            packageEntity.setThumbnailFileId(addCourseDTO.getThumbnailFileId());
        }

        // Update status if provided
        if (StringUtils.hasText(addCourseDTO.getStatus())) {
            packageEntity.setStatus(addCourseDTO.getStatus());
        }
        
        // Update created by user ID if provided (usually shouldn't change, but for completeness)
        if (StringUtils.hasText(addCourseDTO.getCreatedByUserId())) {
            packageEntity.setCreatedByUserId(addCourseDTO.getCreatedByUserId());
        }
        
        // Update original course ID if provided (for copy operations)
        if (StringUtils.hasText(addCourseDTO.getOriginalCourseId())) {
            packageEntity.setOriginalCourseId(addCourseDTO.getOriginalCourseId());
        }
        
        // Update version number if provided
        if (addCourseDTO.getVersionNumber() != null) {
            packageEntity.setVersionNumber(addCourseDTO.getVersionNumber());
        }

        if (addCourseDTO.getIsCoursePublishedToCatalaouge() != null) {
            packageEntity.setIsCoursePublishedToCatalaouge(addCourseDTO.getIsCoursePublishedToCatalaouge());
        }

        if (isNotBlank(addCourseDTO.getCoursePreviewImageMediaId())) {
            packageEntity.setCoursePreviewImageMediaId(addCourseDTO.getCoursePreviewImageMediaId());
        }

        if (isNotBlank(addCourseDTO.getCourseBannerMediaId())) {
            packageEntity.setCourseBannerMediaId(addCourseDTO.getCourseBannerMediaId());
        }

        if (isNotBlank(addCourseDTO.getCourseMediaId())) {
            packageEntity.setCourseMediaId(addCourseDTO.getCourseMediaId());
        }

        if (isNotBlank(addCourseDTO.getWhyLearnHtml())) {
            packageEntity.setWhyLearn(addCourseDTO.getWhyLearnHtml());
        }

        if (isNotBlank(addCourseDTO.getWhoShouldLearnHtml())) {
            packageEntity.setWhoShouldLearn(addCourseDTO.getWhoShouldLearnHtml());
        }

        if (isNotBlank(addCourseDTO.getAboutTheCourseHtml())) {
            packageEntity.setAboutTheCourse(addCourseDTO.getAboutTheCourseHtml());
        }

        if (addCourseDTO.getTags() != null && !addCourseDTO.getTags().isEmpty()) {
            packageEntity.setTags(addCourseDTO.getTags().stream()
                    .map(String::toLowerCase)
                    .map(String::trim)
                    .collect(Collectors.joining(",")));
        }

        if (addCourseDTO.getCourseDepth() != null) {
            packageEntity.setCourseDepth(addCourseDTO.getCourseDepth());
        }

        if (isNotBlank(addCourseDTO.getCourseHtmlDescription())) {
            packageEntity.setCourseHtmlDescription(addCourseDTO.getCourseHtmlDescription());
        }

        return packageRepository.save(packageEntity);
    }

    private boolean isNotBlank(String str) {
        return str != null && !str.trim().isEmpty();
    }

    private PackageInstitute createPackageInstitute(PackageEntity packageEntity, String instituteId) {
        return packageInstituteRepository.findByPackageIdAndInstituteId(packageEntity.getId(), instituteId)
                .orElseGet(() -> {
                    PackageInstitute packageInstitute = new PackageInstitute();
                    packageInstitute.setPackageEntity(packageEntity);
                    packageInstitute.setInstituteEntity(instituteRepository.findById(instituteId)
                            .orElseThrow(() -> new VacademyException("Institute not found with ID: " + instituteId)));
                    return packageInstituteRepository.save(packageInstitute);
                });
    }

    public String updateCourse(PackageDTO packageDTO, CustomUserDetails user, String packageId) {
        PackageEntity packageEntity = packageRepository.findById(packageId)
                .orElseThrow(() -> new VacademyException("Course not found"));

        packageEntity.setPackageName(packageDTO.getPackageName());
        packageEntity.setThumbnailFileId(packageDTO.getThumbnailFileId());
        packageEntity.setIsCoursePublishedToCatalaouge(packageDTO.getIsCoursePublishedToCatalaouge());
        packageEntity.setCoursePreviewImageMediaId(packageDTO.getCoursePreviewImageMediaId());
        packageEntity.setCourseBannerMediaId(packageDTO.getCourseBannerMediaId());
        packageEntity.setCourseMediaId(packageDTO.getCourseMediaId());
        packageEntity.setWhyLearn(packageDTO.getWhyLearnHtml());
        packageEntity.setWhoShouldLearn(packageDTO.getWhoShouldLearnHtml());
        packageEntity.setAboutTheCourse(packageDTO.getAboutTheCourseHtml());

        if (packageDTO.getTags() != null && !packageDTO.getTags().isEmpty()) {
            packageEntity.setTags(packageDTO.getTags().stream()
                    .map(String::toLowerCase)
                    .map(String::trim)
                    .collect(Collectors.joining(",")));
        } else {
            packageEntity.setTags(null);
        }

        packageEntity.setCourseDepth(packageDTO.getCourseDepth());
        packageEntity.setCourseHtmlDescription(packageDTO.getCourseHtmlDescriptionHtml());

        packageRepository.save(packageEntity);
        return "Course updated successfully";
    }

    public String deleteCourses(List<String> courseIds, CustomUserDetails userDetails) {
        List<PackageEntity> courses = packageRepository.findAllById(courseIds);
        courses.forEach(course -> course.setStatus(PackageStatusEnum.DELETED.name()));
        packageRepository.saveAll(courses);

        List<PackageSession> packageSessions = packageSessionRepository.findAllByPackageIds(courseIds);
        List<String> packageSessionIds = new ArrayList<>();

        for (PackageSession packageSession : packageSessions) {
            packageSession.setStatus(PackageStatusEnum.DELETED.name());
            packageSessionIds.add(packageSession.getId());
        }

        packageSessionRepository.saveAll(packageSessions);
        learnerInvitationService.deleteLearnerInvitationBySourceAndSourceId(
                LearnerInvitationSourceTypeEnum.PACKAGE_SESSION.name(), packageSessionIds);

        return "Course deleted successfully";
    }

    public String addOrUpdateCourse(AddCourseDTO addCourseDTO,String instituteId,CustomUserDetails userDetails) {
        packageService.addOrUpdatePackage(addCourseDTO,instituteId,userDetails);
        return "done!!!";
    }
}
