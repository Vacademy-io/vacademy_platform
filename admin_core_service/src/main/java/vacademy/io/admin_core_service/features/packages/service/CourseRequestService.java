package vacademy.io.admin_core_service.features.packages.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.level.enums.LevelStatusEnum;
import vacademy.io.admin_core_service.features.packages.dto.LearnerPackageFilterDTO;
import vacademy.io.admin_core_service.features.packages.dto.PackageDetailDTO;
import vacademy.io.admin_core_service.features.packages.dto.PackageDetailProjection;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.CourseStructureChangesLogRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.core.standard_classes.ListService;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class CourseRequestService {

    @Autowired
    private CourseStructureChangesLogRepository courseStructureChangesLogRepository;

    @Autowired
    private AuthService authService;

    public Page<PackageDetailDTO> getcourseCatalogDetail(
        LearnerPackageFilterDTO learnerPackageFilterDTO,
        String instituteId,
        int pageNo,
        int pageSize) {

        Sort thisSort = ListService.createSortObject(learnerPackageFilterDTO.getSortColumns());
        Pageable pageable = PageRequest.of(pageNo, pageSize, thisSort);

        Page<PackageDetailProjection> learnerPackageDetail = null;

        if (StringUtils.hasText(learnerPackageFilterDTO.getSearchByName())){
            learnerPackageDetail= courseStructureChangesLogRepository.getCatalogSearch(
                learnerPackageFilterDTO.getSearchByName(),
                learnerPackageFilterDTO.getFacultyIds(),
                instituteId,
                List.of(StatusEnum.ACTIVE.name()),
                List.of(PackageSessionStatusEnum.ACTIVE.name(),PackageSessionStatusEnum.HIDDEN.name()),
                List.of(LevelStatusEnum.ACTIVE.name()),
                pageable
            );
        }
        else{
            learnerPackageDetail = courseStructureChangesLogRepository.getCourseRequestCatalogDetail(
                instituteId,
                learnerPackageFilterDTO.getLevelIds(),
                learnerPackageFilterDTO.getTag(),
                learnerPackageFilterDTO.getFacultyIds(),
                List.of(StatusEnum.ACTIVE.name()),
                List.of(PackageSessionStatusEnum.ACTIVE.name(),PackageSessionStatusEnum.HIDDEN.name()),
                List.of(LevelStatusEnum.ACTIVE.name()),
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
                instructors
            );
        }).toList();

        return new PageImpl<>(dtos, pageable, learnerPackageDetail.getTotalElements());
    }
}
