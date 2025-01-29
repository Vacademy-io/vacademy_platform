package vacademy.io.admin_core_service.features.packages.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.session.Session;

@Service
@RequiredArgsConstructor
public class PackageSessionService {
    private final PackageSessionRepository packageRepository;

    public void createPackageSession(Level level, Session session, PackageEntity packageEntity) {
        PackageSession packageSession = new PackageSession();
        packageSession.setSession(session);
        packageSession.setLevel(level);
        packageSession.setPackageEntity(packageEntity);
        packageSession.setStatus(PackageStatusEnum.ACTIVE.name());
        packageRepository.save(packageSession);
    }
}
