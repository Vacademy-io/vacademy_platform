package vacademy.io.admin_core_service.features.module.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.module.dto.ModuleDTO;
import vacademy.io.admin_core_service.features.module.enums.ModuleStatusEnum;
import vacademy.io.admin_core_service.features.module.repository.ModuleRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.subject.entity.SubjectChapterModuleAndPackageSessionMapping;
import vacademy.io.admin_core_service.features.subject.entity.SubjectModuleMapping;
import vacademy.io.admin_core_service.features.subject.repository.SubjectChapterModuleAndPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.subject.repository.SubjectModuleMappingRepository;
import vacademy.io.admin_core_service.features.subject.repository.SubjectRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.module.Module;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.student.Subject;

@Service
@RequiredArgsConstructor
public class ModuleService {
    private final ModuleRepository moduleRepository;
    private final SubjectChapterModuleAndPackageSessionMappingRepository subjectChapterModuleAndPackageSessionMappingRepository;
    private final SubjectRepository subjectRepository;
    private final InstituteRepository instituteRepository;
    private final PackageSessionRepository packageSessionRepository;
    private final SubjectModuleMappingRepository subjectModuleMappingRepository;

    @Transactional
    public ModuleDTO addModule(String subjectId,ModuleDTO moduleDTO, CustomUserDetails user) {
        validateSubjectId(subjectId);
        validateModule(moduleDTO);
        Subject subject = findSubjectById(subjectId);
        Module module = createAndSaveModule(moduleDTO);
        saveMapping(subject, module);
        moduleDTO.setId(module.getId());
        return moduleDTO;
    }

    private void validateSubjectId(String subjectId) {
        if (subjectId == null) {
            throw new VacademyException("Subject ID cannot be null");
        }
    }

    private Subject findSubjectById(String subjectId) {
        return subjectRepository.findById(subjectId)
                .orElseThrow(() -> new VacademyException("Subject not found"));
    }

    private Institute findInstituteById(String instituteId) {
        if (instituteId == null) {
            return null;
        }
        return instituteRepository.findById(instituteId)
                .orElseThrow(() -> new VacademyException("Institute not found"));
    }

    private PackageSession findPackageSessionById(String packageSessionId) {
        if (packageSessionId == null) {
            return null;
        }
        return packageSessionRepository.findById(packageSessionId)
                .orElseThrow(() -> new VacademyException("Package Session not found"));
    }

    private Module createAndSaveModule(ModuleDTO moduleDTO) {
        Module module = new Module();
        createModule(moduleDTO, module);
        return moduleRepository.save(module);
    }

    private void saveMapping(Subject subject, Module module) {
        subjectModuleMappingRepository.save(new SubjectModuleMapping(subject,module));
    }


    public ModuleDTO updateModule(String moduleId, ModuleDTO moduleDTO, CustomUserDetails user) {
        if (moduleId == null) {
            throw new VacademyException("Module ID cannot be null");
        }

        // Use Optional to directly handle the absence of the module
        Module module = moduleRepository.findById(moduleId)
                .orElseThrow(() -> new VacademyException("Module not found"));

        moduleDTO.setId(moduleId);
        createModule(moduleDTO, module);
        module = moduleRepository.save(module);

        moduleDTO.setId(module.getId());
        return moduleDTO;
    }

    public String deleteModule(String moduleId, CustomUserDetails user) {
        if (moduleId == null) {
            throw new VacademyException("Module ID cannot be null");
        }

        // Use Optional to directly handle the absence of the module
        Module module = moduleRepository.findById(moduleId)
                .orElseThrow(() -> new VacademyException("Module not found"));

        module.setStatus(ModuleStatusEnum.DELETED.name());
        moduleRepository.save(module);

        return "Module deleted successfully";
    }


    private void validateModule(ModuleDTO moduleDTO) {
        if (moduleDTO.getModuleName() == null) {
            throw new VacademyException("Module name cannot be null");
        }
    }

    public void createModule(ModuleDTO moduleDTO, Module module){
        if (moduleDTO.getId() != null) {
            module.setId(moduleDTO.getId());
        }
        if (moduleDTO.getModuleName() != null) {
            module.setModuleName(moduleDTO.getModuleName());
        }
        if (moduleDTO.getDescription() != null) {
            module.setDescription(moduleDTO.getDescription());
        }
        if (moduleDTO.getThumbnailId() != null) {
            module.setThumbnailId(moduleDTO.getThumbnailId());
        }
        moduleDTO.setStatus(ModuleStatusEnum.ACTIVE.name());
    }
}
