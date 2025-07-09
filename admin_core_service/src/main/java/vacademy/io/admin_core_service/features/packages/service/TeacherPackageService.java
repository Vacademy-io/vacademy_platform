package vacademy.io.admin_core_service.features.packages.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.course.dto.AddCourseDTO;
import vacademy.io.admin_core_service.features.level.repository.LevelRepository;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.common.institute.entity.PackageEntity;

import java.util.stream.Collectors;

@Service
public class TeacherPackageService {
    @Autowired
    private PackageRepository packageEntityRepository;

    private void addPackage(AddCourseDTO addCourseDTO){
        PackageEntity packageEntity = new PackageEntity();
    }


}
