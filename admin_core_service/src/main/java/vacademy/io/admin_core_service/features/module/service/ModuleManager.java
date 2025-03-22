package vacademy.io.admin_core_service.features.module.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.service.ChapterManager;
import vacademy.io.admin_core_service.features.module.entity.SubjectModuleMapping;
import vacademy.io.admin_core_service.features.module.repository.ModuleRepository;
import vacademy.io.admin_core_service.features.module.repository.SubjectModuleMappingRepository;
import vacademy.io.common.institute.entity.module.Module;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.student.Subject;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ModuleManager {

    private final ModuleRepository moduleRepository;
    private final SubjectModuleMappingRepository subjectModuleMappingRepository;
    private final ChapterManager chapterManager;

    public void copyModulesOfSubject(Subject oldSubject, Subject newSubject, PackageSession oldPackageSession, PackageSession newPackageSession){
        List<Module> modulesOfSubject = subjectModuleMappingRepository.findModulesBySubjectIdAndPackageSessionId(oldSubject.getId(), oldPackageSession.getId());
        List<Module>newModules = new ArrayList<>();
        List<SubjectModuleMapping>subjectModuleMappings = new ArrayList<>();
        for(Module module : modulesOfSubject){
            Module newModule = new Module();
            newModule.setModuleName(module.getModuleName());
            newModule.setStatus(module.getStatus());
            newModule.setDescription(module.getDescription());
            newModule.setThumbnailId(module.getThumbnailId());
            newModules.add(newModule);
            SubjectModuleMapping subjectModuleMapping = new SubjectModuleMapping();
            subjectModuleMapping.setModule(newModule);
            subjectModuleMapping.setSubject(newSubject);
            subjectModuleMappings.add(subjectModuleMapping);
        }
        moduleRepository.saveAll(newModules);
        subjectModuleMappingRepository.saveAll(subjectModuleMappings);
        for (int i = 0; i < modulesOfSubject.size(); i++) {
            Module newModule = newModules.get(i);
            Module oldModule = modulesOfSubject.get(i);
            chapterManager.copyChaptersOfModule(oldModule, newModule, oldPackageSession, newPackageSession);
        }
    }
}
