package vacademy.io.admin_core_service.features.packages.service;

import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.chapter.enums.ChapterStatus;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.faculty.enums.FacultyStatusEnum;
import vacademy.io.admin_core_service.features.level.enums.LevelStatusEnum;
import vacademy.io.admin_core_service.features.packages.dto.*;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.slide.enums.QuestionStatusEnum;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.core.standard_classes.ListService;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class OpenPackageService {
        @Autowired
        private PackageRepository packageRepository;

        @Autowired
        private AuthService authService;

        @Transactional
        public Page<PackageDetailDTO> getLearnerPackageDetail(
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
                                        instituteId,
                                        List.of(PackageStatusEnum.ACTIVE.name()),
                                        learnerPackageFilterDTO.getPackageTypes(),
                                        List.of(PackageSessionStatusEnum.ACTIVE.name(),
                                                        PackageSessionStatusEnum.HIDDEN.name()),
                                        List.of(LevelStatusEnum.ACTIVE.name()),
                                        List.of(StatusEnum.ACTIVE.name()),
                                        List.of(StatusEnum.ACTIVE.name()),
                                        List.of(QuestionStatusEnum.ACTIVE.name()),
                                        List.of(QuestionStatusEnum.ACTIVE.name()),
                                        List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()),
                                        List.of(ChapterStatus.ACTIVE.name()),
                                        pageable);
                } else {
                        learnerPackageDetail = packageRepository.getOpenCatalogPackageDetail(
                                        instituteId,
                                        learnerPackageFilterDTO.getLevelIds(),
                                        List.of(PackageStatusEnum.ACTIVE.name()),
                                        learnerPackageFilterDTO.getPackageTypes(),
                                        List.of(PackageSessionStatusEnum.ACTIVE.name(),
                                                        PackageSessionStatusEnum.HIDDEN.name()),
                                        learnerPackageFilterDTO.getFacultyIds(),
                                        List.of(StatusEnum.ACTIVE.name()),
                                        learnerPackageFilterDTO.getTag(),
                                        List.of(LevelStatusEnum.ACTIVE.name()),
                                        List.of(StatusEnum.ACTIVE.name()),
                                        List.of(QuestionStatusEnum.ACTIVE.name()),
                                        List.of(QuestionStatusEnum.ACTIVE.name()),
                                        List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()),
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
                Map<String, UserDTO> userMap = userDTOS.stream()
                                .collect(Collectors.toMap(UserDTO::getId, Function.identity()));

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
                                        projection.getReadTimeInMinutes(), projection.getPackageType());
                }).toList();

                return new PageImpl<>(dtos, pageable, learnerPackageDetail.getTotalElements());
        }

        public PackageDetailDTO getPackageDetailById(
                        String packageId) {
                Optional<PackageDetailProjection> optionalProjection = packageRepository
                                .getPackageDetailByIdWithSessionAndFacultyStatus(packageId,
                                                List.of(PackageSessionStatusEnum.ACTIVE.name(),
                                                                PackageSessionStatusEnum.HIDDEN.name()),
                                                List.of(FacultyStatusEnum.ACTIVE.name()),
                                                List.of(StatusEnum.ACTIVE.name()));

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
                                getReadTimeInMinutes(packageId),
                                projection.getPackageType());

                return dto;
        }

        @Transactional
        public Page<PackageDetailV2DTO> getLearnerPackageDetailV2(
                        LearnerPackageFilterDTO learnerPackageFilterDTO,
                        String instituteId,
                        int pageNo,
                        int pageSize) {

                Sort thisSort = ListService.createSortObject(learnerPackageFilterDTO.getSortColumns());
                Pageable pageable = PageRequest.of(pageNo, pageSize, thisSort);

                Page<PackageDetailV2Projection> learnerPackageDetail;
                if (StringUtils.hasText(learnerPackageFilterDTO.getSearchByName())) {
                        // Corrected the argument order and passed null for unused filters
                        learnerPackageDetail = packageRepository.getCatalogPackageDetailV2(
                                        learnerPackageFilterDTO.getSearchByName(),
                                        instituteId,
                                        null, // facultyIds - not used in searchByName
                                        List.of(StatusEnum.ACTIVE.name()), // facultyPackageSessionStatus
                                        null, // tags - not used in searchByName
                                        List.of(PackageStatusEnum.ACTIVE.name()),
                                        learnerPackageFilterDTO.getPackageTypes(),
                                        List.of(PackageSessionStatusEnum.ACTIVE.name(),
                                                        PackageSessionStatusEnum.HIDDEN.name()),
                                        List.of(LevelStatusEnum.ACTIVE.name()),
                                        List.of(StatusEnum.ACTIVE.name()), // ratingStatuses
                                        List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()),
                                        List.of(ChapterStatus.ACTIVE.name()),
                                        List.of(StatusEnum.ACTIVE.name()), // assignmentQuestionStatusList
                                        List.of(StatusEnum.ACTIVE.name()), // questionStatusList
                                        List.of(StatusEnum.ACTIVE.name()), // enrollInviteStatus
                                        List.of(StatusEnum.ACTIVE.name()), // psliStatus
                                        List.of(StatusEnum.ACTIVE.name()), // paymentOptionStatus
                                        List.of(StatusEnum.ACTIVE.name()), // paymentPlanStatus
                                        pageable);
                } else {
                        // Corrected getTag() to getTags() to match List<String> type
                        learnerPackageDetail = packageRepository.getOpenCatalogPackageDetailV2(
                                        instituteId,
                                        learnerPackageFilterDTO.getLevelIds(),
                                        List.of(PackageStatusEnum.ACTIVE.name()),
                                        learnerPackageFilterDTO.getPackageTypes(),
                                        List.of(PackageSessionStatusEnum.ACTIVE.name(),
                                                        PackageSessionStatusEnum.HIDDEN.name()),
                                        learnerPackageFilterDTO.getFacultyIds(),
                                        List.of(StatusEnum.ACTIVE.name()), // facultyPackageSessionStatus
                                        learnerPackageFilterDTO.getTag(), // Corrected from getTag()
                                        List.of(LevelStatusEnum.ACTIVE.name()),
                                        List.of(StatusEnum.ACTIVE.name()), // ratingStatuses
                                        List.of(StatusEnum.ACTIVE.name()), // assignmentQuestionStatusList
                                        List.of(StatusEnum.ACTIVE.name()), // questionStatusList
                                        List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name()),
                                        List.of(ChapterStatus.ACTIVE.name()),
                                        List.of(StatusEnum.ACTIVE.name()), // enrollInviteStatus
                                        List.of(StatusEnum.ACTIVE.name()), // psliStatus
                                        List.of(StatusEnum.ACTIVE.name()), // paymentOptionStatus
                                        List.of(StatusEnum.ACTIVE.name()), // paymentPlanStatus
                                        pageable);
                }

                // Get all instructor userIds
                List<String> instructorIds = learnerPackageDetail.getContent().stream()
                                .map(PackageDetailV2Projection::getFacultyUserIds)
                                .filter(Objects::nonNull)
                                .flatMap(List::stream)
                                .distinct()
                                .collect(Collectors.toList());

                // Fetch instructor details
                List<UserDTO> userDTOS = authService.getUsersFromAuthServiceByUserIds(instructorIds);
                Map<String, UserDTO> userMap = userDTOS.stream()
                                .collect(Collectors.toMap(UserDTO::getId, Function.identity()));

                // Map projections to DTOs
                List<PackageDetailV2DTO> dtos = learnerPackageDetail.getContent().stream().map(projection -> {
                        List<UserDTO> instructors = Optional.ofNullable(projection.getFacultyUserIds())
                                        .orElse(List.of()).stream()
                                        .map(userMap::get)
                                        .filter(Objects::nonNull)
                                        .collect(Collectors.toList());

                        return new PackageDetailV2DTO(
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
                                        null, // percentageCompleted (not in projection yet)
                                        projection.getRating(),
                                        projection.getPackageSessionId(),
                                        projection.getLevelId(),
                                        projection.getLevelName(),
                                        projection.getDripConditionJson(),
                                        instructors,
                                        projection.getReadTimeInMinutes(),
                                        projection.getPackageType(),
                                        projection.getEnrollInviteId(),
                                        projection.getPsliId(),
                                        projection.getPaymentOptionId(),
                                        projection.getPaymentOptionType(),
                                        projection.getPaymentOptionStatus(),
                                        projection.getPaymentPlanId(),
                                        projection.getMinPlanActualPrice(),
                                        projection.getCurrency(),
                                        projection.getAvailableSlots());
                }).toList();

                return new PageImpl<>(dtos, pageable, learnerPackageDetail.getTotalElements());
        }

        private Long getReadTimeInMinutes(String packageId) {
                try {
                        return packageRepository.sumReadTimeInMinutesForPackage(
                                        packageId,
                                        List.of(PackageSessionStatusEnum.ACTIVE.name(),
                                                        PackageSessionStatusEnum.HIDDEN.name()),
                                        List.of(QuestionStatusEnum.ACTIVE.name()),
                                        List.of(QuestionStatusEnum.ACTIVE.name()),
                                        List.of(SlideStatus.DRAFT.name(), SlideStatus.PUBLISHED.name(),
                                                        SlideStatus.UNSYNC.name()),
                                        List.of(ChapterStatus.ACTIVE.name()));
                } catch (Exception e) {
                        return 0L;
                }
        }

}
