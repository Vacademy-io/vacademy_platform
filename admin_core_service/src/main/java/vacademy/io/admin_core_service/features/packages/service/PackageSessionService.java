package vacademy.io.admin_core_service.features.packages.service;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.learner_invitation.dto.AddLearnerInvitationDTO;
import vacademy.io.admin_core_service.features.learner_invitation.dto.LearnerInvitationDTO;
import vacademy.io.admin_core_service.features.learner_invitation.services.LearnerInvitationService;
import vacademy.io.admin_core_service.features.learner_invitation.util.LearnerInvitationDefaultFormGenerator;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.institute.entity.Group;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.session.Session;

import java.util.Date;

@Service
@RequiredArgsConstructor
public class PackageSessionService {

    private final PackageSessionRepository packageRepository;
    private final LearnerInvitationService learnerInvitationService;

    public void createPackageSession(Level level, Session session, PackageEntity packageEntity, Group group, Date startTime, String instituteId, CustomUserDetails userDetails) {
        PackageSession packageSession = new PackageSession();
        packageSession.setSession(session);
        packageSession.setLevel(level);
        packageSession.setPackageEntity(packageEntity);
        packageSession.setStatus(PackageStatusEnum.ACTIVE.name());
        packageSession.setStartTime(startTime);
        packageSession.setGroup(group);
        packageRepository.save(packageSession);
        createDefaultInvitationForm(packageSession,instituteId,userDetails);
    }

    @Async
    private void createDefaultInvitationForm(PackageSession packageSession, String instituteId, CustomUserDetails userDetails){
        AddLearnerInvitationDTO learnerInvitationDTO = LearnerInvitationDefaultFormGenerator.generateSampleInvitation(packageSession,instituteId);
        learnerInvitationService.createLearnerInvitationCode(learnerInvitationDTO,userDetails);
    }
}
