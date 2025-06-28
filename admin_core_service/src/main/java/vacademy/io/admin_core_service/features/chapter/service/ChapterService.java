package vacademy.io.admin_core_service.features.chapter.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDTO;
import vacademy.io.admin_core_service.features.chapter.dto.UpdateChapterOrderDTO;
import vacademy.io.admin_core_service.features.chapter.entity.Chapter;
import vacademy.io.admin_core_service.features.chapter.entity.ChapterPackageSessionMapping;
import vacademy.io.admin_core_service.features.chapter.enums.ChapterStatus;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterRepository;
import vacademy.io.admin_core_service.features.learner_tracking.service.LearnerTrackingAsyncService;
import vacademy.io.admin_core_service.features.module.entity.ModuleChapterMapping;
import vacademy.io.admin_core_service.features.module.entity.SubjectModuleMapping;
import vacademy.io.admin_core_service.features.module.repository.ModuleChapterMappingRepository;
import vacademy.io.admin_core_service.features.module.repository.ModuleRepository;
import vacademy.io.admin_core_service.features.module.repository.SubjectModuleMappingRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.subject.service.SubjectService;
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
    private final SubjectModuleMappingRepository subjectModuleMappingRepository;
    private final SubjectService subjectService;
    private final LearnerTrackingAsyncService learnerTrackingAsyncService;

    public ChapterDTO addChapter(ChapterDTO chapterDTO, String moduleId,String subjectId, String commaSeparatedPackageSessionIds, CustomUserDetails user) {
        validateRequest(chapterDTO, moduleId, commaSeparatedPackageSessionIds);
        Chapter chapter = saveChapter(chapterDTO);
        Optional<SubjectModuleMapping> subjectModuleMapping = subjectModuleMappingRepository.findByModuleId(moduleId);
        List<Module> modules = null;
        chapterDTO.setId(chapter.getId());
        chapterDTO.setStatus(ChapterStatus.ACTIVE.name());
        modules = subjectService.processSubjectsAndModules(Arrays.stream(getPackageSessionIds(commaSeparatedPackageSessionIds)).toList(), subjectModuleMapping.get().getSubject(), subjectModuleMapping.get().getModule());
        processPackageSessionMappings(chapter, commaSeparatedPackageSessionIds, chapterDTO.getChapterOrder());
        List<ModuleChapterMapping>moduleChapterMappings = new ArrayList<>();
        for (Module module:modules){
            moduleChapterMappings.add(new ModuleChapterMapping(chapter,module));
        }
        moduleChapterMappingRepository.saveAll(moduleChapterMappings);
        String[] packageSessionIds = getPackageSessionIds(commaSeparatedPackageSessionIds);
        for (String packageSessionId:packageSessionIds){
            learnerTrackingAsyncService.updateLearnerOperationsForBatch("CHAPTER",null,null,chapter.getId(),moduleId,subjectId,packageSessionId);
        }
        return chapterDTO;
    }

    private Module fetchModuleById(String moduleId) {
        return moduleRepository.findById(moduleId)
                .orElseThrow(() -> new VacademyException("Module not found"));
    }

    private Chapter saveChapter(ChapterDTO chapterDTO) {
        return chapterRepository.save(new Chapter(chapterDTO));
    }

    private void processChapterModuleMapping(Chapter chapter, List<Module> modules) {
        List<ModuleChapterMapping> newMappings = new ArrayList<>();

        for (Module module : modules) {
            boolean exists = moduleChapterMappingRepository.existsByChapterIdAndModuleId(chapter.getId(), module.getId());
            if (!exists) {
                newMappings.add(new ModuleChapterMapping(chapter, module));
            }
        }

        if (!newMappings.isEmpty()) {
            moduleChapterMappingRepository.saveAll(newMappings);
        }
    }

    private void processPackageSessionMappings(Chapter chapter, String commaSeparatedPackageSessionIds, Integer chapterOrder) {
        String[] packageSessionIds = getPackageSessionIds(commaSeparatedPackageSessionIds);
        for (String packageSessionId : packageSessionIds) {
            PackageSession packageSession = fetchPackageSessionById(packageSessionId);
            saveChapterPackageSessionMapping(chapter, packageSession, chapterOrder);
        }
    }

    private PackageSession fetchPackageSessionById(String packageSessionId) {
        return packageSessionRepository.findById(packageSessionId)
                .orElseThrow(() -> new VacademyException("Package Session not found"));
    }

    private void saveChapterPackageSessionMapping(Chapter chapter, PackageSession packageSession, Integer chapterOrder) {
        chapterPackageSessionMappingRepository.save(new ChapterPackageSessionMapping(chapter, packageSession, chapterOrder));
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
    public String updateChapter(String chapterId, String moduleId, ChapterDTO chapterDTO, String commaSeparatedPackageSessionIds, CustomUserDetails user) {
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

        Optional<SubjectModuleMapping> subjectModuleMapping = subjectModuleMappingRepository.findByModuleId(moduleId);

        List<Module> modules = subjectService.processSubjectsAndModules(Arrays.stream(getPackageSessionIds(commaSeparatedPackageSessionIds)).toList(), subjectModuleMapping.get().getSubject(), subjectModuleMapping.get().getModule());
        processChapterModuleMapping(chapter, modules);

        // Update the chapter-package session mappings
        updateChapterPackageSessionMapping(chapter, commaSeparatedPackageSessionIds, chapterDTO.getChapterOrder());


        return "Chapter updated successfully";
    }

    @Transactional
    private void updateChapterPackageSessionMapping(Chapter chapter, String commaSeparatedPackageSessionIds, Integer chapterOrder) {
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
            ChapterPackageSessionMapping newMapping = new ChapterPackageSessionMapping(chapter, packageSession, chapterOrder);
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
        // Validate if the list is empty or null
        if (updateChapterOrderDTOS == null || updateChapterOrderDTOS.isEmpty()) {
            throw new VacademyException("No chapter order updates provided");
        }

        // Validate and fetch chapter IDs and session IDs
        List<String> chapterIds = updateChapterOrderDTOS.stream()
                .map(UpdateChapterOrderDTO::getChapterId)
                .distinct()
                .collect(Collectors.toList());

        List<String> packageSessionIds = updateChapterOrderDTOS.stream()
                .map(UpdateChapterOrderDTO::getPackageSessionId)
                .distinct()
                .collect(Collectors.toList());

        // Fetch all mappings in a single query (batch query)
        List<ChapterPackageSessionMapping> existingMappings = chapterPackageSessionMappingRepository
                .findByChapterIdInAndPackageSessionIdIn(chapterIds, packageSessionIds);

        // If no mappings found, throw an exception
        if (existingMappings.isEmpty()) {
            throw new VacademyException("No mappings found for the provided chapter and session IDs.");
        }

        // Create a map for fast lookup: chapterId + ":" + sessionId as key, and the corresponding mapping as the value
        Map<String, ChapterPackageSessionMapping> mappingMap = existingMappings.stream()
                .collect(Collectors.toMap(
                        mapping -> mapping.getChapter().getId() + ":" + mapping.getPackageSession().getId(), // Key format: chapterId:sessionId
                        mapping -> mapping // Value is the mapping itself
                ));

        // Iterate over the DTOs and update the corresponding mappings
        for (UpdateChapterOrderDTO updateChapterOrderDTO : updateChapterOrderDTOS) {
            // Validate each DTO
            validateUpdateChapterOrderDTO(updateChapterOrderDTO);

            // Create the key for the lookup map based on chapterId and sessionId
            String key = updateChapterOrderDTO.getChapterId() + ":" + updateChapterOrderDTO.getPackageSessionId();

            // Find the mapping for the chapter and session using the pre-built map
            ChapterPackageSessionMapping mapping = mappingMap.get(key);
            if (mapping != null) {
                // Update the chapter order
                mapping.setChapterOrder(updateChapterOrderDTO.getChapterOrder());
            } else {
                throw new VacademyException(String.format(
                        "Mapping not found for Chapter ID: %s and Package Session ID: %s",
                        updateChapterOrderDTO.getChapterId(), updateChapterOrderDTO.getPackageSessionId()
                ));
            }
        }

        // Perform a batch save for all updated mappings
        chapterPackageSessionMappingRepository.saveAll(existingMappings);

        // Return a success message
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

    public String deleteChapter(List<String> chapterIds,String moduleId,String subjectId, String packageSessionIds, CustomUserDetails user) {
        List<ChapterPackageSessionMapping> chapterPackageSessionMappings = chapterPackageSessionMappingRepository.findByChapterIdInAndPackageSessionIdIn(chapterIds, Arrays.stream(getPackageSessionIds(packageSessionIds)).toList());
        List<ChapterPackageSessionMapping> deletedChapterPackageSessionMappings = new ArrayList<>();
        for (ChapterPackageSessionMapping chapterPackageSessionMapping : chapterPackageSessionMappings) {
            chapterPackageSessionMapping.setStatus(ChapterStatus.DELETED.name());
            deletedChapterPackageSessionMappings.add(chapterPackageSessionMapping);
        }
        chapterPackageSessionMappingRepository.saveAll(deletedChapterPackageSessionMappings);
        String[] packageSessionIdsArray = getPackageSessionIds(packageSessionIds);
        for (String packageSessionId:packageSessionIdsArray){
           for (String chapterId:chapterIds){
               learnerTrackingAsyncService.updateLearnerOperationsForBatch("CHAPTER",null,null,chapterId,moduleId,subjectId,packageSessionId);
           }
        }
        return "Chapter deleted successfully";
    }

    public String copyChapter(String packageSessionId, String moduleId, String chapterId, CustomUserDetails user) {
        PackageSession packageSession = packageSessionRepository.findById(packageSessionId).orElseThrow(() -> new VacademyException("Package Session not found"));
        Chapter chapter = chapterRepository.findById(chapterId).orElseThrow(() -> new VacademyException("Chapter not found"));
        Module module = moduleRepository.findById(moduleId).orElseThrow(() -> new VacademyException("Module not found"));
        ModuleChapterMapping moduleChapterMapping = new ModuleChapterMapping(chapter, module);
        moduleChapterMappingRepository.save(moduleChapterMapping);
        ChapterPackageSessionMapping chapterPackageSessionMapping = new ChapterPackageSessionMapping(chapter, packageSession, null);
        chapterPackageSessionMappingRepository.save(chapterPackageSessionMapping);
        return "Chapter copied successfully";
    }


    public String moveChapter(String existingPackageSessionId,
                              String oldModuleId,
                              String oldSubjectId,
                              String newPackageSessionId,
                              String moduleId,
                              String subjectId,
                              String chapterId,
                              CustomUserDetails user) {
        deleteChapter(List.of(chapterId),oldModuleId,oldSubjectId, existingPackageSessionId, user);
        copyChapter(newPackageSessionId, moduleId, chapterId, user);
        learnerTrackingAsyncService.updateLearnerOperationsForBatch("CHAPTER",null,null,chapterId,moduleId,subjectId,newPackageSessionId);
        return "Chapter moved successfully.";
    }

    @Transactional
    public String addRequestChapter(ChapterDTO chapterDTO, String moduleId, String commaSeparatedPackageSessionIds, CustomUserDetails user) {
        validateRequest(chapterDTO, moduleId, commaSeparatedPackageSessionIds);
        chapterDTO.setStatus(ChapterStatus.PENDING_APPROVAL.name());
        Chapter chapter = saveChapter(chapterDTO);
        Optional<SubjectModuleMapping> subjectModuleMapping = subjectModuleMappingRepository.findByModuleId(moduleId);
        List<Module> modules = null;
        chapterDTO.setId(chapter.getId());
        chapterDTO.setStatus(ChapterStatus.ACTIVE.name());
        modules = new ArrayList<>();
        modules.add(subjectModuleMapping.get().getModule());
        String[] packageSessionIds = getPackageSessionIds(commaSeparatedPackageSessionIds);
        for (String packageSessionId : packageSessionIds) {
            PackageSession packageSession = fetchPackageSessionById(packageSessionId);
            ChapterPackageSessionMapping chapterPackageSessionMapping = new ChapterPackageSessionMapping(chapter, packageSession, chapterDTO.getChapterOrder());
            chapterPackageSessionMapping.setStatus(ChapterStatus.PENDING_APPROVAL.name());
            chapterPackageSessionMappingRepository.save(chapterPackageSessionMapping);
        }
        processChapterModuleMapping(chapter, modules);
        return chapter.getId();
    }
}
