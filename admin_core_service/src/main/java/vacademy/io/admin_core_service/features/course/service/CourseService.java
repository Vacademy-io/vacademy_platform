package vacademy.io.admin_core_service.features.course.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.course.dto.AddCourseDTO;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.level.dto.AddLevelWithCourseDTO;
import vacademy.io.admin_core_service.features.level.service.LevelService;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageInstituteRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.packages.service.PackageSessionService;
import vacademy.io.admin_core_service.features.session.dto.AddNewSessionDTO;
import vacademy.io.admin_core_service.features.session.dto.AddSessionDTO;
import vacademy.io.admin_core_service.features.session.service.SessionService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.PackageDTO;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.PackageInstitute;
import vacademy.io.common.institute.entity.session.Session;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class CourseService {
    private final PackageRepository packageRepository;
    private final LevelService levelService;
    private final PackageSessionService packageSessionService;
    private final SessionService sessionService;
    private final PackageInstituteRepository packageInstituteRepository;
    private final InstituteRepository instituteRepository;
    private final PackageSessionRepository packageSessionRepository;

    @Transactional
    public String addCourse(AddCourseDTO addCourseDTO, CustomUserDetails user, String instituteId) {
        PackageEntity savedPackage = null;

        if (addCourseDTO.getNewCourse()){
            PackageEntity packageEntity = getCourse(addCourseDTO);
            savedPackage = packageRepository.save(packageEntity);
        }else{
            savedPackage = packageRepository.findById(addCourseDTO.getId()).orElseThrow(() -> new VacademyException("Course not found"));
        }
        createPackageInstitute(savedPackage, instituteId);
        if (addCourseDTO.getContainLevels()) {
            createPackageSession(savedPackage, addCourseDTO.getSessions(), user,instituteId);
        } else {
            createPackageSessionForDefaultLevelAndSession(savedPackage,instituteId, user);
        }
        return savedPackage.getId();
    }

    private void createPackageSessionForDefaultLevelAndSession(PackageEntity savedPackage,String instituteId, CustomUserDetails user) {
        Level level = levelService.getLevelById("DEFAULT");
        Session session = sessionService.getSessionById("DEFAULT");
        packageSessionService.createPackageSession(level, session, savedPackage, new Date(),instituteId,user);
    }

    private void createPackageSession(PackageEntity savedPackage, List<AddNewSessionDTO> addNewSessionDTOS, CustomUserDetails user,String instituteId) {
        if (Objects.isNull(addNewSessionDTOS) || addNewSessionDTOS.isEmpty()) {
            throw new VacademyException("Levels and Sessions cannot be null or empty. You must provide at least one level.");
        }
        for (AddNewSessionDTO addNewSessionDTO : addNewSessionDTOS) {
            addNewSessionDTO.getLevels().forEach(level -> level.setPackageId(savedPackage.getId()));
            sessionService.addNewSession(addNewSessionDTO,instituteId, user);
        }
    }


    private void validateRequest(AddCourseDTO addCourseDTO) {
        if (Objects.isNull(addCourseDTO)) {
            throw new VacademyException("Invalid request");
        }
        if (Objects.isNull(addCourseDTO.getCourseName())) {
            throw new VacademyException("Course name cannot be null");
        }
    }

    public PackageEntity getCourse(AddCourseDTO addCourseDTO) {
        validateRequest(addCourseDTO);
        PackageEntity packageEntity = new PackageEntity();
        packageEntity.setPackageName(addCourseDTO.getCourseName());
        packageEntity.setThumbnailFileId(addCourseDTO.getThumbnailFileId());
        packageEntity.setStatus(PackageStatusEnum.ACTIVE.name());
        return packageEntity;
    }

    private PackageInstitute createPackageInstitute(PackageEntity packageEntity, String instituteId) {
        PackageInstitute packageInstitute = new PackageInstitute();
        packageInstitute.setPackageEntity(packageEntity);
        packageInstitute.setInstituteEntity(instituteRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException("Institute not found with ID: " + instituteId)));
        return packageInstituteRepository.save(packageInstitute);
    }

    public String updateCourse(PackageDTO packageDTO, CustomUserDetails user, String packageId) {
        PackageEntity packageEntity = packageRepository.findById(packageId).orElseThrow(() -> new VacademyException("Course not found"));
        packageEntity.setPackageName(packageDTO.getPackageName());
        packageEntity.setThumbnailFileId(packageDTO.getThumbnailFileId());
        packageRepository.save(packageEntity);
        return "Course updated successfully";
    }

    public String deleteCourses(List<String> courseIds, CustomUserDetails userDetails) {
        List<PackageEntity> courses = packageRepository.findAllById(courseIds);
        List<PackageEntity> deletedCourses = new ArrayList<>();
        for (PackageEntity course : courses) {
            course.setStatus(PackageStatusEnum.DELETED.name());
            deletedCourses.add(course);
        }
        packageRepository.saveAll(deletedCourses);
        packageSessionRepository.updateStatusByPackageIds(PackageStatusEnum.DELETED.name(), courseIds);
        return "Course deleted successfully";
    }
}
