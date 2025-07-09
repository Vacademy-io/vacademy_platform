package vacademy.io.admin_core_service.features.session.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.level.dto.AddLevelWithSessionDTO;
import vacademy.io.admin_core_service.features.level.service.LevelService;
import vacademy.io.admin_core_service.features.level.service.TeacherLevelService;
import vacademy.io.admin_core_service.features.packages.repository.PackageInstituteRepository;
import vacademy.io.admin_core_service.features.session.dto.AddNewSessionDTO;
import vacademy.io.admin_core_service.features.session.enums.SessionStatusEnum;
import vacademy.io.admin_core_service.features.session.repository.SessionRepository;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.PackageInstitute;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.session.Session;

@Service
public class TeacherSessionService {

    @Autowired
    private SessionRepository sessionRepository;

    @Autowired
    private PackageInstituteRepository packageInstituteRepository;

    @Autowired
    private TeacherLevelService teacherLevelService;

    @Autowired
    private InstituteRepository instituteRepository;

    public void addSession(PackageEntity packageEntity, AddNewSessionDTO addNewSessionDTO) {
        Session session = new Session();
        session.setSessionName(addNewSessionDTO.getSessionName());
        session.setStatus(SessionStatusEnum.DRAFT.name());
        session.setStartDate(addNewSessionDTO.getStartDate());
        Session savedSession = sessionRepository.save(session);
        for (AddLevelWithSessionDTO addLevelWithSessionDTO : addNewSessionDTO.getLevels()) {
            teacherLevelService.addLevel(addLevelWithSessionDTO, savedSession, packageEntity);
        }
    }

}
