package vacademy.io.admin_core_service.features.packages.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_operation.enums.LearnerOperationEnum;
import vacademy.io.admin_core_service.features.packages.dto.LearnerPackageDetailProjection;
import vacademy.io.admin_core_service.features.packages.dto.LearnerPackageFilterDTO;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.standard_classes.ListService;

import java.util.List;

@Service
public class LearnerPackageService {

    @Autowired
    private PackageRepository packageRepository;

    public Page<LearnerPackageDetailProjection> getLearnerPackageDetail(LearnerPackageFilterDTO learnerPackageFilterDTO, CustomUserDetails user, int pageNo, int pageSize) {
        Sort thisSort = ListService.createSortObject(learnerPackageFilterDTO.getSortColumns());
        Pageable pageable = PageRequest.of(pageNo,pageSize,thisSort);
        return packageRepository.getLearnerPackageDetail(
                user.getId(),
                learnerPackageFilterDTO.getLevelIds(),
                List.of(PackageStatusEnum.ACTIVE.name()),
                List.of(PackageSessionStatusEnum.ACTIVE.name(),PackageSessionStatusEnum.HIDDEN.name()),
                List.of(LearnerOperationEnum.PERCENTAGE_PACKAGE_SESSION_COMPLETED.name()),
                learnerPackageFilterDTO.getMinPercentageCompleted(),
                learnerPackageFilterDTO.getMaxPercentageCompleted(),
                learnerPackageFilterDTO.getFacultyIds(),
                learnerPackageFilterDTO.getTag(),
                pageable);
    }
}
