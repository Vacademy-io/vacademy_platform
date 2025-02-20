package vacademy.io.admin_core_service.features.module.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute.repository.InstituteRepository;
import vacademy.io.admin_core_service.features.module.dto.ModuleDTO;
import vacademy.io.admin_core_service.features.module.dto.UpdateModuleOrderDTO;
import vacademy.io.admin_core_service.features.module.entity.SubjectModuleMapping;
import vacademy.io.admin_core_service.features.module.enums.ModuleStatusEnum;
import vacademy.io.admin_core_service.features.module.repository.ModuleRepository;
import vacademy.io.admin_core_service.features.module.repository.SubjectModuleMappingRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.subject.repository.SubjectChapterModuleAndPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.subject.repository.SubjectRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.module.Module;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.student.Subject;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ModuleService {

    private final ModuleRepository moduleRepository;
    private final SubjectChapterModuleAndPackageSessionMappingRepository subjectChapterModuleAndPackageSessionMappingRepository;
    private final SubjectRepository subjectRepository;
    private final InstituteRepository instituteRepository;
    private final PackageSessionRepository packageSessionRepository;
    private final SubjectModuleMappingRepository subjectModuleMappingRepository;

    // Add module to subject
    @Transactional
    public ModuleDTO addModule(String subjectId, ModuleDTO moduleDTO, CustomUserDetails user) {
        // Validate subject ID
        if (subjectId == null) {
            throw new VacademyException("Subject ID cannot be null");
        }

        // Validate module details
        validateModule(moduleDTO);

        // Find subject by ID
        Subject subject = findSubjectById(subjectId);

        // Create and save module
        Module module = createAndSaveModule(moduleDTO);

        // Save mapping between subject and module
        saveMapping(subject, module);

        // Set ID in DTO and return
        moduleDTO.setId(module.getId());
        return moduleDTO;
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
        subjectModuleMappingRepository.save(new SubjectModuleMapping(subject, module));
    }

    public ModuleDTO updateModule(String moduleId, ModuleDTO moduleDTO, CustomUserDetails user) {
        // Validate module ID
        if (moduleId == null) {
            throw new VacademyException("Module ID cannot be null");
        }

        // Find module by ID
        Module module = moduleRepository.findById(moduleId)
                .orElseThrow(() -> new VacademyException("Module not found"));

        // Update module details
        moduleDTO.setId(moduleId);
        createModule(moduleDTO, module);

        // Save updated module
        module = moduleRepository.save(module);

        // Return updated module details
        moduleDTO.setId(module.getId());
        return moduleDTO;
    }

    public String deleteModule(List<String> moduleIds, CustomUserDetails user) {
        if (moduleIds == null || moduleIds.isEmpty()) {
            throw new VacademyException("Module IDs cannot be null or empty");
        }

        List<Module> modules = moduleRepository.findAllById(moduleIds);

        if (modules.size() != moduleIds.size()) {
            throw new VacademyException("Some modules not found");
        }

        modules.forEach(module -> module.setStatus(ModuleStatusEnum.DELETED.name()));
        moduleRepository.saveAll(modules);

        return "Modules deleted successfully";
    }

    private void validateModule(ModuleDTO moduleDTO) {
        if (moduleDTO.getModuleName() == null) {
            throw new VacademyException("Module name cannot be null");
        }
    }

    private void createModule(ModuleDTO moduleDTO, Module module) {
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

    public String updateModuleOrder(List<UpdateModuleOrderDTO> updateModuleOrderDTOS, CustomUserDetails user) {
        if (updateModuleOrderDTOS == null || updateModuleOrderDTOS.isEmpty()) {
            throw new VacademyException("No module order updates provided.");
        }

        // Validate and fetch mappings in a batch for better efficiency
        List<String> subjectIds = updateModuleOrderDTOS.stream()
                .map(UpdateModuleOrderDTO::getSubjectId)
                .toList();
        List<String> moduleIds = updateModuleOrderDTOS.stream()
                .map(UpdateModuleOrderDTO::getModuleId)
                .toList();

        // Fetch all mappings at once (assumes a batch method in repository)
        List<SubjectModuleMapping> existingMappings = subjectModuleMappingRepository
                .findAllBySubjectIdInAndModuleIdIn(subjectIds, moduleIds);

        if (existingMappings.isEmpty()) {
            throw new VacademyException("No mappings found for the provided subject and module IDs.");
        }

        // Create a map for fast lookup
        Map<String, UpdateModuleOrderDTO> dtoMap = updateModuleOrderDTOS.stream()
                .collect(Collectors.toMap(
                        dto -> dto.getSubjectId() + ":" + dto.getModuleId(),
                        dto -> dto
                ));

        // Update the module orders
        for (SubjectModuleMapping mapping : existingMappings) {
            String key = mapping.getSubject().getId() + ":" + mapping.getModule().getId();
            if (dtoMap.containsKey(key)) {
                UpdateModuleOrderDTO dto = dtoMap.get(key);
                mapping.setModuleOrder(dto.getModuleOrder());
            }
        }

        // Save all updated mappings
        subjectModuleMappingRepository.saveAll(existingMappings);

        return "Module order updated successfully.";
    }
}
