package vacademy.io.admin_core_service.features.course.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.course.dto.AddCourseDTO;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.level.dto.AddLevelDTO;
import vacademy.io.admin_core_service.features.level.service.LevelService;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageInstituteRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.packages.service.PackageSessionService;
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

    @Transactional
    public String addCourse(AddCourseDTO addCourseDTO, CustomUserDetails user,String instituteId) {
        validateRequest(addCourseDTO);
        PackageEntity packageEntity = getCourse(addCourseDTO);
        PackageEntity savedPackage = packageRepository.save(packageEntity);
        createPackageInstitute(savedPackage, instituteId);
        if (addCourseDTO.getContainLevels()){
            createPackageSession(savedPackage, addCourseDTO.getLevels(), user);
        }
        else{
            createPackageSessionForDefaultLevelAndSession(savedPackage,user);
        }
        return savedPackage.getId();
    }

    private void createPackageSessionForDefaultLevelAndSession(PackageEntity savedPackage, CustomUserDetails user) {
        Level level = levelService.getLevelById("DEFAULT");
        Session session = sessionService.getSessionById("DEFAULT");
        packageSessionService.createPackageSession(level, session, savedPackage,new Date());
    }

    private void createPackageSession(PackageEntity savedPackage, List<AddLevelDTO>addLevelDTOS, CustomUserDetails user) {
        if (Objects.isNull(addLevelDTOS) || addLevelDTOS.isEmpty()) {
            throw new VacademyException("Levels cannot be null or empty. You must provide at least one level.");
        }
        for (AddLevelDTO addLevelDTO : addLevelDTOS) {
            validateRequest(addLevelDTO);
            Level level = levelService.createOrAddLevel(addLevelDTO);
            for (AddSessionDTO sessionDTO : addLevelDTO.getSessions()) {
                Session session = sessionService.createOrGetSession(sessionDTO);
                packageSessionService.createPackageSession(level, session, savedPackage,sessionDTO.getStartDate());
            }
        }
    }

    private void validateRequest(AddLevelDTO addLevelDTO) {
        if (Objects.isNull(addLevelDTO)) {
            throw new VacademyException("Invalid request");
        }
        if (Objects.isNull(addLevelDTO.getLevelName())) {
            throw new VacademyException("Level name cannot be null");
        }
        if (Objects.isNull(addLevelDTO.getSessions())) {
            throw new VacademyException("Sessions cannot be null");
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
        PackageEntity packageEntity = new PackageEntity();
        packageEntity.setPackageName(addCourseDTO.getCourseName());
        packageEntity.setThumbnailFileId(addCourseDTO.getThumbnailFileId());
        return packageEntity;
    }

    private PackageInstitute createPackageInstitute(PackageEntity packageEntity, String instituteId) {
        PackageInstitute packageInstitute = new PackageInstitute();
        packageInstitute.setPackageEntity(packageEntity);
        packageInstitute.setInstituteEntity(instituteRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException("Institute not found with ID: " + instituteId)));
        return packageInstituteRepository.save(packageInstitute);
    }

    public String updateCourse(PackageDTO packageDTO, CustomUserDetails user,String packageId) {
        PackageEntity packageEntity = packageRepository.findById(packageId).orElseThrow(()->new VacademyException("Course not found"));
        packageEntity.setPackageName(packageDTO.getPackageName());
        packageEntity.setThumbnailFileId(packageDTO.getThumbnailFileId());
        packageRepository.save(packageEntity);
        return "Course updated successfully";
    }

    public String deleteCourse(List<String>courseIds,CustomUserDetails user) {
        List<PackageEntity>courses = packageRepository.findAllById(courseIds);
        List<PackageEntity>deletedCourses = new ArrayList<>();
        for(PackageEntity course:courses){
            course.setStatus(PackageStatusEnum.DELETED.name());
        }
        packageRepository.saveAll(courses);
        return "Course deleted successfully";
    }

}
