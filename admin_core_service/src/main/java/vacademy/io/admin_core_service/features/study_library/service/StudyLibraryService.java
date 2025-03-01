package vacademy.io.admin_core_service.features.study_library.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDTO;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDTOWithDetail;
import vacademy.io.admin_core_service.features.chapter.entity.Chapter;
import vacademy.io.admin_core_service.features.chapter.entity.ChapterPackageSessionMapping;
import vacademy.io.admin_core_service.features.chapter.repository.ChapterPackageSessionMappingRepository;
import vacademy.io.admin_core_service.features.course.dto.CourseDTO;
import vacademy.io.admin_core_service.features.course.dto.CourseDTOWithDetails;
import vacademy.io.admin_core_service.features.level.repository.LevelRepository;
import vacademy.io.admin_core_service.features.module.dto.ModuleDTO;
import vacademy.io.admin_core_service.features.module.repository.ModuleChapterMappingRepository;
import vacademy.io.admin_core_service.features.module.repository.SubjectModuleMappingRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.slide.repository.SlideRepository;
import vacademy.io.admin_core_service.features.study_library.dto.LevelDTOWithDetails;
import vacademy.io.admin_core_service.features.study_library.dto.ModuleDTOWithDetails;
import vacademy.io.admin_core_service.features.study_library.dto.SessionDTOWithDetails;
import vacademy.io.admin_core_service.features.subject.repository.SubjectRepository;
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

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

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
    private ChapterPackageSessionMappingRepository chapterPackageSessionMappingRepository;

    public List<CourseDTOWithDetails> getStudyLibraryInitDetails(String instituteId) {
        validateInstituteId(instituteId);

        List<CourseDTOWithDetails> courses = new ArrayList<>();
        List<PackageEntity> packages = packageRepository.findDistinctPackagesByInstituteId(instituteId);

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
        List<SessionProjection> packageSessions = packageRepository.findDistinctSessionsByPackageId(packageId);

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
        return getLevelDTOWithDetails(subjects, level);
    }

    public LevelDTOWithDetails getLevelDTOWithDetails(List<Subject> subjects, Level level) {
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
        LevelDTOWithDetails levelDTOWithDetails = new LevelDTOWithDetails(level, subjectDTOS);
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

            chapterDTOWithDetail.setChapterVisiblity(packageSessionIds);
        } else {
            chapterDTOWithDetail.setChapterVisiblity(Collections.emptyList());
        }
        return chapterDTOWithDetail;
    }

    public LevelDTOWithDetails buildLevelDTOWithDetails(PackageSession packageSession) {
        List<Subject> subjects = subjectRepository.findDistinctSubjectsByPackageSessionId(packageSession.getId());
        return getLevelDTOWithDetails(subjects, packageSession.getLevel());
    }

}
