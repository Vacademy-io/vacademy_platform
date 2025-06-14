package vacademy.io.admin_core_service.features.packages.service;

import com.itextpdf.styledxmlparser.jsoup.internal.StringUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.*;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.learner_operation.enums.LearnerOperationEnum;
import vacademy.io.admin_core_service.features.packages.dto.LearnerPackageDetailDTO;
import vacademy.io.admin_core_service.features.packages.dto.LearnerPackageDetailProjection;
import vacademy.io.admin_core_service.features.packages.dto.LearnerPackageFilterDTO;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.standard_classes.ListService;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class LearnerPackageService {

    @Autowired
    private PackageRepository packageRepository;

    @Autowired
    private AuthService authService;

    public Page<LearnerPackageDetailDTO> getLearnerPackageDetail(
            LearnerPackageFilterDTO learnerPackageFilterDTO,
            CustomUserDetails user,
            String instituteId,
            int pageNo,
            int pageSize) {

        Sort thisSort = ListService.createSortObject(learnerPackageFilterDTO.getSortColumns());
        Pageable pageable = PageRequest.of(pageNo, pageSize, thisSort);

        Page<LearnerPackageDetailProjection> learnerPackageDetail = null;
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
                    pageable
            );
        }else{
            learnerPackageDetail= packageRepository.getLearnerPackageDetail(
                    user.getId(),
                    instituteId,
                    learnerPackageFilterDTO.getLevelIds(),
                    List.of(PackageStatusEnum.ACTIVE.name()),
                    List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()),
                    List.of(LearnerOperationEnum.PERCENTAGE_PACKAGE_SESSION_COMPLETED.name()),
                    learnerPackageFilterDTO.getMinPercentageCompleted(),
                    learnerPackageFilterDTO.getMaxPercentageCompleted(),
                    learnerPackageFilterDTO.getFacultyIds(),
                    learnerPackageFilterDTO.getTag(),
                    pageable
            );
        }

        // Get all instructor userIds
        List<String> instructorIds = learnerPackageDetail.getContent().stream()
                .map(LearnerPackageDetailProjection::getFacultyUserIds)
                .filter(Objects::nonNull)
                .flatMap(List::stream)
                .distinct()
                .collect(Collectors.toList());

        // Fetch instructor details
        List<UserDTO> userDTOS = authService.getUsersFromAuthServiceByUserIds(instructorIds);
        Map<String, UserDTO> userMap = userDTOS.stream().collect(Collectors.toMap(UserDTO::getId, Function.identity()));

        // Map projections to DTOs
        List<LearnerPackageDetailDTO> dtos = learnerPackageDetail.getContent().stream().map(projection -> {
            List<UserDTO> instructors = Optional.ofNullable(projection.getFacultyUserIds())
                    .orElse(List.of()).stream()
                    .map(userMap::get)
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());

            return new LearnerPackageDetailDTO(
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
