package vacademy.io.admin_core_service.features.packages.service;

import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.course.dto.AddFacultyToCourseDTO;
import vacademy.io.admin_core_service.features.enroll_invite.service.DefaultEnrollInviteService;
import vacademy.io.admin_core_service.features.faculty.service.FacultyService;
import vacademy.io.admin_core_service.features.learner_invitation.dto.AddLearnerInvitationDTO;
import vacademy.io.admin_core_service.features.learner_invitation.services.LearnerInvitationService;
import vacademy.io.admin_core_service.features.learner_invitation.util.LearnerInvitationDefaultFormGenerator;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Group;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.session.Session;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PackageSessionService {

    private final PackageSessionRepository packageRepository;
    private final FacultyService facultyService;
    private final LearnerInvitationService learnerInvitationService;
    private final DefaultEnrollInviteService defaultEnrollInviteService;

    public void createPackageSession(Level level, Session session, PackageEntity packageEntity, Group group, Date startTime, String instituteId, CustomUserDetails userDetails, List<AddFacultyToCourseDTO>addFacultyToCourseDTOS) {
        PackageSession packageSession = new PackageSession();
        packageSession.setSession(session);
        packageSession.setLevel(level);
        packageSession.setPackageEntity(packageEntity);
        packageSession.setStatus(PackageStatusEnum.ACTIVE.name());
        packageSession.setStartTime(startTime);
        packageSession.setGroup(group);
        packageSession = packageRepository.save(packageSession);
        createDefaultInvitationForm(packageSession,instituteId,userDetails);
        facultyService.addFacultyToBatch(addFacultyToCourseDTOS,packageSession.getId(),instituteId);
        defaultEnrollInviteService.createDefaultEnrollInvite(packageSession,instituteId);
        createLearnerInvitationForm(List.of(packageSession),instituteId,userDetails);
    }

    @Async
    private void createDefaultInvitationForm(PackageSession packageSession, String instituteId, CustomUserDetails userDetails){
        AddLearnerInvitationDTO learnerInvitationDTO = LearnerInvitationDefaultFormGenerator.generateSampleInvitation(packageSession,instituteId);
        learnerInvitationService.createLearnerInvitationCode(learnerInvitationDTO,userDetails);
    }

    public PackageSession updatePackageSession(String packageSessionId,String status,String instituteId,List<AddFacultyToCourseDTO>addFacultyToCourseDTOS){
        PackageSession packageSession = packageRepository.findById(packageSessionId).get();
        packageSession.setStatus(status);
        packageRepository.save(packageSession);
        facultyService.updateFacultyToSubjectPackageSession(addFacultyToCourseDTOS,packageSessionId,instituteId);
        return packageSession;
    }

    @Async
    public void createLearnerInvitationForm(List<PackageSession>packageSessions,String instituteId,CustomUserDetails userDetails){
        List<AddLearnerInvitationDTO>addLearnerInvitationDTOS = new ArrayList<>();
        for(PackageSession packageSession:packageSessions){
            AddLearnerInvitationDTO addLearnerInvitationDTO = LearnerInvitationDefaultFormGenerator.generateSampleInvitation(packageSession, instituteId);
            addLearnerInvitationDTOS.add(addLearnerInvitationDTO);
        }
        learnerInvitationService.createLearnerInvitationCodes(addLearnerInvitationDTOS,userDetails);
    }

    public PackageSession findById(String id){
        return packageRepository.findById(id).orElseThrow(()->new VacademyException("Package Session not found"));
    }

    public List<PackageSession>findAllByIds(List<String>ids){
        return packageRepository.findAllById(ids);
    }
}
