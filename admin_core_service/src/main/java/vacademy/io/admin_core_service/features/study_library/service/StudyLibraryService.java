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
import vacademy.io.admin_core_service.features.course.dto.CourseDTO;
import vacademy.io.admin_core_service.features.course.dto.CourseDTOWithDetails;
import vacademy.io.admin_core_service.features.faculty.entity.FacultySubjectPackageSessionMapping;
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

    @Transactional
    public List<CourseDTOWithDetails> getStudyLibraryInitDetails(String instituteId) {
        validateInstituteId(instituteId);

        List<CourseDTOWithDetails> courses = new ArrayList<>();
        List<PackageEntity> packages = packageRepository.findDistinctPackagesByInstituteIdAndStatuses(instituteId, List.of(PackageStatusEnum.ACTIVE.name(), PackageStatusEnum.DRAFT.name(), PackageStatusEnum.IN_REVIEW.name()), List.of(PackageSessionStatusEnum.ACTIVE.name(), PackageSessionStatusEnum.HIDDEN.name()));

        for (PackageEntity course : packages) {
            CourseDTOWithDetails courseDTOWithDetails = buildCourseDTOWithDetails(course, instituteId);
            courses.add(courseDTOWithDetails);
        }

        return courses;
    }

    private void validateInstituteId(String instituteId) {
        if (Objects.isNull(instituteId)) {
            throw new VacademyException("Please provide instituteId");
        }
    }

    public CourseDTOWithDetails buildCourseDTOWithDetails(PackageEntity course, String instituteId) {
        List<SessionDTOWithDetails> sessionDTOWithDetails = buildSessionDTOWithDetails(course.getId(), instituteId);
        return new CourseDTOWithDetails(new CourseDTO(course), sessionDTOWithDetails);
    }

    public List<SessionDTOWithDetails> buildSessionDTOWithDetails(String packageId, String instituteId) {
        List<SessionDTOWithDetails> sessionDTOWithDetails = new ArrayList<>();
        List<SessionProjection> packageSessions = packageRepository.findDistinctSessionsByPackageIdAndStatuses(packageId,List.of(SessionStatusEnum.ACTIVE.name(),SessionStatusEnum.INACTIVE.name(),SessionStatusEnum.DRAFT.name()),List.of(PackageSessionStatusEnum.ACTIVE.name(),PackageSessionStatusEnum.HIDDEN.name()));

        for (SessionProjection sessionProjection : packageSessions) {
            List<LevelDTOWithDetails> levelWithDetails = buildLevelDTOWithDetails(instituteId, sessionProjection.getId(), packageId);
            sessionDTOWithDetails.add(getSessionDTOWithDetails(sessionProjection, levelWithDetails));
        }

        return sessionDTOWithDetails;
    }


    public SessionDTOWithDetails buildSessionDTOForPackageSession(PackageSession packageSession, String instituteId) {

        List<LevelDTOWithDetails> levelWithDetails = buildLevelDTOWithDetails(instituteId, packageSession);

        return getSessionDTOWithDetails(packageSession, levelWithDetails);
    }

    public List<LevelDTOWithDetails> buildLevelDTOWithDetails(String instituteId, String sessionId, String packageId) {
        List<LevelDTOWithDetails> levelWithDetails = new ArrayList<>();
        List<Level> levels = levelRepository.findDistinctLevelsByInstituteIdAndSessionId(instituteId, sessionId, packageId);

        for (Level level : levels) {
            LevelDTOWithDetails levelDTOWithDetails = buildLevelDTOWithDetails(level, packageId, sessionId);
            levelWithDetails.add(levelDTOWithDetails);
        }

        return levelWithDetails;
    }


    public List<LevelDTOWithDetails> buildLevelDTOWithDetails(String instituteId, PackageSession packageSession) {
        List<LevelDTOWithDetails> levelWithDetails = new ArrayList<>();
        LevelDTOWithDetails levelDTOWithDetails = buildLevelDTOWithDetails(packageSession);
        levelWithDetails.add(levelDTOWithDetails);

        return levelWithDetails;
    }

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

    public LevelDTOWithDetails getLevelDTOWithDetails(List<Subject> subjects, Level level,List<UserDTO>instructors) {
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

    public SessionDTOWithDetails getSessionDTOWithDetails(SessionProjection sessionProjection, List<LevelDTOWithDetails> levelWithDetails) {
        SessionDTOWithDetails sessionDTOWithDetails = new SessionDTOWithDetails();
        SessionDTO sessionDTO = new SessionDTO(sessionProjection);
        sessionDTOWithDetails.setLevelWithDetails(levelWithDetails);
        sessionDTOWithDetails.setSessionDTO(sessionDTO);
        return sessionDTOWithDetails;
    }

    public SessionDTOWithDetails getSessionDTOWithDetails(PackageSession packageSession, List<LevelDTOWithDetails> levelWithDetails) {
        SessionDTOWithDetails sessionDTOWithDetails = new SessionDTOWithDetails();
        SessionDTO sessionDTO = new SessionDTO(packageSession.getSession());
        sessionDTOWithDetails.setLevelWithDetails(levelWithDetails);
        sessionDTOWithDetails.setSessionDTO(sessionDTO);
        return sessionDTOWithDetails;
    }

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

    public LevelDTOWithDetails buildLevelDTOWithDetails(PackageSession packageSession) {
        List<Subject> subjects = subjectRepository.findDistinctSubjectsByPackageSessionId(packageSession.getId());
        List<String>userIds = facultySubjectPackageSessionMappingRepository.findDistinctUserIdsByLevelSessionPackageAndStatuses(packageSession.getLevel().getId(), packageSession.getSession().getId(), packageSession.getPackageEntity().getId(), List.of(PackageSessionStatusEnum.ACTIVE.name(),PackageSessionStatusEnum.HIDDEN.name()), List.of(FacultyStatusEnum.ACTIVE.name()), List.of(SubjectStatusEnum.ACTIVE.name()));
        List<UserDTO>instructors = authService.getUsersFromAuthServiceByUserIds(userIds

        );
        return getLevelDTOWithDetails(subjects, packageSession.getLevel(),instructors);
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