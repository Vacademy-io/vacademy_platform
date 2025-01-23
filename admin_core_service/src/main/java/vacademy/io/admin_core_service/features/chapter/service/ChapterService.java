package vacademy.io.admin_core_service.features.chapter.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDTO;
import vacademy.io.admin_core_service.features.chapter.entity.Chapter;
import vacademy.io.admin_core_service.features.chapter.entity.ChapterPackageSessionMapping;
import vacademy.io.admin_core_service.features.chapter.enums.ChapterStatus;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterRepository;
import vacademy.io.admin_core_service.features.module.entity.ModuleChapterMapping;
import vacademy.io.admin_core_service.features.module.repository.ModuleChapterMappingRepository;
import vacademy.io.admin_core_service.features.module.repository.ModuleRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.module.Module;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChapterService {
    private final ChapterRepository chapterRepository;
    private final ModuleRepository moduleRepository;
    private final PackageSessionRepository packageSessionRepository;
    private  final ChapterPackageSessionMappingRepository chapterPackageSessionMappingRepository;
    private final ModuleChapterMappingRepository moduleChapterMappingRepository;

    @Transactional
    public ChapterDTO addChapter(ChapterDTO chapterDTO, String moduleId,String commaSeparatedPackageSessionIds, CustomUserDetails user) {
        validateRequest(chapterDTO, moduleId,commaSeparatedPackageSessionIds);
        Optional<Module>optionalModule = moduleRepository.findById(moduleId);
        if (optionalModule.isEmpty()) {
            throw new VacademyException("Module not found");
        }
        Chapter chapter = new Chapter(chapterDTO);
        chapter = chapterRepository.save(chapter);
        ModuleChapterMapping moduleChapterMapping = new ModuleChapterMapping(chapter,optionalModule.get());
        moduleChapterMappingRepository.save(moduleChapterMapping);
        String[] packageSessionIds = getPackageSessionIds(commaSeparatedPackageSessionIds);
        for (String packageSessionId : packageSessionIds) {
            Optional< PackageSession>optionalPackageSession = packageSessionRepository.findById(packageSessionId);
            if (optionalPackageSession.isEmpty()) {
                throw new VacademyException("Package Session not found");
            }
            ChapterPackageSessionMapping chapterPackageSessionMapping = new ChapterPackageSessionMapping(chapter, optionalPackageSession.get());
            chapterPackageSessionMappingRepository.save(chapterPackageSessionMapping);
        }
        chapterDTO.setId(chapter.getId());
        chapterDTO.setStatus(ChapterStatus.ACTIVE.name());
        return chapterDTO;
    }

    private void validateRequest(ChapterDTO chapterDTO, String moduleId, String commaSeparatedPackageSessionIds) {
        if (Objects.isNull(chapterDTO)) {
            throw new VacademyException("Chapter cannot be null");
        }
        if (Objects.isNull(moduleId)) {
            throw new VacademyException("Module ID cannot be null");
        }
        if (Objects.isNull(commaSeparatedPackageSessionIds)) {
            throw new VacademyException("Package session IDs cannot be null");
        }
        if (Objects.isNull(chapterDTO.getChapterName())) {
            throw new VacademyException("Chapter name cannot be null");
        }
    }

    @Transactional
    public String updateChapter(String chapterId, ChapterDTO chapterDTO,String commaSeparatedPackageSessionIds, CustomUserDetails user) {
        if (Objects.isNull(chapterId)) {
            throw new VacademyException("Chapter ID cannot be null");
        }
        Optional<Chapter> optionalChapter = chapterRepository.findById(chapterId);
        if (optionalChapter.isEmpty()) {
            throw new VacademyException("Chapter not found");
        }
        Chapter chapter = optionalChapter.get();
        updateChapterDetails(chapterDTO,chapter);
        chapterRepository.save(chapter);
        updateChapterPackageSessionMapping(chapter,commaSeparatedPackageSessionIds);
        return "Chapter updated successfully";
    }

    @Transactional
    private void updateChapterPackageSessionMapping(Chapter chapter, String commaSeparatedPackageSessionIds) {
        // Parse the incoming comma-separated IDs into a Set
        Set<String> incomingIds = new HashSet<>(Arrays.asList(commaSeparatedPackageSessionIds.split(",")));

        // Fetch existing mappings from the database
        List<ChapterPackageSessionMapping> existingMappings = chapterPackageSessionMappingRepository
                .findByChapter(chapter);

        // Extract existing package session IDs
        Set<String> existingIds = existingMappings.stream()
                .map(mapping -> mapping.getPackageSession().getId())
                .collect(Collectors.toSet());

        // Determine IDs to add and remove
        Set<String> idsToAdd = new HashSet<>(incomingIds);
        idsToAdd.removeAll(existingIds);

        Set<String> idsToRemove = new HashSet<>(existingIds);
        idsToRemove.removeAll(incomingIds);

        // Add new mappings
        for (String packageSessionId : idsToAdd) {
            PackageSession packageSession = packageSessionRepository.findById(packageSessionId)
                    .orElseThrow(() -> new IllegalArgumentException("Invalid PackageSession ID: " + packageSessionId));
            ChapterPackageSessionMapping newMapping = new ChapterPackageSessionMapping(chapter, packageSession);
            chapterPackageSessionMappingRepository.save(newMapping);
        }

        // Remove obsolete mappings
        for (String packageSessionId : idsToRemove) {
            ChapterPackageSessionMapping mappingToRemove = existingMappings.stream()
                    .filter(mapping -> mapping.getPackageSession().getId().equals(packageSessionId))
                    .findFirst()
                    .orElse(null);

            if (mappingToRemove != null) {
                mappingToRemove.setStatus(ChapterStatus.DELETED.name());
                chapterPackageSessionMappingRepository.save(mappingToRemove);
            }
        }
    }


    public void updateChapterDetails(ChapterDTO chapterDTO,Chapter chapter){
        if (chapterDTO.getChapterName() != null){
            chapter.setChapterName(chapterDTO.getChapterName());
        }
        if (chapterDTO.getDescription() != null){
            chapter.setDescription(chapterDTO.getDescription());
        }
        if (chapterDTO.getFileId() != null){
            chapter.setFileId(chapterDTO.getFileId());
        }
    }
    private String[] getPackageSessionIds(String commaSeparatedPackageSessionIds) {
        return commaSeparatedPackageSessionIds.split(",");
    }

}
