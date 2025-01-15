package vacademy.io.admin_core_service.features.module.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.module.dto.ModuleDTO;
import vacademy.io.admin_core_service.features.module.enums.ModuleStatusEnum;
import vacademy.io.admin_core_service.features.module.repository.ModuleRepository;
import vacademy.io.admin_core_service.features.subject.entity.SubjectChapterModuleAndPackageSessionMapping;
import vacademy.io.admin_core_service.features.subject.repository.SubjectChapterModuleAndPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.subject.repository.SubjectRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.module.Module;
import vacademy.io.common.institute.entity.student.Subject;

@Service
@RequiredArgsConstructor
public class ModuleService {
    private final ModuleRepository moduleRepository;
    private final SubjectChapterModuleAndPackageSessionMappingRepository subjectChapterModuleAndPackageSessionMappingRepository;
    private final SubjectRepository subjectRepository;

    @Transactional
    public ModuleDTO addModule(String subjectId, ModuleDTO moduleDTO,CustomUserDetails user) {
        if (subjectId == null) {
            throw new VacademyException("Subject ID cannot be null");
        }
        validateModule(moduleDTO);
        Subject subject = subjectRepository.findById(subjectId).orElse(null);
        if (subject == null) {
            throw new VacademyException("Subject not found");
        }
        Module module = new Module();
        createModule(moduleDTO, module);
        module = moduleRepository.save(module);
        subjectChapterModuleAndPackageSessionMappingRepository.save(new SubjectChapterModuleAndPackageSessionMapping(subject, module));
        moduleDTO.setId(module.getId());
        return moduleDTO;
    }

    public ModuleDTO updateModule(String moduleId, ModuleDTO moduleDTO, CustomUserDetails user) {
        if (moduleId == null) {
            throw new VacademyException("Module ID cannot be null");
        }
        Module module = moduleRepository.findById(moduleId).orElse(null);
        if (module == null) {
            throw new VacademyException("Module not found");
        }
        moduleDTO.setId(moduleId);
        createModule(moduleDTO, module);
        module = moduleRepository.save(module);
        moduleDTO.setId(module.getId());
        return moduleDTO;
    }

    public String deleteModule(String moduleId,CustomUserDetails user) {
        if (moduleId == null) {
            throw new VacademyException("Module ID cannot be null");
        }
        Module module = moduleRepository.findById(moduleId).orElse(null);
        if (module == null) {
            throw new VacademyException("Module not found");
        }
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
