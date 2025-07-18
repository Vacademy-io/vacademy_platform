package vacademy.io.admin_core_service.features.course.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.course.dto.AddCourseDTO;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.level.service.TeacherLevelService;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageInstituteRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.session.dto.AddNewSessionDTO;
import vacademy.io.admin_core_service.features.session.service.TeacherSessionService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.PackageInstitute;
import vacademy.io.common.institute.entity.session.Session;

import java.util.stream.Collectors;

@Service
public class TeacherCourseService {

    @Autowired
    private PackageRepository packageRepository;

    @Autowired
    private PackageInstituteRepository packageInstituteRepository;

    @Autowired
    private InstituteRepository instituteRepository;

    @Autowired
    private TeacherLevelService teacherLevelService;

    @Autowired
    private TeacherSessionService teacherSessionService;

    public String addCourse(AddCourseDTO addCourseDTO, CustomUserDetails user, String instituteId) {
        PackageEntity savedPackage = null;

        if (addCourseDTO.getNewCourse()) {
            PackageEntity packageEntity = getCourse(addCourseDTO);
            savedPackage = packageRepository.save(packageEntity);
        } else {
            savedPackage = packageRepository.findById(addCourseDTO.getId()).orElseThrow(() -> new VacademyException("Course not found"));
        }
        createPackageInstitute(savedPackage, instituteId);
        for(AddNewSessionDTO addNewSessionDTO : addCourseDTO.getSessions()) {
            teacherSessionService.addSession(savedPackage,addNewSessionDTO);
        }
        return savedPackage.getId();
    }

    private PackageInstitute createPackageInstitute(PackageEntity packageEntity, String instituteId) {
        PackageInstitute packageInstitute = new PackageInstitute();
        packageInstitute.setPackageEntity(packageEntity);
        packageInstitute.setInstituteEntity(instituteRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException("Institute not found with ID: " + instituteId)));
        return packageInstituteRepository.save(packageInstitute);
    }


    public PackageEntity getCourse(AddCourseDTO addCourseDTO) {
        PackageEntity packageEntity = new PackageEntity();
        packageEntity.setPackageName(addCourseDTO.getCourseName());
        packageEntity.setThumbnailFileId(addCourseDTO.getThumbnailFileId());
        packageEntity.setStatus(PackageStatusEnum.DRAFT.name());
        packageEntity.setIsCoursePublishedToCatalaouge(addCourseDTO.getIsCoursePublishedToCatalaouge());
        packageEntity.setCoursePreviewImageMediaId(addCourseDTO.getCoursePreviewImageMediaId());
        packageEntity.setCourseBannerMediaId(addCourseDTO.getCourseBannerMediaId());
        packageEntity.setCourseMediaId(addCourseDTO.getCourseMediaId());
        packageEntity.setWhyLearn(addCourseDTO.getWhyLearnHtml());
        packageEntity.setWhoShouldLearn(addCourseDTO.getWhoShouldLearnHtml());
        packageEntity.setAboutTheCourse(addCourseDTO.getAboutTheCourseHtml());
        if (addCourseDTO.getTags() != null && !addCourseDTO.getTags().isEmpty()) {
            packageEntity.setTags(addCourseDTO.getTags().stream()
                    .map(String::toLowerCase)
                    .map(String::trim)
                    .collect(Collectors.joining(",")));
        }
        packageEntity.setCourseDepth(addCourseDTO.getCourseDepth());
        packageEntity.setCourseHtmlDescription(addCourseDTO.getCourseHtmlDescription());
        return packageEntity;
    }
}
