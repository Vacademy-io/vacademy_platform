package vacademy.io.admin_core_service.features.packages.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.institute.entity.Group;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.session.Session;

@Service
public class TeacherPackageSessionService {
    @Autowired
    private PackageSessionRepository packageSessionRepository;

    public PackageSession createPackageSession(Group group, Level level, Session session, PackageEntity packageEntity) {
        PackageSession packageSession = new PackageSession();
        packageSession.setSession(session);
        packageSession.setPackageEntity(packageEntity);
        packageSession.setLevel(level);
        packageSession.setGroup(group);
        packageSession.setStatus(PackageSessionStatusEnum.DRAFT.name());
        packageSessionRepository.save(packageSession);
        return packageSession;
    }
}
