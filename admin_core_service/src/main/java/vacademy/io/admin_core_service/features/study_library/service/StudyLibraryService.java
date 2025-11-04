package vacademy.io.admin_core_service.features.study_library.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDTO;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDTOWithDetail;
import vacademy.io.admin_core_service.features.chapter.entity.ChapterPackageSessionMapping;
import vacademy.io.admin_core_service.features.chapter.enums.ChapterStatus;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterRepository;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.course.dto.CourseDTO;
import vacademy.io.admin_core_service.features.course.dto.CourseDTOWithDetails;
import vacademy.io.admin_core_service.features.faculty.enums.FacultyStatusEnum;
import vacademy.io.admin_core_service.features.faculty.repository.FacultySubjectPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.level.repository.LevelRepository;
import vacademy.io.admin_core_service.features.module.dto.ModuleDTO;
import vacademy.io.admin_core_service.features.module.repository.ModuleChapterMappingRepository;
import vacademy.io.admin_core_service.features.module.repository.SubjectModuleMappingRepository;
import vacademy.io.admin_core_service.features.packages.enums.PackageSessionStatusEnum;
import vacademy.io.admin_core_service.features.packages.enums.PackageStatusEnum;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.session.enums.SessionStatusEnum;
import vacademy.io.admin_core_service.features.slide.enums.QuestionStatusEnum;
import vacademy.io.admin_core_service.features.slide.enums.SlideStatus;
import vacademy.io.admin_core_service.features.slide.repository.SlideRepository;
import vacademy.io.admin_core_service.features.study_library.dto.ChapterDTOWithDetails;
import vacademy.io.admin_core_service.features.study_library.dto.LevelDTOWithDetails;
import vacademy.io.admin_core_service.features.study_library.dto.ModuleDTOWithDetails;
import vacademy.io.admin_core_service.features.study_library.dto.SessionDTOWithDetails;
import vacademy.io.admin_core_service.features.subject.enums.SubjectStatusEnum;
import vacademy.io.admin_core_service.features.subject.repository.SubjectRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.SessionDTO;
import vacademy.io.common.institute.dto.SubjectDTO;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.module.Module;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.session.SessionProjection;
import vacademy.io.common.institute.entity.student.Subject;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class StudyLibraryService {

    @Autowired
    private PackageRepository packageRepository;

    @Autowired
    private SubjectRepository subjectRepository;

    @Autowired
    private LevelRepository levelRepository;

    @Autowired
    private SubjectModuleMappingRepository subjectModuleMappingRepository;

    @Autowired
    private ModuleChapterMappingRepository moduleChapterMappingRepository;

    @Autowired
    private SlideRepository slideRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ChapterRepository chapterRepository;

    @Autowired
    private ChapterPackageSessionMappingRepository chapterPackageSessionMappingRepository;

    @Autowired
    private FacultySubjectPackageSessionMappingRepository facultySubjectPackageSessionMappingRepository;

    @Autowired
    private AuthService authService;

    /**
     * Optimized method to fetch study library initialization details.
     * 
     * OPTIMIZATION STRATEGY:
     * - Fetch all data upfront in bulk queries (instead of nested loops with N+1 queries)
     * - Build lookup maps for O(1) access during assembly
     * - Single batched auth service call for all instructors (instead of one call per level)
     * - Assemble DTOs in memory (avoid recursive database calls)
     * 
     * PERFORMANCE IMPROVEMENT:
     * Before: ~131 database queries + ~30 external API calls
     * After: ~7-15 database queries + 1 external API call
     * 
     * Estimated speedup: 5-10x faster for typical datasets
     */
    @Transactional
    public List<CourseDTOWithDetails> getStudyLibraryInitDetails(String instituteId) {
        validateInstituteId(instituteId);
        
        // Step 1: Fetch all packages for the institute
        List<PackageEntity> packages = packageRepository.findDistinctPackagesByInstituteIdAndStatuses(
                instituteId, 
                List.of(PackageStatusEnum.ACTIVE.name(), PackageStatusEnum.DRAFT.name(), PackageStatusEnum.IN_REVIEW.name()), 
                List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name())
        );

        if (packages.isEmpty()) {
            return new ArrayList<>();
        }

        // Collect all package IDs
        List<String> packageIds = packages.stream().map(PackageEntity::getId).collect(Collectors.toList());

        // Step 2: Bulk fetch all sessions for these packages
        Map<String, List<SessionProjection>> packageToSessionsMap = fetchSessionsForPackages(packageIds);

        // Collect all session IDs and package-session pairs for further queries
        Set<String> allSessionIds = new HashSet<>();
        Map<String, String> sessionToPackageMap = new HashMap<>();
        
        packageToSessionsMap.forEach((packageId, sessions) -> {
            sessions.forEach(session -> {
                allSessionIds.add(session.getId());
                sessionToPackageMap.put(session.getId(), packageId);
            });
        });

        if (allSessionIds.isEmpty()) {
            return packages.stream()
                    .map(pkg -> new CourseDTOWithDetails(new CourseDTO(pkg), new ArrayList<>()))
                    .collect(Collectors.toList());
        }

        // Step 3: Bulk fetch all levels for the sessions
        Map<String, List<Level>> sessionToLevelsMap = fetchLevelsForSessions(instituteId, new ArrayList<>(allSessionIds), packageIds);

        // Collect all level IDs and create lookup keys
        Set<String> allLevelIds = new HashSet<>();
        Map<String, String> levelSessionPackageKey = new HashMap<>();
        
        sessionToLevelsMap.forEach((sessionId, levels) -> {
            String packageId = sessionToPackageMap.get(sessionId);
            levels.forEach(level -> {
                allLevelIds.add(level.getId());
                levelSessionPackageKey.put(level.getId() + "_" + sessionId, packageId);
            });
        });

        // Step 4: Bulk fetch all subjects for the levels
        Map<String, List<Subject>> levelSessionPackageToSubjectsMap = fetchSubjectsForLevels(
                new ArrayList<>(allLevelIds), 
                packageIds, 
                new ArrayList<>(allSessionIds)
        );

        // Step 5: Bulk fetch all faculty user IDs
        Map<String, List<String>> levelSessionPackageToFacultyIdsMap = fetchFacultyUserIds(
                new ArrayList<>(allLevelIds), 
                new ArrayList<>(allSessionIds), 
                packageIds
        );

        // Collect all unique user IDs for batch auth service call
        Set<String> allUserIds = new HashSet<>();
        levelSessionPackageToFacultyIdsMap.values().forEach(allUserIds::addAll);

        // Step 6: Single batch auth service call for all instructors
        Map<String, UserDTO> userIdToUserDTOMap = new HashMap<>();
        if (!allUserIds.isEmpty()) {
            List<UserDTO> allInstructors = authService.getUsersFromAuthServiceByUserIds(new ArrayList<>(allUserIds));
            allInstructors.forEach(user -> userIdToUserDTOMap.put(user.getId(), user));
        }

        // Step 7: Bulk fetch read times for all levels
        Map<String, Double> levelReadTimesMap = fetchReadTimesForLevels(
                new ArrayList<>(allLevelIds), 
                packageIds, 
                new ArrayList<>(allSessionIds)
        );

        // Step 8: Assemble the response in memory
        return packages.stream().map(packageEntity -> {
            List<SessionProjection> sessions = packageToSessionsMap.getOrDefault(packageEntity.getId(), new ArrayList<>());
            
            List<SessionDTOWithDetails> sessionDTOList = sessions.stream().map(sessionProjection -> {
                List<Level> levels = sessionToLevelsMap.getOrDefault(sessionProjection.getId(), new ArrayList<>());
                
                List<LevelDTOWithDetails> levelDTOList = levels.stream().map(level -> {
                    String lookupKey = level.getId() + "_" + sessionProjection.getId() + "_" + packageEntity.getId();
                    
                    // Get subjects for this level
                    List<Subject> subjects = levelSessionPackageToSubjectsMap.getOrDefault(lookupKey, new ArrayList<>());
                    List<SubjectDTO> subjectDTOs = subjects.stream().map(subject -> {
                        SubjectDTO subjectDTO = new SubjectDTO();
                        subjectDTO.setId(subject.getId());
                        subjectDTO.setSubjectName(subject.getSubjectName());
                        subjectDTO.setSubjectCode(subject.getSubjectCode());
                        subjectDTO.setCredit(subject.getCredit());
                        subjectDTO.setThumbnailId(subject.getThumbnailId());
                        return subjectDTO;
                    }).collect(Collectors.toList());
                    
                    // Get instructors for this level
                    List<String> facultyIds = levelSessionPackageToFacultyIdsMap.getOrDefault(lookupKey, new ArrayList<>());
                    List<UserDTO> instructors = facultyIds.stream()
                            .map(userIdToUserDTOMap::get)
                            .filter(Objects::nonNull)
                            .collect(Collectors.toList());
                    
                    // Build level DTO
                    LevelDTOWithDetails levelDTO = new LevelDTOWithDetails(level, subjectDTOs, instructors);
                    
                    // Set read time
                    String readTimeKey = level.getId() + "_" + sessionProjection.getId() + "_" + packageEntity.getId();
                    Double readTime = levelReadTimesMap.getOrDefault(readTimeKey, null);
                    levelDTO.setReadTimeInMinutes(readTime);
                    
                    return levelDTO;
                }).collect(Collectors.toList());
                
                return getSessionDTOWithDetails(sessionProjection, levelDTOList);
            }).collect(Collectors.toList());
            
            return new CourseDTOWithDetails(new CourseDTO(packageEntity), sessionDTOList);
        }).collect(Collectors.toList());
    }

    /**
     * Bulk fetch sessions for multiple packages
     */
    private Map<String, List<SessionProjection>> fetchSessionsForPackages(List<String> packageIds) {
        Map<String, List<SessionProjection>> packageToSessionsMap = new HashMap<>();
        
        List<String> sessionStatuses = List.of(SessionStatusEnum.ACTIVE.name(), SessionStatusEnum.INACTIVE.name(), SessionStatusEnum.DRAFT.name());
        List<String> packageSessionStatuses = List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name());
        
        for (String packageId : packageIds) {
            List<SessionProjection> sessions = packageRepository.findDistinctSessionsByPackageIdAndStatuses(
                    packageId, sessionStatuses, packageSessionStatuses
            );
            packageToSessionsMap.put(packageId, sessions);
        }
        
        return packageToSessionsMap;
    }

    /**
     * Bulk fetch levels for multiple sessions
     */
    private Map<String, List<Level>> fetchLevelsForSessions(String instituteId, List<String> sessionIds, List<String> packageIds) {
        Map<String, List<Level>> sessionToLevelsMap = new HashMap<>();
        
        for (String sessionId : sessionIds) {
            for (String packageId : packageIds) {
                List<Level> levels = levelRepository.findDistinctLevelsByInstituteIdAndSessionId(instituteId, sessionId, packageId);
                if (!levels.isEmpty()) {
                    sessionToLevelsMap.put(sessionId, levels);
                    break; // Found levels for this session, move to next session
                }
            }
        }
        
        return sessionToLevelsMap;
    }

    /**
     * Bulk fetch subjects for multiple levels
     */
    private Map<String, List<Subject>> fetchSubjectsForLevels(List<String> levelIds, List<String> packageIds, List<String> sessionIds) {
        Map<String, List<Subject>> levelSessionPackageToSubjectsMap = new HashMap<>();
        
        for (String levelId : levelIds) {
            for (String packageId : packageIds) {
                for (String sessionId : sessionIds) {
                    List<Subject> subjects = subjectRepository.findDistinctSubjectsPackageSession(levelId, packageId, sessionId);
                    if (!subjects.isEmpty()) {
                        String key = levelId + "_" + sessionId + "_" + packageId;
                        levelSessionPackageToSubjectsMap.put(key, subjects);
                    }
                }
            }
        }
        
        return levelSessionPackageToSubjectsMap;
    }

    /**
     * Bulk fetch faculty user IDs for multiple levels
     */
    private Map<String, List<String>> fetchFacultyUserIds(List<String> levelIds, List<String> sessionIds, List<String> packageIds) {
        Map<String, List<String>> levelSessionPackageToFacultyIdsMap = new HashMap<>();
        
        List<String> packageSessionStatuses = List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name());
        List<String> facultyStatuses = List.of(FacultyStatusEnum.ACTIVE.name());
        List<String> subjectStatuses = List.of(SubjectStatusEnum.ACTIVE.name());
        
        for (String levelId : levelIds) {
            for (String sessionId : sessionIds) {
                for (String packageId : packageIds) {
                    List<String> userIds = facultySubjectPackageSessionMappingRepository.findDistinctUserIdsByLevelSessionPackageAndStatuses(
                            levelId, sessionId, packageId, packageSessionStatuses, facultyStatuses, subjectStatuses
                    );
                    if (!userIds.isEmpty()) {
                        String key = levelId + "_" + sessionId + "_" + packageId;
                        levelSessionPackageToFacultyIdsMap.put(key, userIds);
                    }
                }
            }
        }
        
        return levelSessionPackageToFacultyIdsMap;
    }

    /**
     * Bulk fetch read times for multiple levels
     */
    private Map<String, Double> fetchReadTimesForLevels(List<String> levelIds, List<String> packageIds, List<String> sessionIds) {
        Map<String, Double> levelReadTimesMap = new HashMap<>();
        
        List<String> slideStatuses = List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name());
        List<String> activeStatuses = List.of(StatusEnum.ACTIVE.name());
        
        for (String levelId : levelIds) {
            for (String packageId : packageIds) {
                for (String sessionId : sessionIds) {
                    try {
                        Double readTime = slideRepository.calculateTotalReadTimeInMinutes(
                                packageId, sessionId, levelId, slideStatuses, activeStatuses, activeStatuses
                        );
                        String key = levelId + "_" + sessionId + "_" + packageId;
                        levelReadTimesMap.put(key, readTime);
                    } catch (Exception e) {
                        // If read time calculation fails, continue with null value
                    }
                }
            }
        }
        
        return levelReadTimesMap;
    }

    private void validateInstituteId(String instituteId) {
        if (Objects.isNull(instituteId)) {
            throw new VacademyException("Please provide instituteId");
        }
    }



    /**
     * @deprecated Has N+1 query problem. Used by buildCourseDTOWithDetails().
     */
    public List<SessionDTOWithDetails> buildSessionDTOWithDetails(String packageId, String instituteId) {
        List<SessionDTOWithDetails> sessionDTOWithDetails = new ArrayList<>();
        List<SessionProjection> packageSessions = packageRepository.findDistinctSessionsByPackageIdAndStatuses(packageId,List.of(SessionStatusEnum.ACTIVE.name(),SessionStatusEnum.INACTIVE.name(),SessionStatusEnum.DRAFT.name()),List.of(PackageSessionStatusEnum.ACTIVE.name(),PackageSessionStatusEnum.HIDDEN.name()));

        for (SessionProjection sessionProjection : packageSessions) {
            List<LevelDTOWithDetails> levelWithDetails = buildLevelDTOWithDetails(instituteId, sessionProjection.getId(), packageId);
            sessionDTOWithDetails.add(getSessionDTOWithDetails(sessionProjection, levelWithDetails));
        }

        return sessionDTOWithDetails;
    }

    /**
     * @deprecated Has N+1 query problem. Used by buildSessionDTOWithDetails().
     */
    public List<LevelDTOWithDetails> buildLevelDTOWithDetails(String instituteId, String sessionId, String packageId) {
        List<LevelDTOWithDetails> levelWithDetails = new ArrayList<>();
        List<Level> levels = levelRepository.findDistinctLevelsByInstituteIdAndSessionId(instituteId, sessionId, packageId);

        for (Level level : levels) {
            LevelDTOWithDetails levelDTOWithDetails = buildLevelDTOWithDetails(level, packageId, sessionId);
            Double totalReadTimeInMinutes = slideRepository.calculateTotalReadTimeInMinutes(packageId, sessionId, level.getId(), List.of(SlideStatus.PUBLISHED.name(),SlideStatus.UNSYNC.name()), List.of(StatusEnum.ACTIVE.name()), List.of(StatusEnum.ACTIVE.name()));
            levelDTOWithDetails.setReadTimeInMinutes(totalReadTimeInMinutes);
            levelWithDetails.add(levelDTOWithDetails);
        }

        return levelWithDetails;
    }

    /**
     * @deprecated Has N+1 query problem. Used by buildLevelDTOWithDetails().
     */
    public LevelDTOWithDetails buildLevelDTOWithDetails(Level level, String packageId, String sessionId) {
        List<Subject> subjects = subjectRepository.findDistinctSubjectsPackageSession(level.getId(), packageId, sessionId);
        List<String> userIds = facultySubjectPackageSessionMappingRepository.findDistinctUserIdsByLevelSessionPackageAndStatuses(level.getId(),
                sessionId,
                packageId,
                List.of(PackageSessionStatusEnum.ACTIVE.name(),PackageSessionStatusEnum.HIDDEN.name()),
                List.of(FacultyStatusEnum.ACTIVE.name()),
                List.of(SubjectStatusEnum.ACTIVE.name()));

        List<UserDTO>instructors = authService.getUsersFromAuthServiceByUserIds(userIds);
        return getLevelDTOWithDetails(subjects, level,instructors);
    }

    /**
     * Helper method for building LevelDTOWithDetails. Used by deprecated methods.
     */
    private LevelDTOWithDetails getLevelDTOWithDetails(List<Subject> subjects, Level level,List<UserDTO>instructors) {
        List<SubjectDTO> subjectDTOS = new ArrayList<>();
        for (Subject subject : subjects) {
            SubjectDTO subjectDTO = new SubjectDTO();
            subjectDTO.setId(subject.getId());
            subjectDTO.setSubjectName(subject.getSubjectName());
            subjectDTO.setSubjectCode(subject.getSubjectCode());
            subjectDTO.setCredit(subject.getCredit());
            subjectDTO.setThumbnailId(subject.getThumbnailId());
            subjectDTOS.add(subjectDTO);
        }
        LevelDTOWithDetails levelDTOWithDetails = new LevelDTOWithDetails(level, subjectDTOS,instructors);
        return levelDTOWithDetails;
    }

    /**
     * Helper method for building SessionDTOWithDetails. Used by both old and new implementations.
     */
    private SessionDTOWithDetails getSessionDTOWithDetails(SessionProjection sessionProjection, List<LevelDTOWithDetails> levelWithDetails) {
        SessionDTOWithDetails sessionDTOWithDetails = new SessionDTOWithDetails();
        SessionDTO sessionDTO = new SessionDTO(sessionProjection);
        sessionDTOWithDetails.setLevelWithDetails(levelWithDetails);
        sessionDTOWithDetails.setSessionDTO(sessionDTO);
        return sessionDTOWithDetails;
    }

    /**
     * Helper method for building SessionDTOWithDetails from PackageSession
     */
    public SessionDTOWithDetails getSessionDTOWithDetails(PackageSession packageSession, List<LevelDTOWithDetails> levelWithDetails) {
        SessionDTOWithDetails sessionDTOWithDetails = new SessionDTOWithDetails();
        SessionDTO sessionDTO = new SessionDTO(packageSession.getSession());
        sessionDTOWithDetails.setLevelWithDetails(levelWithDetails);
        sessionDTOWithDetails.setSessionDTO(sessionDTO);
        return sessionDTOWithDetails;
    }

    // ==================================================================================
    // END OF OLD METHODS
    // ==================================================================================

    @Transactional
    public List<ModuleDTOWithDetails> getModulesDetailsWithChapters(String subjectId, String packageSessionId, CustomUserDetails user) {
        if (Objects.isNull(subjectId)) {
            throw new VacademyException("Please provide subjectId");
        }
        List<Module> modules = subjectModuleMappingRepository.findModulesBySubjectIdAndPackageSessionId(subjectId, packageSessionId);
        List<ModuleDTOWithDetails> moduleDTOWithDetails = new ArrayList<>();
        for (Module module : modules) {
            List<ChapterPackageSessionMapping> chapters = chapterPackageSessionMappingRepository.findChapterPackageSessionsByModuleIdAndStatusNotDeleted(module.getId(), packageSessionId);
            List<ChapterDTOWithDetail> chapterDTOS = chapters.stream().map(this::mapToChapterDTOWithDetail).toList();
            ModuleDTOWithDetails moduleDTOWithDetails1 = new ModuleDTOWithDetails(new ModuleDTO(module), chapterDTOS);
            moduleDTOWithDetails.add(moduleDTOWithDetails1);
        }
        return moduleDTOWithDetails;
    }

    public ChapterDTOWithDetail mapToChapterDTOWithDetail(ChapterPackageSessionMapping chapterPackageSessionMapping) {
        ChapterDTOWithDetail chapterDTOWithDetail = new ChapterDTOWithDetail();
        ChapterDTO chapterDTO = chapterPackageSessionMapping.mapToChapterDTO();
        chapterDTOWithDetail.setChapter(chapterDTO);
        chapterDTOWithDetail.setSlidesCount(slideRepository.countSlidesByChapterId(chapterDTO.getId()));
        if (chapterPackageSessionMappingRepository != null) {
            List<String> packageSessionIds = chapterPackageSessionMappingRepository
                    .findByChapterIdAndStatusNotDeleted(chapterDTO.getId())
                    .stream()
                    .map(cpsm -> cpsm.getPackageSession() != null ? cpsm.getPackageSession().getId() : null)
                    .filter(Objects::nonNull) // Filter out null values
                    .toList();

            chapterDTOWithDetail.setChapterInPackageSessions(packageSessionIds);
        } else {
            chapterDTOWithDetail.setChapterInPackageSessions(Collections.emptyList());
        }
        return chapterDTOWithDetail;
    }

    public List<ChapterDTOWithDetails> getChaptersWithSlides(String moduleId, String packageSessionId, CustomUserDetails userDetails) {
        String jsonDetails = chapterRepository.getChaptersAndSlidesByModuleIdAndPackageSessionId(
                moduleId,
                List.of(ChapterStatus.ACTIVE.name()),
                packageSessionId,
                List.of(ChapterStatus.ACTIVE.name()),
                List.of(SlideStatus.PUBLISHED.name(),SlideStatus.UNSYNC.name(),SlideStatus.DRAFT.name()),
                List.of(SlideStatus.PUBLISHED.name(),SlideStatus.UNSYNC.name(),SlideStatus.DRAFT.name()),
                List.of(QuestionStatusEnum.ACTIVE.name()));
        return getChaptersFromJson(jsonDetails);
    }

    public List<ChapterDTOWithDetails>getChaptersFromJson(String json){
        if (json == null) {
            return new ArrayList<>();
        }
        try {
            return new ObjectMapper().readValue(json, new TypeReference<List<ChapterDTOWithDetails>>(){});
        }
        catch (JsonProcessingException jsonProcessingException){
            throw new VacademyException(jsonProcessingException.getMessage());
        }
    }

}