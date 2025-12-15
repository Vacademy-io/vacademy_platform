package vacademy.io.admin_core_service.features.packages.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.chapter.enums.ChapterStatus;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.course.dto.AddCourseDTO;
import vacademy.io.admin_core_service.features.faculty.enums.FacultyStatusEnum;
import vacademy.io.admin_core_service.features.level.enums.LevelStatusEnum;
import vacademy.io.admin_core_service.features.packages.dto.LearnerPackageFilterDTO;
import vacademy.io.admin_core_service.features.packages.dto.PackageDetailDTO;
import vacademy.io.admin_core_service.features.packages.dto.PackageDetailProjection;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.session.dto.AddNewSessionDTO;
import vacademy.io.admin_core_service.features.session.service.SessionService;
import vacademy.io.admin_core_service.features.slide.enums.QuestionStatusEnum;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.standard_classes.ListService;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.PackageEntity;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class PackageService {

    @Autowired
    private PackageRepository packageRepository;

    @Autowired
    private AuthService authService;

    @Autowired
    private SessionService sessionService;

    public Page<PackageDetailDTO> getcourseCatalogDetail(
            LearnerPackageFilterDTO learnerPackageFilterDTO,
            String instituteId,
            int pageNo,
            int pageSize) {

        Sort thisSort = ListService.createSortObject(learnerPackageFilterDTO.getSortColumns());
        Pageable pageable = PageRequest.of(pageNo, pageSize, thisSort);
        Page<PackageDetailProjection> learnerPackageDetail = null;
        if (StringUtils.hasText(learnerPackageFilterDTO.getSearchByName())) {
            learnerPackageDetail = packageRepository.getCatalogPackageDetail(
                    learnerPackageFilterDTO.getSearchByName(),
                    learnerPackageFilterDTO.getFacultyIds(),
                    instituteId,
                    List.of(PackageStatusEnum.ACTIVE.name()),
                    learnerPackageFilterDTO.getPackageTypes(),
                    List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
                    List.of(LevelStatusEnum.ACTIVE.name()),
                    List.of(StatusEnum.ACTIVE.name()),
                    List.of(StatusEnum.ACTIVE.name()),
                    List.of(QuestionStatusEnum.ACTIVE.name()),
                    List.of(QuestionStatusEnum.ACTIVE.name()),
                    List.of(SlideStatus.DRAFT.name(), SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()),
                    List.of(ChapterStatus.ACTIVE.name()),
                    pageable);
        } else {
            learnerPackageDetail = packageRepository.getCatalogPackageDetail(
                    instituteId,
                    learnerPackageFilterDTO.getLevelIds(),
                    List.of(PackageStatusEnum.ACTIVE.name()),
                    learnerPackageFilterDTO.getPackageTypes(),
                    List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
                    learnerPackageFilterDTO.getFacultyIds(),
                    List.of(StatusEnum.ACTIVE.name()),
                    learnerPackageFilterDTO.getTag(),
                    List.of(LevelStatusEnum.ACTIVE.name()),
                    List.of(StatusEnum.ACTIVE.name()),
                    List.of(QuestionStatusEnum.ACTIVE.name()),
                    List.of(QuestionStatusEnum.ACTIVE.name()),
                    List.of(SlideStatus.DRAFT.name(), SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()),
                    List.of(ChapterStatus.ACTIVE.name()),
                    pageable);
        }

        // Get all instructor userIds
        List<String> instructorIds = learnerPackageDetail.getContent().stream()
                .map(PackageDetailProjection::getFacultyUserIds)
                .filter(Objects::nonNull)
                .flatMap(List::stream)
                .distinct()
                .collect(Collectors.toList());

        // Fetch instructor details
        List<UserDTO> userDTOS = authService.getUsersFromAuthServiceByUserIds(instructorIds);
        Map<String, UserDTO> userMap = userDTOS.stream().collect(Collectors.toMap(UserDTO::getId, Function.identity()));

        // Map projections to DTOs
        List<PackageDetailDTO> dtos = learnerPackageDetail.getContent().stream().map(projection -> {
            List<UserDTO> instructors = Optional.ofNullable(projection.getFacultyUserIds())
                    .orElse(List.of()).stream()
                    .map(userMap::get)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());

            return new PackageDetailDTO(
                    projection.getId(),
                    projection.getPackageName(),
                    projection.getThumbnailFileId(),
                    projection.getIsCoursePublishedToCatalaouge(),
                    projection.getCoursePreviewImageMediaId(),
                    projection.getCourseBannerMediaId(),
                    projection.getCourseMediaId(),
                    projection.getWhyLearnHtml(),
                    projection.getWhoShouldLearnHtml(),
                    projection.getAboutTheCourseHtml(),
                    projection.getCommaSeparetedTags(),
                    projection.getCourseDepth(),
                    projection.getCourseHtmlDescriptionHtml(),
                    projection.getPercentageCompleted(),
                    projection.getRating(),
                    projection.getPackageSessionId(),
                    projection.getLevelId(),
                    projection.getLevelName(),
                    projection.getDripConditionJson(),
                    instructors,
                    projection.getLevelIds(),
                    projection.getReadTimeInMinutes(),
                    projection.getPackageType());
        }).toList();

        return new PageImpl<>(dtos, pageable, learnerPackageDetail.getTotalElements());
    }

    public PackageDetailDTO getPackageDetailById(
            String packageId) {
        Optional<PackageDetailProjection> optionalProjection = packageRepository
                .getPackageDetailByIdWithSessionAndFacultyStatus(packageId,
                        List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
                        List.of(FacultyStatusEnum.ACTIVE.name()), List.of(StatusEnum.ACTIVE.name()));

        if (optionalProjection.isEmpty()) {
            throw new VacademyException("Package not found");
        }

        PackageDetailProjection projection = optionalProjection.get();

        // Fetch instructor details if available
        List<String> instructorIds = Optional.ofNullable(projection.getFacultyUserIds())
                .orElse(List.of());

        List<UserDTO> userDTOS = authService.getUsersFromAuthServiceByUserIds(instructorIds);
        Map<String, UserDTO> userMap = userDTOS.stream()
                .collect(Collectors.toMap(UserDTO::getId, Function.identity()));

        List<UserDTO> instructors = instructorIds.stream()
                .map(userMap::get)
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        PackageDetailDTO dto = new PackageDetailDTO(
                projection.getId(),
                projection.getPackageName(),
                projection.getThumbnailFileId(),
                projection.getIsCoursePublishedToCatalaouge(),
                projection.getCoursePreviewImageMediaId(),
                projection.getCourseBannerMediaId(),
                projection.getCourseMediaId(),
                projection.getWhyLearnHtml(),
                projection.getWhoShouldLearnHtml(),
                projection.getAboutTheCourseHtml(),
                projection.getCommaSeparetedTags(),
                projection.getCourseDepth(),
                projection.getCourseHtmlDescriptionHtml(),
                projection.getPercentageCompleted(),
                projection.getRating(),
                projection.getPackageSessionId(),
                projection.getLevelId(),
                projection.getLevelName(),
                projection.getDripConditionJson(),
                instructors,
                projection.getLevelIds(),
                projection.getReadTimeInMinutes(),
                projection.getPackageType());

        return dto;
    }

    public void addOrUpdatePackage(AddCourseDTO addCourseDTO, String instituteId, CustomUserDetails userDetails) {
        PackageEntity packageEntity;

        // Set created_by_user_id from user context if not already set in DTO
        if (!StringUtils.hasText(addCourseDTO.getCreatedByUserId()) && userDetails != null) {
            addCourseDTO.setCreatedByUserId(userDetails.getId());
        }

        if (addCourseDTO.getNewCourse()) {
            packageEntity = getCourse(addCourseDTO, instituteId);
        } else {
            packageEntity = packageRepository.findById(addCourseDTO.getId())
                    .orElseThrow(() -> new VacademyException("Package not found"));
            updateCourse(addCourseDTO, packageEntity);
        }
        for (AddNewSessionDTO addNewSessionDTO : addCourseDTO.getSessions()) {
            sessionService.addOrUpdateSession(addNewSessionDTO, packageEntity, instituteId, userDetails);
        }
    }

    public PackageEntity getCourse(AddCourseDTO addCourseDTO, String instituteId) {
        Optional<PackageEntity> optionalPackageEntity = packageRepository
                .findTopByPackageNameAndSessionStatusAndInstitute(addCourseDTO.getCourseName(),
                        List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
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

    public void updateCourse(AddCourseDTO addCourseDTO, PackageEntity packageEntity) {
        if (addCourseDTO == null || packageEntity == null) {
            return;
        }

        // Directly overwrite every field — even if null or empty
        packageEntity.setPackageName(addCourseDTO.getCourseName());
        packageEntity.setThumbnailFileId(addCourseDTO.getThumbnailFileId());
        packageEntity.setStatus(addCourseDTO.getStatus());
        packageEntity.setCreatedByUserId(addCourseDTO.getCreatedByUserId());
        packageEntity.setOriginalCourseId(addCourseDTO.getOriginalCourseId());
        packageEntity.setVersionNumber(addCourseDTO.getVersionNumber());
        packageEntity.setIsCoursePublishedToCatalaouge(addCourseDTO.getIsCoursePublishedToCatalaouge());
        packageEntity.setCoursePreviewImageMediaId(addCourseDTO.getCoursePreviewImageMediaId());
        packageEntity.setCourseBannerMediaId(addCourseDTO.getCourseBannerMediaId());
        packageEntity.setCourseMediaId(addCourseDTO.getCourseMediaId());
        packageEntity.setWhyLearn(addCourseDTO.getWhyLearnHtml());
        packageEntity.setWhoShouldLearn(addCourseDTO.getWhoShouldLearnHtml());
        packageEntity.setAboutTheCourse(addCourseDTO.getAboutTheCourseHtml());
        packageEntity.setCourseDepth(addCourseDTO.getCourseDepth());
        packageEntity.setCourseHtmlDescription(addCourseDTO.getCourseHtmlDescription());

        // Handle tags safely — even if null
        if (addCourseDTO.getTags() != null) {
            packageEntity.setTags(addCourseDTO.getTags().stream()
                    .map(String::toLowerCase)
                    .map(String::trim)
                    .collect(Collectors.joining(",")));
        } else {
            packageEntity.setTags(null);
        }

        packageRepository.save(packageEntity);
    }

}
