package vacademy.io.admin_core_service.features.packages.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.faculty.enums.FacultyStatusEnum;
import vacademy.io.admin_core_service.features.learner_operation.enums.LearnerOperationEnum;
import vacademy.io.admin_core_service.features.packages.dto.PackageDetailDTO;
import vacademy.io.admin_core_service.features.packages.dto.PackageDetailProjection;
import vacademy.io.admin_core_service.features.packages.dto.LearnerPackageFilterDTO;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.standard_classes.ListService;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class LearnerPackageService {

    @Autowired
    private PackageRepository packageRepository;

    @Autowired
    private AuthService authService;

    public Page<PackageDetailDTO> getLearnerPackageDetail(
            LearnerPackageFilterDTO learnerPackageFilterDTO,
            CustomUserDetails user,
            String instituteId,
            int pageNo,
            int pageSize) {

        Sort thisSort = ListService.createSortObject(learnerPackageFilterDTO.getSortColumns());
        Pageable pageable = PageRequest.of(pageNo, pageSize, thisSort);

        Page<PackageDetailProjection> learnerPackageDetail = null;
        if (StringUtils.hasText(learnerPackageFilterDTO.getSearchByName())){
            learnerPackageDetail= packageRepository.getLearnerPackageDetail(
                    user.getId(),
                    learnerPackageFilterDTO.getSearchByName(),
                    instituteId,
                    List.of(PackageStatusEnum.ACTIVE.name()),
                    List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
                    List.of(LearnerOperationEnum.PERCENTAGE_PACKAGE_SESSION_COMPLETED.name()),
                    learnerPackageFilterDTO.getMinPercentageCompleted(),
                    learnerPackageFilterDTO.getMaxPercentageCompleted(),
                    List.of(StatusEnum.ACTIVE.name()),
                    pageable
            );
        }else{
            learnerPackageDetail= packageRepository.getLearnerPackageDetail(
                    user.getUserId(),
                    instituteId,
                    learnerPackageFilterDTO.getLevelIds(),
                    List.of(PackageStatusEnum.ACTIVE.name()),
                    List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
                    List.of(LearnerOperationEnum.PERCENTAGE_PACKAGE_SESSION_COMPLETED.name()),
                    learnerPackageFilterDTO.getMinPercentageCompleted(),
                    learnerPackageFilterDTO.getMaxPercentageCompleted(),
                    learnerPackageFilterDTO.getFacultyIds(),
                    List.of(StatusEnum.ACTIVE.name()),
                    learnerPackageFilterDTO.getTag(),
                    pageable
            );
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
                    instructors,
                    projection.getLevelIds()
            );
        }).toList();

        return new PageImpl<>(dtos, pageable, learnerPackageDetail.getTotalElements());
    }


    public PackageDetailDTO getPackageDetailById(
            String packageId
    ) {
        Optional<PackageDetailProjection> optionalProjection =
                packageRepository.getPackageDetailByIdWithSessionAndFacultyStatus(packageId, List.of(PackageSessionStatusEnum.ACTIVE.name(),PackageSessionStatusEnum.HIDDEN.name()), List.of(FacultyStatusEnum.ACTIVE.name()));

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
                instructors,
                projection.getLevelIds()
        );

        return dto;
    }

}
