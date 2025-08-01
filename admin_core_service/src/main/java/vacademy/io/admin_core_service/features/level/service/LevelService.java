package vacademy.io.admin_core_service.features.level.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.group.service.GroupService;
import vacademy.io.admin_core_service.features.learner_invitation.enums.LearnerInvitationSourceTypeEnum;
import vacademy.io.admin_core_service.features.learner_invitation.services.LearnerInvitationService;
import vacademy.io.admin_core_service.features.level.dto.AddLevelWithCourseDTO;
import vacademy.io.admin_core_service.features.level.dto.AddLevelWithSessionDTO;
import vacademy.io.admin_core_service.features.level.enums.LevelStatusEnum;
import vacademy.io.admin_core_service.features.level.repository.LevelRepository;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.packages.service.PackageSessionService;
import vacademy.io.admin_core_service.features.session.repository.SessionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.LevelDTO;
import vacademy.io.common.institute.entity.Group;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.session.Session;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class LevelService {
    private final LevelRepository levelRepository;
    private final PackageRepository packageRepository;
    private final PackageSessionService packageSessionService;
    private final SessionRepository sessionRepository;
    private final PackageSessionRepository packageSessionRepository;
    private final LearnerInvitationService learnerInvitationService;
    private final GroupService groupService;

    public Level createOrAddLevel(String id, boolean newLevel, String levelName, Integer durationInDays, String thumbnailFileId,String instituteId) {
        Level level = null;
        if (newLevel) {
            level = getLevel(levelName, durationInDays, thumbnailFileId,instituteId);
        } else {
            level = getLevelById(id);
            if (StringUtils.hasText(levelName)){
                level.setLevelName(levelName);
            }
            if (durationInDays != null){
                level.setDurationInDays(durationInDays);
            }
            if (StringUtils.hasText(thumbnailFileId)){
                level.setThumbnailFileId(thumbnailFileId);
            }
        }
        return levelRepository.save(level);
    }

    private Level getLevel(String levelName, Integer durationInDays, String thumbnailFileId,String instituteId) {
        Optional<Level>optionalLevel = levelRepository.findLatestLevelByNameAndInstitute(levelName,instituteId,List.of(LevelStatusEnum.ACTIVE.name()));
        if (optionalLevel.isPresent()) {
            return optionalLevel.get();
        }
        Level level = new Level();
        level.setLevelName(levelName);
        level.setDurationInDays(durationInDays);
        level.setStatus(LevelStatusEnum.ACTIVE.name());
        level.setThumbnailFileId(thumbnailFileId);
        return levelRepository.save(level);
    }

    public Level getLevelById(String levelId) {
        return levelRepository.findById(levelId).orElseThrow(() -> new VacademyException("Level not found"));
    }

    @Transactional
    public String addLevel(AddLevelWithCourseDTO addLevelWithCourseDTO, String packageId, String sessionId,String instituteId, CustomUserDetails user) {
        Optional<PackageEntity> optionalPackageEntity = packageRepository.findById(packageId);
        if (optionalPackageEntity.isEmpty()) {
            throw new VacademyException("Package not found");
        }
        Optional<Session> optionalSession = sessionRepository.findById(sessionId);
        if (optionalSession.isEmpty()) {
            throw new VacademyException("Session not found");
        }
        Level level = createOrAddLevel(addLevelWithCourseDTO.getId(), addLevelWithCourseDTO.getNewLevel(), addLevelWithCourseDTO.getLevelName(), addLevelWithCourseDTO.getDurationInDays(), addLevelWithCourseDTO.getThumbnailFileId(),instituteId);
        Group group = null;
        if (addLevelWithCourseDTO.getGroup() != null) {
            group = groupService.addGroup(addLevelWithCourseDTO.getGroup());
        }
        packageSessionService.createPackageSession(level, optionalSession.get(), optionalPackageEntity.get(),group, getStartDatePackageSessionDate(packageId, sessionId),instituteId,user,addLevelWithCourseDTO.getAddFacultyToCourse());
        return level.getId();
    }

    public LevelDTO updateLevel(String levelId, LevelDTO levelDTO, CustomUserDetails user) {
        Level level = getLevelById(levelId);

        // Update level name only if the provided value is not null or empty.
        if (levelDTO.getLevelName() != null && !levelDTO.getLevelName().trim().isEmpty()) {
            level.setLevelName(levelDTO.getLevelName());
        }

        // Update duration only if the provided value is not null.
        if (levelDTO.getDurationInDays() != null) {
            level.setDurationInDays(levelDTO.getDurationInDays());
        }
        levelRepository.save(level);
        return new LevelDTO(level);
    }

    public String deleteLevels(List<String> levelIds, CustomUserDetails user) {
        List<Level> levels = levelRepository.findAllById(levelIds);

        for (Level level : levels) {
            level.setStatus(LevelStatusEnum.DELETED.name());
        }

        levelRepository.saveAll(levels); // Batch update
        List<PackageSession>packageSessions = packageSessionRepository.findByLevelIds(levelIds);
        List<String>packageSessionIds = new ArrayList<>();
        for (PackageSession packageSession : packageSessions) {
            packageSession.setStatus(PackageSessionStatusEnum.DELETED.name());
            packageSessionIds.add(packageSession.getId());
        }
        packageSessionRepository.saveAll(packageSessions);
        learnerInvitationService.deleteLearnerInvitationBySourceAndSourceId(LearnerInvitationSourceTypeEnum.PACKAGE_SESSION.name(), packageSessionIds);
        packageSessionRepository.updateStatusByLevelIds(LevelStatusEnum.DELETED.name(), levelIds);
        return "Levels deleted successfully";
    }

    private Date getStartDatePackageSessionDate(String packageId, String sessionId) {
        Optional<PackageSession> optionalPackageSession = packageSessionRepository.findLatestPackageSessionByPackageIdAndSessionId(packageId, sessionId);
        if (optionalPackageSession.isEmpty()) {
            return new Date();
        } else {
            return optionalPackageSession.get().getStartTime();
        }
    }


    public void addOrUpdateLevel(AddLevelWithSessionDTO addLevelWithSessionDTO,Session session,PackageEntity packageEntity,String instituteId,CustomUserDetails user){
        Level level = createOrAddLevel(addLevelWithSessionDTO.getId(), addLevelWithSessionDTO.getNewLevel(), addLevelWithSessionDTO.getLevelName(), addLevelWithSessionDTO.getDurationInDays(), addLevelWithSessionDTO.getThumbnailFileId(),instituteId);
        if (addLevelWithSessionDTO.isNewPackageSession()){
            packageSessionService.createPackageSession(level,session,packageEntity,null,session.getStartDate(),instituteId,user,addLevelWithSessionDTO.getAddFacultyToCourse());
        }else{
            packageSessionService.updatePackageSession(addLevelWithSessionDTO.getPackageSessionId(),addLevelWithSessionDTO.getPackageSessionStatus(),instituteId,addLevelWithSessionDTO.getAddFacultyToCourse());
        }
    }

}
