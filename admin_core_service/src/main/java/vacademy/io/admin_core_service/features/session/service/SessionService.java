package vacademy.io.admin_core_service.features.session.service;

import jakarta.transaction.Transactional;
import lombok.AllArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.level.dto.AddLevelWithSessionDTO;
import vacademy.io.admin_core_service.features.level.service.LevelService;
import vacademy.io.admin_core_service.features.packages.dto.PackageDTOWithDetails;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.session.dto.*;
import vacademy.io.admin_core_service.features.session.enums.SessionStatusEnum;
import vacademy.io.admin_core_service.features.session.repository.SessionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.LevelDTO;
import vacademy.io.common.institute.dto.PackageDTO;
import vacademy.io.common.institute.dto.SessionDTO;
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
                .collect(Collectors.groupingBy(PackageSession::getPackageEntity,
                        Collectors.mapping(PackageSession::getLevel, Collectors.toList())))
                .entrySet().stream()
                .map(entry -> createPackageDTOWithDetails(entry.getKey(), entry.getValue()))
                .collect(Collectors.toList());
    }

    private PackageDTOWithDetails createPackageDTOWithDetails(PackageEntity packageEntity, List<Level> levels) {
        List<LevelDTO> levelDTOs = levels.stream()
                .filter(Objects::nonNull) // Avoid null levels
                .map(LevelDTO::new)
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
    public String addNewSession(AddNewSessionDTO addNewSessionDTO, CustomUserDetails user) {

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
            PackageSession packageSession = createPackageSession(levelDTO, session, addNewSessionDTO.getStartDate());
            packageSessions.add(packageSession);
        }

        packageSessionRepository.saveAll(packageSessions);

        return String.valueOf(session.getId()); // Ensure return type is String
    }


    private PackageSession createPackageSession(AddLevelWithSessionDTO levelDTO, Session session, java.util.Date startDate) {
        Level level = levelService.createOrAddLevel(
                levelDTO.getId(),
                levelDTO.getNewLevel(),
                levelDTO.getLevelName(),
                levelDTO.getDurationInDays(),
                levelDTO.getThumbnailFileId()
        );

        PackageEntity packageEntity = packageRepository.findById(levelDTO.getPackageId())
                .orElseThrow(() -> new VacademyException("Package not found"));

        PackageSession packageSession = new PackageSession();
        packageSession.setSession(session);
        packageSession.setPackageEntity(packageEntity);
        packageSession.setLevel(level);
        packageSession.setStatus(PackageSessionStatusEnum.ACTIVE.name());
        packageSession.setStartTime(startDate);

        return packageSession;
    }

    @Transactional
    public String deleteSessions(List<String>sessionIds, CustomUserDetails user) {
        List<Session>sessions = sessionRepository.findAllById(sessionIds);
        for (Session session : sessions) {
            session.setStatus(SessionStatusEnum.DELETED.name());
        }
        sessionRepository.saveAll(sessions);
        packageSessionRepository.updateStatusBySessionIds(sessionIds, PackageSessionStatusEnum.DELETED.name());
        return "Session deleted successfully.";
    }

    private void visiblePackageSessions(String commaSeparatedIds) {
        if (commaSeparatedIds != null && !commaSeparatedIds.trim().isEmpty()) {
            packageSessionRepository.updateStatusByPackageSessionIds(PackageSessionStatusEnum.ACTIVE.name(), commaSeparatedIds.split(","));
        }
    }
}
