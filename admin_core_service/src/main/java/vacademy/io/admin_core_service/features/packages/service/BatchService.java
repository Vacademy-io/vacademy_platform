package vacademy.io.admin_core_service.features.packages.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.institute_learner.enums.LearnerStatusEnum;
import vacademy.io.admin_core_service.features.learner_invitation.enums.LearnerInvitationCodeStatusEnum;
import vacademy.io.admin_core_service.features.learner_invitation.enums.LearnerInvitationSourceTypeEnum;
import vacademy.io.admin_core_service.features.learner_invitation.services.LearnerInvitationService;
import vacademy.io.admin_core_service.features.packages.dto.BatchProjection;
import vacademy.io.admin_core_service.features.packages.dto.PackageDTOWithBatchDetails;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.institute.dto.PackageDTO;
import vacademy.io.common.institute.entity.PackageEntity;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class BatchService {

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Autowired
    private LearnerInvitationService learnerInvitationService;

    @Autowired
    private PackageRepository packageRepository;

    public List<PackageDTOWithBatchDetails> getBatchDetails(String sessionId,String instituteId, CustomUserDetails user){
        List<PackageEntity>packages = packageSessionRepository.findPackagesBySessionIdAndStatuses(sessionId,instituteId,List.of(PackageSessionStatusEnum.ACTIVE.name()));
        List<PackageDTOWithBatchDetails>packageDTOWithBatchDetails = new ArrayList<>();
        for (PackageEntity packageEntity : packages) {
            PackageDTO packageDTO = new PackageDTO(packageEntity);
            List<BatchProjection> batches = packageSessionRepository.findBatchDetailsWithLatestInviteCode(packageEntity.getId(),List.of(PackageSessionStatusEnum.ACTIVE.name()),List.of(LearnerStatusEnum.ACTIVE.name()),List.of(LearnerInvitationCodeStatusEnum.DELETED.name(),LearnerInvitationCodeStatusEnum.CLOSED.name()));
            packageDTOWithBatchDetails.add(new PackageDTOWithBatchDetails(packageDTO,batches));
        }
        return packageDTOWithBatchDetails;
    }

    public String deletePackageSession(String[] packageSessionIds, CustomUserDetails userDetails){
        packageSessionRepository.updateStatusByPackageSessionIds(PackageSessionStatusEnum.DELETED.name(),packageSessionIds);
        learnerInvitationService.deleteLearnerInvitationBySourceAndSourceId(LearnerInvitationSourceTypeEnum.PACKAGE_SESSION.name(), Arrays.stream(packageSessionIds).toList());
        return "Package Session deleted successfully.";
    }

    @Transactional(readOnly = true)
    public Page<PackageDTOWithBatchDetails> searchPackagesByInstitute(
            String instituteId,
            List<String> statuses,
            List<String> levelIds,
            List<String> tagsToSearch,
            String searchByName,
            Pageable pageable) {

        List<String> tagsForQuery;
        if (tagsToSearch != null && !tagsToSearch.isEmpty()) {
            List<String> processedInputTags = tagsToSearch.stream()
                                                      .map(String::toLowerCase)
                                                      .map(String::trim)
                                                      .filter(tag -> !tag.isEmpty())
                                                      .collect(Collectors.toList());
            if (!processedInputTags.isEmpty()) {
                tagsForQuery = processedInputTags;
            } else {
                tagsForQuery = List.of("__EMPTY_TAGS_LIST_PLACEHOLDER__");
            }
        } else {
            tagsForQuery = List.of("__NO_TAGS_FILTER_PLACEHOLDER__");
        }

        Page<PackageEntity> packageEntityPage = packageRepository.findPackagesByCriteria(
                instituteId, statuses, levelIds, tagsForQuery, searchByName, pageable);

        List<PackageDTOWithBatchDetails> packageDetailsList = new ArrayList<>();
        for (PackageEntity packageEntity : packageEntityPage.getContent()) {
            PackageDTO packageDTO = new PackageDTO(packageEntity);
            List<BatchProjection> batches = packageSessionRepository.findBatchDetailsWithLatestInviteCode(
                    packageEntity.getId(),
                    List.of(PackageSessionStatusEnum.ACTIVE.name()),
                    List.of(LearnerStatusEnum.ACTIVE.name()),
                    List.of(LearnerInvitationCodeStatusEnum.DELETED.name(), LearnerInvitationCodeStatusEnum.CLOSED.name()));
            packageDetailsList.add(new PackageDTOWithBatchDetails(packageDTO, batches));
        }
        return new PageImpl<>(packageDetailsList, pageable, packageEntityPage.getTotalElements());
    }
}
