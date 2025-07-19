package vacademy.io.admin_core_service.features.session.service;

import jakarta.transaction.Transactional;
import lombok.AllArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.course.dto.AddFacultyToCourseDTO;
import vacademy.io.admin_core_service.features.enroll_invite.service.DefaultEnrollInviteService;
import vacademy.io.admin_core_service.features.faculty.service.FacultyService;
import vacademy.io.admin_core_service.features.group.service.GroupService;
import vacademy.io.admin_core_service.features.learner_invitation.dto.AddLearnerInvitationDTO;
import vacademy.io.admin_core_service.features.learner_invitation.enums.LearnerInvitationSourceTypeEnum;
import vacademy.io.admin_core_service.features.learner_invitation.services.LearnerInvitationService;
import vacademy.io.admin_core_service.features.learner_invitation.util.LearnerInvitationDefaultFormGenerator;
import vacademy.io.admin_core_service.features.level.dto.AddLevelWithSessionDTO;
import vacademy.io.admin_core_service.features.level.dto.LevelDTOWithPackageSession;
import vacademy.io.admin_core_service.features.level.service.LevelService;
import vacademy.io.admin_core_service.features.packages.dto.PackageDTOWithDetails;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.session.dto.*;
import vacademy.io.admin_core_service.features.session.enums.SessionStatusEnum;
import vacademy.io.admin_core_service.features.session.repository.SessionRepository;
import vacademy.io.admin_core_service.features.subject.service.SubjectService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.PackageDTO;
import vacademy.io.common.institute.dto.SessionDTO;
import vacademy.io.common.institute.entity.Group;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.session.Session;

import java.util.*;
import java.util.stream.Collectors;

@Service
@AllArgsConstructor
public class SessionService {

    private final SessionRepository sessionRepository;
    private final PackageSessionRepository packageSessionRepository;
    private final LevelService levelService;
    private final PackageRepository packageRepository;
    private final SubjectService subjectService;
    private final LearnerInvitationService learnerInvitationService;
    private final GroupService groupService;
    private final DefaultEnrollInviteService defaultEnrollInviteService;

    private final FacultyService facultyService;

    public Session createOrGetSession(AddSessionDTO sessionDTO) {
        Session session = null;
        if (sessionDTO.getNewSession() == false) {
            session = sessionRepository.findById(sessionDTO.getId()).orElseThrow(() -> new RuntimeException("Session not found for id " + sessionDTO.getId()));
        } else {
            session = new Session(null, sessionDTO.getSessionName(), sessionDTO.getStatus(),sessionDTO.getStartDate());
        }
        return sessionRepository.save(session);
    }

    public Session getSessionById(String sessionId) {
        return sessionRepository.findById(sessionId).orElseThrow(() -> new VacademyException("Session not found for id " + sessionId));
    }
    public List<SessionDTOWithDetails> getSessionsWithDetailsByInstituteId(String instituteId, CustomUserDetails user) {
        List<PackageSession> packageSessions = packageSessionRepository.findPackageSessionsByInstituteId(instituteId,List.of(PackageSessionStatusEnum.ACTIVE.name(),PackageSessionStatusEnum.HIDDEN.name()));
        // Group by Session and process
        return packageSessions.stream()
                .collect(Collectors.groupingBy(PackageSession::getSession))
                .entrySet().stream()
                .map(entry -> createSessionDTOWithDetails(entry.getKey(), entry.getValue()))
                .collect(Collectors.toList());
    }

    private SessionDTOWithDetails createSessionDTOWithDetails(Session session, List<PackageSession> sessionPackages) {
        SessionDTO sessionDTO = new SessionDTO(session);
        List<PackageDTOWithDetails> packageDetails = groupPackagesWithLevels(sessionPackages);
        return new SessionDTOWithDetails(sessionDTO, packageDetails);
    }

    private List<PackageDTOWithDetails> groupPackagesWithLevels(List<PackageSession> sessionPackages) {
        return sessionPackages.stream()
                .collect(Collectors.groupingBy(
                        PackageSession::getPackageEntity,
                        Collectors.mapping(PackageSession::getLevel, Collectors.toList()) // Group levels per package
                ))
                .entrySet().stream()
                .map(entry -> createPackageDTOWithDetails(entry.getKey(), entry.getValue(), sessionPackages))
                .collect(Collectors.toList());
    }

    private PackageDTOWithDetails createPackageDTOWithDetails(PackageEntity packageEntity, List<Level> levels, List<PackageSession> sessionPackages) {
        List<LevelDTOWithPackageSession> levelDTOs = levels.stream()
                .filter(Objects::nonNull) // Avoid null levels
                .map(level -> {
                    PackageSession matchingSession = sessionPackages.stream()
                            .filter(ps -> ps.getPackageEntity().equals(packageEntity) && ps.getLevel().equals(level))
                            .findFirst()
                            .orElse(null); // Find the correct PackageSession for this package & level

                    return new LevelDTOWithPackageSession(level, matchingSession);
                })
                .collect(Collectors.toList());

        return new PackageDTOWithDetails(new PackageDTO(packageEntity), levelDTOs);
    }


    @Transactional
    public String editSession(EditSessionDTO editSessionDTO, String sessionId, CustomUserDetails user) {
        Session session = getSessionById(sessionId);
        updateSessionFields(session, editSessionDTO);
        sessionRepository.save(session);
        hidePackageSessions(editSessionDTO.getCommaSeparatedHiddenPackageSessionIds());
        visiblePackageSessions(editSessionDTO.getCommaSeparatedVisiblePackageSessionIds());
        return "Session updated successfully.";
    }


    private void updateSessionFields(Session session, EditSessionDTO editSessionDTO) {
        if (editSessionDTO.getSessionName() != null && !editSessionDTO.getSessionName().trim().isEmpty()) {
            session.setSessionName(editSessionDTO.getSessionName());
        }
        if (editSessionDTO.getStatus() != null && !editSessionDTO.getStatus().trim().isEmpty()) {
            session.setStatus(editSessionDTO.getStatus());
        }
    }

    private void hidePackageSessions(String commaSeparatedIds) {
        if (commaSeparatedIds != null && !commaSeparatedIds.trim().isEmpty()) {
            packageSessionRepository.updateStatusByPackageSessionIds(PackageSessionStatusEnum.HIDDEN.name(), commaSeparatedIds.split(","));
        }
    }

    @Transactional
    public String addNewSession(AddNewSessionDTO addNewSessionDTO, String instituteId, CustomUserDetails user) {

        if (addNewSessionDTO.getLevels() == null || addNewSessionDTO.getLevels().isEmpty()) {
            throw new VacademyException("To add a new session, you must provide at least one level.");
        }

        Session session;

        if (addNewSessionDTO.isNewSession()) {
            session = sessionRepository.save(new Session(null, addNewSessionDTO.getSessionName(), addNewSessionDTO.getStatus(),addNewSessionDTO.getStartDate()));
        } else {
            session = sessionRepository.findById(addNewSessionDTO.getId())
                    .orElseThrow(() -> new VacademyException("Session not found for id " + addNewSessionDTO.getId()));
        }

        List<PackageSession> packageSessions = new ArrayList<>();
        for (AddLevelWithSessionDTO levelDTO : addNewSessionDTO.getLevels()) {
            PackageSession packageSession = createPackageSession(levelDTO, session, addNewSessionDTO.getStartDate(),instituteId);
            facultyService.addFacultyToBatch(levelDTO.getAddFacultyToCourse(),packageSession.getId(),instituteId);
            packageSessions.add(packageSession);
        }
        this.createLearnerInvitationForm(packageSessions, instituteId, user);
        return String.valueOf(session.getId()); // Ensure return type is String
    }

    @Transactional
    public String addNewSession(AddNewSessionDTO addNewSessionDTO,List<AddFacultyToCourseDTO>addFacultyToCourseDTOS, String instituteId, CustomUserDetails user) {

        if (addNewSessionDTO.getLevels() == null || addNewSessionDTO.getLevels().isEmpty()) {
            throw new VacademyException("To add a new session, you must provide at least one level.");
        }

        Session session;

        if (addNewSessionDTO.isNewSession()) {
            session = sessionRepository.save(new Session(null, addNewSessionDTO.getSessionName(), addNewSessionDTO.getStatus(),addNewSessionDTO.getStartDate()));
        } else {
            session = sessionRepository.findById(addNewSessionDTO.getId())
                .orElseThrow(() -> new VacademyException("Session not found for id " + addNewSessionDTO.getId()));
        }

        List<PackageSession> packageSessions = new ArrayList<>();
        for (AddLevelWithSessionDTO levelDTO : addNewSessionDTO.getLevels()) {
            PackageSession packageSession = createPackageSession(levelDTO, session, addNewSessionDTO.getStartDate(),instituteId);
            packageSessions.add(packageSession);
        }
        this.createLearnerInvitationForm(packageSessions, instituteId, user);
        for (PackageSession packageSession:packageSessions){
            facultyService.addFacultyToBatch(addFacultyToCourseDTOS,packageSession.getId(),instituteId);
        }
        return String.valueOf(session.getId()); // Ensure return type is String
    }


    private PackageSession createPackageSession(AddLevelWithSessionDTO levelDTO, Session session, java.util.Date startDate,String instituteId) {
        Level level = levelService.createOrAddLevel(
                levelDTO.getId(),
                levelDTO.getNewLevel(),
                levelDTO.getLevelName(),
                levelDTO.getDurationInDays(),
                levelDTO.getThumbnailFileId()
        );

        PackageEntity packageEntity = packageRepository.findById(levelDTO.getPackageId())
                .orElseThrow(() -> new VacademyException("Package not found"));
        Group group = groupService.addGroup(levelDTO.getGroup());
        PackageSession packageSession = new PackageSession();
        packageSession.setSession(session);
        packageSession.setPackageEntity(packageEntity);
        packageSession.setLevel(level);
        packageSession.setStatus(PackageSessionStatusEnum.ACTIVE.name());
        packageSession.setStartTime(startDate);
        packageSession.setGroup(group);
        packageSessionRepository.save(packageSession);
        defaultEnrollInviteService.createDefaultEnrollInvite(packageSession,instituteId);
        return packageSession;
    }

    @Transactional
    public String deleteSessions(List<String>sessionIds, CustomUserDetails user) {
        List<Session>sessions = sessionRepository.findAllById(sessionIds);
        for (Session session : sessions) {
            session.setStatus(SessionStatusEnum.DELETED.name());
        }
        sessionRepository.saveAll(sessions);
       List<PackageSession>packageSessions = packageSessionRepository.findBySessionIds(sessionIds);
       List<String>packageSessionIds = new ArrayList<>();
       for (PackageSession packageSession : packageSessions) {
           packageSession.setStatus(PackageSessionStatusEnum.DELETED.name());
           packageSessionIds.add(packageSession.getId());
       }
       packageSessionRepository.saveAll(packageSessions);
       learnerInvitationService.deleteLearnerInvitationBySourceAndSourceId(LearnerInvitationSourceTypeEnum.PACKAGE_SESSION.name(), packageSessionIds);
        return "Session deleted successfully.";
    }

    private void visiblePackageSessions(String commaSeparatedIds) {
        if (commaSeparatedIds != null && !commaSeparatedIds.trim().isEmpty()) {
            packageSessionRepository.updateStatusByPackageSessionIds(PackageSessionStatusEnum.ACTIVE.name(), commaSeparatedIds.split(","));
        }
    }

    public boolean copyStudyMaterial(String fromPackageSessionId,String toPackageSessionId) {
        PackageSession oldPackageSession = packageSessionRepository.findById(fromPackageSessionId).orElseThrow(()->new VacademyException("Package Session not found"));
        PackageSession newPackageSession = packageSessionRepository.findById(toPackageSessionId).orElseThrow(()->new VacademyException("Package Session not found"));
        return subjectService.copySubjectsFromExistingPackageSessionMapping(oldPackageSession, newPackageSession);
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

    public void addOrUpdateSession(AddNewSessionDTO sessionDTO, PackageEntity packageEntity, String instituteId, CustomUserDetails user) {
        Session session = resolveSession(sessionDTO);
        for (AddLevelWithSessionDTO levelDTO : sessionDTO.getLevels()) {
            levelService.addOrUpdateLevel(levelDTO, session, packageEntity, instituteId, user);
        }
    }

    private Session resolveSession(AddNewSessionDTO sessionDTO) {
        if (sessionDTO.isNewSession()) {
            Session newSession = new Session(
                    sessionDTO.getId(),
                    sessionDTO.getSessionName(),
                    sessionDTO.getStatus(),
                    sessionDTO.getStartDate()
            );
            return sessionRepository.save(newSession);
        } else {
            Session existingSession = sessionRepository.findById(sessionDTO.getId())
                    .orElseThrow(() -> new VacademyException("Session not found for id " + sessionDTO.getId()));

            updateSessionFields(existingSession, sessionDTO);
            return sessionRepository.save(existingSession);
        }
    }

    private void updateSessionFields(Session session, AddNewSessionDTO sessionDTO) {
        if (StringUtils.hasText(sessionDTO.getSessionName())) {
            session.setSessionName(sessionDTO.getSessionName());
        }
        if (StringUtils.hasText(sessionDTO.getStatus())) {
            session.setStatus(sessionDTO.getStatus());
        }
        if (sessionDTO.getStartDate() != null) {
            session.setStartDate(sessionDTO.getStartDate());
        }
    }
}
