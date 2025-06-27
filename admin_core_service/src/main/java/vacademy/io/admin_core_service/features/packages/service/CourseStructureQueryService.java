package vacademy.io.admin_core_service.features.packages.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDTO;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDTOWithDetail;
import vacademy.io.admin_core_service.features.chapter.entity.Chapter;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.course.dto.CourseDTO;
import vacademy.io.admin_core_service.features.course.dto.CourseDTOWithDetails;
import vacademy.io.admin_core_service.features.level.repository.LevelRepository;
import vacademy.io.admin_core_service.features.module.dto.ModuleDTO;
import vacademy.io.admin_core_service.features.packages.entity.CourseStructureChangesLog;
import vacademy.io.admin_core_service.features.packages.enums.*;
import vacademy.io.admin_core_service.features.packages.repository.CourseStructureChangesLogRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.admin_core_service.features.session.repository.SessionRepository;
import vacademy.io.admin_core_service.features.study_library.dto.LevelDTOWithDetails;
import vacademy.io.admin_core_service.features.study_library.dto.ModuleDTOWithDetails;
import vacademy.io.admin_core_service.features.study_library.dto.SessionDTOWithDetails;
import vacademy.io.admin_core_service.features.subject.repository.SubjectRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.SessionDTO;
import vacademy.io.common.institute.dto.SubjectDTO;
import vacademy.io.common.institute.entity.Level;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.module.Module;
import vacademy.io.common.institute.entity.session.PackageSession;
import vacademy.io.common.institute.entity.session.Session;
import vacademy.io.common.institute.entity.student.Subject;
import java.util.*;

@Service
@RequiredArgsConstructor
public class CourseStructureQueryService {

    private final PackageRepository packageRepository;
    private final LevelRepository levelRepository;
    private final SessionRepository sessionRepository;
    private final SubjectRepository subjectRepository;
    private final PackageSessionRepository packageSessionRepository;
    private final CourseStructureChangesLogRepository logRepository;
    private final ObjectMapper objectMapper;
    private static final List<String>statuses = List.of(StatusEnum.ACTIVE.name());

    @Transactional
    public List<CourseDTOWithDetails> getUpdatedCourseStructure(String instituteId) {
        List<CourseDTOWithDetails> response = new ArrayList<>();

        // Step 1: Fetch Packages (sourceType: PACKAGE, parentId = instituteId)
        List<PackageEntity> packages = fetchEntities(PackageEntity.class, CourseStructuteChangesSourceType.PACKAGE.name(), instituteId,List.of(StatusEnum.ACTIVE.name()));

        for (PackageEntity pkg : packages) {
            List<Session> sessions = fetchEntities(Session.class, CourseStructuteChangesSourceType.SESSION.name(), pkg.getId(), List.of(StatusEnum.ACTIVE.name()));
            List<SessionDTOWithDetails> sessionDTOs = new ArrayList<>();

            for (Session session : sessions) {
                List<Level> levels = fetchEntities(Level.class, CourseStructuteChangesSourceType.LEVEL.name(), session.getId(), List.of(StatusEnum.ACTIVE.name()));
                List<LevelDTOWithDetails> levelDTOs = new ArrayList<>();

                for (Level level : levels) {
                    Optional<PackageSession> psOpt = packageSessionRepository.findByPackageEntityIdAndSessionIdAndLevelId(pkg.getId(), session.getId(), level.getId());
                    if (psOpt.isEmpty()) continue;

                    String psId = psOpt.get().getId();
                    List<Subject> subjects = fetchEntities(Subject.class, CourseStructuteChangesSourceType.SUBJECT.name(), psId, List.of(StatusEnum.ACTIVE.name()));
                    List<SubjectDTO> subjectDTOs = subjects.stream().map(s -> new SubjectDTO(s)).toList();
                    levelDTOs.add(new LevelDTOWithDetails(level, subjectDTOs));
                }

                SessionDTOWithDetails sessionDTOWithDetails = new SessionDTOWithDetails();
                sessionDTOWithDetails.setSessionDTO(new SessionDTO(session.getId(), session.getSessionName(), session.getStatus(), session.getStartDate()));
                sessionDTOWithDetails.setLevelWithDetails(levelDTOs);
                sessionDTOs.add(sessionDTOWithDetails);
            }

            CourseDTOWithDetails courseDTOWithDetails = new CourseDTOWithDetails(new CourseDTO(pkg), sessionDTOs);
            response.add(courseDTOWithDetails);
        }

        return response;
    }

    @Transactional
    public List<ModuleDTOWithDetails> getModulesAndChaptersFromLogsOnly(String subjectId) {
        if (subjectId == null || statuses == null || statuses.isEmpty()) {
            throw new VacademyException("SubjectId and status list must be provided");
        }
        List<ModuleDTOWithDetails> moduleDTOList = new ArrayList<>();

        // Step 1: Get all MODULE logs with parentId = subjectId
        List<CourseStructureChangesLog> moduleLogs = logRepository.findBySourceTypeAndParentIdAndStatusIn(CourseStructuteChangesSourceType.MODULE.name()
            , subjectId, statuses
        );

        for (CourseStructureChangesLog moduleLog : moduleLogs) {
            try {
                // Parse module from log JSON
                vacademy.io.common.institute.entity.module.Module module = objectMapper.readValue(moduleLog.getJsonData(), Module.class);
                ModuleDTO moduleDTO = new ModuleDTO(module);

                // Step 2: Find CHAPTER logs whose parentId = module.id
                List<CourseStructureChangesLog> chapterLogs = logRepository.findBySourceTypeAndParentIdAndStatusIn(
                    CourseStructuteChangesSourceType.CHAPTER.name(), module.getId(), statuses
                );

                // Parse all chapters
                List<ChapterDTOWithDetail> chapterDTOs = chapterLogs.stream()
                    .map(chLog -> {
                        try {
                            Chapter chapter = objectMapper.readValue(chLog.getJsonData(), Chapter.class);
                            ChapterDTO chapterDTO = chapter.mapToDTO();
                            return new ChapterDTOWithDetail(chapterDTO, null, null);
                        } catch (Exception e) {
                            throw new RuntimeException("Failed to parse chapter JSON", e);
                        }
                    })
                    .toList();

                moduleDTOList.add(new ModuleDTOWithDetails(moduleDTO, chapterDTOs));

            } catch (Exception e) {
                e.printStackTrace();
                throw new VacademyException("Failed to parse module JSON");
            }
        }

        return moduleDTOList;
    }

    private <T> List<T> fetchEntities(Class<T> clazz, String sourceType, String parentId,List<String> statuses) {
        List<CourseStructureChangesLog> logs = logRepository.findBySourceTypeAndParentIdAndStatusIn(sourceType, parentId, statuses);
        return logs.stream().map(log -> parseJsonData(log.getJsonData(), clazz)).filter(Objects::nonNull).toList();
    }

    private <T> T parseJsonData(String json, Class<T> clazz) {
        try {
            return objectMapper.readValue(json, clazz);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

}
