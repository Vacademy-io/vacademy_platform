package vacademy.io.admin_core_service.features.study_library.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.annotation.Cacheable;
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
import vacademy.io.admin_core_service.features.packages.repository.PackageInstituteRepository;
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
import vacademy.io.common.institute.entity.PackageInstitute;
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

    @Autowired
    private PackageInstituteRepository packageInstituteRepository;


    @Transactional
    public List<CourseDTOWithDetails> getStudyLibraryInitDetails(String instituteId) {
        validateInstituteId(instituteId);
        
        // Step 1: Fetch all packages for the institute
        List<PackageEntity> packages = packageRepository.findDistinctPackagesByInstituteIdAndStatuses(
                instituteId, 
                List.of(PackageStatusEnum.ACTIVE.name(), PackageStatusEnum.DRAFT.name(), PackageStatusEnum.IN_REVIEW.name()), 
                List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name())
        );

        return buildCourseDTOWithDetailsForPackages(packages, instituteId);
    }

    /**
     * Common method to build CourseDTOWithDetails for a list of packages
     * This method is used by both getStudyLibraryInitDetails and getCourseInitDetails
     */
    private List<CourseDTOWithDetails> buildCourseDTOWithDetailsForPackages(List<PackageEntity> packages, String instituteId) {
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

        // Step 3: Bulk fetch all levels for the sessions and collect valid combinations
        Map<String, List<Level>> packageSessionToLevelsMap = new HashMap<>();
        List<LevelSessionPackageKey> validCombinations = new ArrayList<>();
        
        packageToSessionsMap.forEach((packageId, sessions) -> {
            sessions.forEach(session -> {
                List<Level> levels = levelRepository.findDistinctLevelsByInstituteIdAndSessionId(
                        instituteId, session.getId(), packageId
                );
                // Use composite key: packageId + sessionId
                String packageSessionKey = packageId + "_" + session.getId();
                packageSessionToLevelsMap.put(packageSessionKey, levels);
                
                // Collect valid combinations for later use
                levels.forEach(level -> {
                    validCombinations.add(new LevelSessionPackageKey(
                            level.getId(), session.getId(), packageId
                    ));
                });
            });
        });

        if (validCombinations.isEmpty()) {
            return packages.stream()
                    .map(pkg -> new CourseDTOWithDetails(new CourseDTO(pkg), new ArrayList<>()))
                    .collect(Collectors.toList());
        }

        // Step 4: Bulk fetch subjects for ONLY valid combinations
        Map<String, List<Subject>> levelSessionPackageToSubjectsMap = new HashMap<>();
        for (LevelSessionPackageKey key : validCombinations) {
            List<Subject> subjects = subjectRepository.findDistinctSubjectsPackageSession(
                    key.levelId, key.packageId, key.sessionId
            );
            if (!subjects.isEmpty()) {
                levelSessionPackageToSubjectsMap.put(key.getKey(), subjects);
            }
        }

        // Step 5: Bulk fetch faculty user IDs for ONLY valid combinations
        List<String> packageSessionStatuses = List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name());
        List<String> facultyStatuses = List.of(FacultyStatusEnum.ACTIVE.name());
        List<String> subjectStatuses = List.of(SubjectStatusEnum.ACTIVE.name());
        
        Map<String, List<String>> levelSessionPackageToFacultyIdsMap = new HashMap<>();
        for (LevelSessionPackageKey key : validCombinations) {
            List<String> userIds = facultySubjectPackageSessionMappingRepository.findDistinctUserIdsByLevelSessionPackageAndStatuses(
                    key.levelId, key.sessionId, key.packageId, 
                    packageSessionStatuses, facultyStatuses, subjectStatuses
            );
            if (!userIds.isEmpty()) {
                levelSessionPackageToFacultyIdsMap.put(key.getKey(), userIds);
            }
        }

        // Collect all unique user IDs for batch auth service call
        Set<String> allUserIds = new HashSet<>();
        levelSessionPackageToFacultyIdsMap.values().forEach(allUserIds::addAll);

        // Step 6: Single batch auth service call for all instructors
        Map<String, UserDTO> userIdToUserDTOMap = new HashMap<>();
        if (!allUserIds.isEmpty()) {
            List<UserDTO> allInstructors = authService.getUsersFromAuthServiceByUserIds(new ArrayList<>(allUserIds));
            allInstructors.forEach(user -> userIdToUserDTOMap.put(user.getId(), user));
        }

        // Step 7: Bulk fetch read times for ONLY valid combinations
        List<String> slideStatuses = List.of(SlideStatus.PUBLISHED.name(), SlideStatus.UNSYNC.name());
        List<String> activeStatuses = List.of(StatusEnum.ACTIVE.name());
        
        Map<String, Double> levelReadTimesMap = new HashMap<>();
        for (LevelSessionPackageKey key : validCombinations) {
            try {
                Double readTime = slideRepository.calculateTotalReadTimeInMinutes(
                        key.packageId, key.sessionId, key.levelId, 
                        slideStatuses, activeStatuses, activeStatuses
                );
                levelReadTimesMap.put(key.getKey(), readTime);
            } catch (Exception e) {
                // If read time calculation fails, continue with null value
            }
        }

        // Step 8: Assemble the response in memory
        return packages.stream().map(packageEntity -> {
            List<SessionProjection> sessions = packageToSessionsMap.getOrDefault(packageEntity.getId(), new ArrayList<>());
            
            List<SessionDTOWithDetails> sessionDTOList = sessions.stream().map(sessionProjection -> {
                String packageSessionKey = packageEntity.getId() + "_" + sessionProjection.getId();
                List<Level> levels = packageSessionToLevelsMap.getOrDefault(packageSessionKey, new ArrayList<>());
                
                List<LevelDTOWithDetails> levelDTOList = levels.stream().map(level -> {
                    String lookupKey = new LevelSessionPackageKey(
                            level.getId(), sessionProjection.getId(), packageEntity.getId()
                    ).getKey();
                    
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
                    
                    // Set read time (using same lookupKey)
                    Double readTime = levelReadTimesMap.getOrDefault(lookupKey, null);
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
     * Helper class to represent a unique combination of level, session, and package
     */
    private static class LevelSessionPackageKey {
        final String levelId;
        final String sessionId;
        final String packageId;

        LevelSessionPackageKey(String levelId, String sessionId, String packageId) {
            this.levelId = levelId;
            this.sessionId = sessionId;
            this.packageId = packageId;
        }

        String getKey() {
            return levelId + "_" + sessionId + "_" + packageId;
        }
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

    @Transactional
    public List<CourseDTOWithDetails> getCourseInitDetails(String courseId, String instituteId) {
        if (Objects.isNull(courseId)) {
            throw new VacademyException("Please provide courseId");
        }
        
        validateInstituteId(instituteId);
        
        // Fetch the specific package/course
        Optional<PackageEntity> packageOptional = packageRepository.findById(courseId);
        if (packageOptional.isEmpty()) {
            throw new VacademyException("Course not found with id: " + courseId);
        }
        
        PackageEntity packageEntity = packageOptional.get();
        
        // Check if package status is valid
        List<String> validPackageStatuses = List.of(PackageStatusEnum.ACTIVE.name(), PackageStatusEnum.DRAFT.name(), PackageStatusEnum.IN_REVIEW.name());
        if (!validPackageStatuses.contains(packageEntity.getStatus())) {
            return new ArrayList<>();
        }

        // Verify that the course belongs to the institute
        Optional<PackageInstitute> packageInstitute = packageInstituteRepository.findByPackageIdAndInstituteId(courseId, instituteId);
        if (packageInstitute.isEmpty()) {
            throw new VacademyException("Course with id: " + courseId + " does not belong to institute with id: " + instituteId);
        }

        // Reuse the common method with a single package
        return buildCourseDTOWithDetailsForPackages(List.of(packageEntity), instituteId);
    }

}