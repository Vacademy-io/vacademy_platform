package vacademy.io.admin_core_service.features.chapter.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.entity.Chapter;
import vacademy.io.admin_core_service.features.chapter.entity.ChapterPackageSessionMapping;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterRepository;
import vacademy.io.admin_core_service.features.module.entity.ModuleChapterMapping;
import vacademy.io.admin_core_service.features.module.repository.ModuleChapterMappingRepository;
import vacademy.io.admin_core_service.features.slide.service.SlideService;
import vacademy.io.common.institute.entity.module.Module;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.*;

@Service
@RequiredArgsConstructor
public class ChapterManager {

    private final ModuleChapterMappingRepository moduleChapterMappingRepository;
    private final ChapterPackageSessionMappingRepository chapterPackageSessionMappingRepository;
    private final SlideService slideService;
    private final ChapterRepository chapterRepository;

    public void copyChaptersOfModule(Module oldModule, Module newModule, PackageSession oldPackageSession, PackageSession newPackageSession){
        List<Chapter> chapters = moduleChapterMappingRepository.findChaptersByModuleIdAndStatusNotDeleted(oldModule.getId(),oldPackageSession.getId());
        List<Chapter>newChapters = new ArrayList<>();
        List<ChapterPackageSessionMapping>newChapterPackageSessionMappings = new ArrayList<>();
        List<ModuleChapterMapping>newModuleChapterMappings = new ArrayList<>();
        List<List<Chapter>> newChapterAndOldChapterMap = new ArrayList<>();
        for (Chapter chapter : chapters) {
            Chapter newChapter = new Chapter();
            newChapter.setChapterName(chapter.getChapterName());
            newChapter.setDescription(chapter.getDescription());
            newChapter.setFileId(chapter.getFileId());
            newChapter.setStatus(chapter.getStatus());
            Optional<ChapterPackageSessionMapping> optionalChapterPackageSessionMapping = chapterPackageSessionMappingRepository.findByChapterIdAndPackageSessionIdAndStatusNotDeleted(chapter.getId(),oldPackageSession.getId());
            if (optionalChapterPackageSessionMapping.isPresent()){
                ChapterPackageSessionMapping chapterPackageSessionMapping = optionalChapterPackageSessionMapping.get();
                ChapterPackageSessionMapping newChapterPackageSessionMapping = new ChapterPackageSessionMapping();
                newChapterPackageSessionMapping.setChapter(newChapter);
                newChapterPackageSessionMapping.setPackageSession(newPackageSession);
                newChapterPackageSessionMapping.setChapterOrder(chapterPackageSessionMapping.getChapterOrder());
                newChapterPackageSessionMappings.add(newChapterPackageSessionMapping);
                newChapters.add(newChapter);
                ModuleChapterMapping moduleChapterMapping = new ModuleChapterMapping(newChapter,newModule);
                newModuleChapterMappings.add(moduleChapterMapping);
                newChapterAndOldChapterMap.add(List.of(newChapter,chapter));
            }
        }
        chapterRepository.saveAll(newChapters);
        moduleChapterMappingRepository.saveAll(newModuleChapterMappings);
        chapterPackageSessionMappingRepository.saveAll(newChapterPackageSessionMappings);
        for (List<Chapter>newAndOldChapter : newChapterAndOldChapterMap) {
            slideService.copySlidesOfChapter(newAndOldChapter.get(1),newAndOldChapter.get(0));
        }
    }
}
