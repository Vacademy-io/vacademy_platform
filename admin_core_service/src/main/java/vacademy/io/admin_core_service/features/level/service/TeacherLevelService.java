package vacademy.io.admin_core_service.features.level.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.group.service.GroupService;
import vacademy.io.admin_core_service.features.level.dto.AddLevelWithSessionDTO;
import vacademy.io.admin_core_service.features.level.enums.LevelStatusEnum;
import vacademy.io.admin_core_service.features.level.repository.LevelRepository;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.service.PackageSessionService;
import vacademy.io.admin_core_service.features.packages.service.TeacherPackageSessionService;
import vacademy.io.common.institute.entity.Group;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.session.Session;

@Service
public class TeacherLevelService {

    @Autowired
    private LevelRepository levelRepository;

    @Autowired
    private GroupService groupService;

    @Autowired
    private TeacherPackageSessionService packageSessionService;

    public PackageSession addLevel(AddLevelWithSessionDTO addLevelWithSessionDTO, Session session, PackageEntity packageEntity) {
        Level level = new Level();
        level.setLevelName(addLevelWithSessionDTO.getLevelName());
        level.setDurationInDays(addLevelWithSessionDTO.getDurationInDays());
        level.setThumbnailFileId(addLevelWithSessionDTO.getThumbnailFileId());
        level.setStatus(LevelStatusEnum.DRAFT.name());
        Group group = groupService.addGroup(addLevelWithSessionDTO.getGroup());
        levelRepository.save(level);
        return packageSessionService.createPackageSession(group, level, session, packageEntity);
    }
}
