package vacademy.io.admin_core_service.features.packages.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
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

@Service
public class BatchService {

    @Autowired
    private PackageSessionRepository packageSessionRepository;

    @Autowired
    private LearnerInvitationService learnerInvitationService;

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
}
