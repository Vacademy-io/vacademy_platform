package vacademy.io.admin_core_service.features.chapter.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDTO;
import vacademy.io.admin_core_service.features.chapter.dto.UpdateChapterOrderDTO;
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
    private final ChapterPackageSessionMappingRepository chapterPackageSessionMappingRepository;
    private final ModuleChapterMappingRepository moduleChapterMappingRepository;

    @Transactional
    public ChapterDTO addChapter(ChapterDTO chapterDTO, String moduleId, String commaSeparatedPackageSessionIds, CustomUserDetails user) {
        // Validate incoming data
        validateRequest(chapterDTO, moduleId, commaSeparatedPackageSessionIds);

        // Find the module by ID
        Optional<Module> optionalModule = moduleRepository.findById(moduleId);
        if (optionalModule.isEmpty()) {
            throw new VacademyException("Module not found");
        }
        Module module = optionalModule.get();

        // Create and save a new chapter
        Chapter chapter = new Chapter(chapterDTO);
        chapter = chapterRepository.save(chapter);

        // Create a mapping between the chapter and the module
        ModuleChapterMapping moduleChapterMapping = new ModuleChapterMapping(chapter, module);
        moduleChapterMappingRepository.save(moduleChapterMapping);

        // Process comma-separated package session IDs
        String[] packageSessionIds = getPackageSessionIds(commaSeparatedPackageSessionIds);
        for (String packageSessionId : packageSessionIds) {
            // Find the package session by ID
            Optional<PackageSession> optionalPackageSession = packageSessionRepository.findById(packageSessionId);
            if (optionalPackageSession.isEmpty()) {
                throw new VacademyException("Package Session not found");
            }
            PackageSession packageSession = optionalPackageSession.get();

            // Create a mapping between the chapter and the package session
            ChapterPackageSessionMapping chapterPackageSessionMapping = new ChapterPackageSessionMapping(chapter, packageSession,chapterDTO.getChapterOrder()); // needs to handle one edge case where in if one chapter is connected with multiple package sessions that time chapter order
            chapterPackageSessionMappingRepository.save(chapterPackageSessionMapping);
        }

        // Set chapter ID and status in the DTO
        chapterDTO.setId(chapter.getId());
        chapterDTO.setStatus(ChapterStatus.ACTIVE.name());
        return chapterDTO;
    }

    private void validateRequest(ChapterDTO chapterDTO, String moduleId, String commaSeparatedPackageSessionIds) {
        if (chapterDTO == null) {
            throw new VacademyException("Chapter cannot be null");
        }
        if (moduleId == null) {
            throw new VacademyException("Module ID cannot be null");
        }
        if (commaSeparatedPackageSessionIds == null) {
            throw new VacademyException("Package session IDs cannot be null");
        }
        if (chapterDTO.getChapterName() == null) {
            throw new VacademyException("Chapter name cannot be null");
        }
    }

    @Transactional
    public String updateChapter(String chapterId, ChapterDTO chapterDTO, String commaSeparatedPackageSessionIds, CustomUserDetails user) {
        // Validate chapter ID
        if (chapterId == null) {
            throw new VacademyException("Chapter ID cannot be null");
        }

        // Find the chapter by ID
        Optional<Chapter> optionalChapter = chapterRepository.findById(chapterId);
        if (optionalChapter.isEmpty()) {
            throw new VacademyException("Chapter not found");
        }
        Chapter chapter = optionalChapter.get();

        // Update chapter details
        updateChapterDetails(chapterDTO, chapter);

        // Save the updated chapter
        chapterRepository.save(chapter);

        // Update the chapter-package session mappings
        updateChapterPackageSessionMapping(chapter, commaSeparatedPackageSessionIds,chapterDTO.getChapterOrder());

        // Return success message
        return "Chapter updated successfully";
    }

    @Transactional
    private void updateChapterPackageSessionMapping(Chapter chapter, String commaSeparatedPackageSessionIds,Integer chapterOrder) {
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
            ChapterPackageSessionMapping newMapping = new ChapterPackageSessionMapping(chapter, packageSession,chapterOrder);
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

    public void updateChapterDetails(ChapterDTO chapterDTO, Chapter chapter) {
        if (chapterDTO.getChapterName() != null) {
            chapter.setChapterName(chapterDTO.getChapterName());
        }
        if (chapterDTO.getDescription() != null) {
            chapter.setDescription(chapterDTO.getDescription());
        }
        if (chapterDTO.getFileId() != null) {
            chapter.setFileId(chapterDTO.getFileId());
        }
    }

    private String[] getPackageSessionIds(String commaSeparatedPackageSessionIds) {
        return commaSeparatedPackageSessionIds.split(",");
    }

    @Transactional
    public String updateChapterOrder(List<UpdateChapterOrderDTO> updateChapterOrderDTOS, CustomUserDetails user) {
        if (updateChapterOrderDTOS == null || updateChapterOrderDTOS.isEmpty()) {
            throw new VacademyException("No chapter order updates provided");
        }

        // Validate and collect the required chapter IDs and session IDs
        List<String> chapterIds = updateChapterOrderDTOS.stream()
                .map(UpdateChapterOrderDTO::getChapterId)
                .distinct()
                .collect(Collectors.toList());

        List<String> packageSessionIds = updateChapterOrderDTOS.stream()
                .map(UpdateChapterOrderDTO::getPackageSessionId)
                .distinct()
                .collect(Collectors.toList());

        // Fetch all the mappings in a single query
        List<ChapterPackageSessionMapping> mappings = chapterPackageSessionMappingRepository
                .findByChapterIdInAndPackageSessionIdIn(chapterIds, packageSessionIds);

        // Create a map for quick lookup of mappings by chapter ID and session ID
        Map<String, Map<String, ChapterPackageSessionMapping>> mappingMap = mappings.stream()
                .collect(Collectors.groupingBy(mapping -> mapping.getChapter().getId(),
                        Collectors.toMap(mapping -> mapping.getPackageSession().getId(), mapping -> mapping)));

        // Validate each DTO and process updates
        for (UpdateChapterOrderDTO updateChapterOrderDTO : updateChapterOrderDTOS) {
            validateUpdateChapterOrderDTO(updateChapterOrderDTO);

            // Find the mapping for the chapter and session using the pre-built map
            ChapterPackageSessionMapping mapping = Optional.ofNullable(mappingMap
                            .get(updateChapterOrderDTO.getChapterId()))
                    .map(sessionMapping -> sessionMapping.get(updateChapterOrderDTO.getPackageSessionId()))
                    .orElseThrow(() -> new VacademyException(
                            String.format("Mapping not found for Chapter ID: %s and Package Session ID: %s",
                                    updateChapterOrderDTO.getChapterId(), updateChapterOrderDTO.getPackageSessionId())));

            // Update the chapter order
            mapping.setChapterOrder(updateChapterOrderDTO.getChapterOrder());
        }

        // Perform a batch save for all updated mappings
        chapterPackageSessionMappingRepository.saveAll(mappings);

        return "Chapter order updated successfully";
    }

    private void validateUpdateChapterOrderDTO(UpdateChapterOrderDTO dto) {
        if (dto.getChapterId() == null || dto.getChapterId().isEmpty()) {
            throw new VacademyException("Chapter ID cannot be null or empty");
        }
        if (dto.getPackageSessionId() == null || dto.getPackageSessionId().isEmpty()) {
            throw new VacademyException("Package Session ID cannot be null or empty");
        }
        if (dto.getChapterOrder() == null || dto.getChapterOrder() < 0) {
            throw new VacademyException("Chapter order must be a non-negative number");
        }
    }

}