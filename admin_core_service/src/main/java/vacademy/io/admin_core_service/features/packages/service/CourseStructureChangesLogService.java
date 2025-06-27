package vacademy.io.admin_core_service.features.packages.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.chapter.dto.ChapterDTO;
import vacademy.io.admin_core_service.features.chapter.service.ChapterService;
import vacademy.io.admin_core_service.features.common.enums.StatusEnum;
import vacademy.io.admin_core_service.features.module.dto.ModuleDTO;
import vacademy.io.admin_core_service.features.module.service.ModuleService;
import vacademy.io.admin_core_service.features.packages.dto.CourseStructureChangesLogDTO;
import vacademy.io.admin_core_service.features.packages.entity.CourseStructureChangesLog;
import vacademy.io.admin_core_service.features.packages.repository.CourseStructureChangesLogRepository;
import vacademy.io.admin_core_service.features.slide.dto.SlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.VideoSlideDTO;
import vacademy.io.admin_core_service.features.slide.service.AssignmentSlideService;
import vacademy.io.admin_core_service.features.slide.service.SlideService;
import vacademy.io.admin_core_service.features.slide.service.VideoSlideService;
import vacademy.io.admin_core_service.features.subject.service.SubjectService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.dto.SubjectDTO;

import java.util.List;
import java.util.Optional;

@Service
@Slf4j
public class CourseStructureChangesLogService {

    @Autowired
    private CourseStructureChangesLogRepository courseStructureChangesLogRepository;

    @Autowired
    private SubjectService subjectService;

    @Autowired
    private ModuleService moduleService;

    @Autowired
    private ChapterService chapterService;

    @Autowired
    private AssignmentSlideService assignmentSlideService;

    @Autowired
    private VideoSlideService videoSlideService;

    @Autowired
    private ObjectMapper objectMapper;

    /**
     * Add or update course structure change log based on user + source.
     */
    public String addCourseStructureChangesLog(CourseStructureChangesLogDTO dto, String packageSessionId, CustomUserDetails userDetails) {
        if (!StringUtils.hasText(dto.getSourceId())){
            dto.setSourceId(
                getSourceIdBasedOnSourceTypeAndJsonData(
                    dto.getSourceType(), dto.getJsonData(), userDetails, packageSessionId, dto.getParentId()
                )
            );
        }
        Optional<CourseStructureChangesLog> optionalLog =
            courseStructureChangesLogRepository.findByUserIdAndSourceIdAndSourceTypeAndStatusIn(
                dto.getUserId(), dto.getSourceId(), dto.getSourceType(), List.of(StatusEnum.ACTIVE.name())
            );

        CourseStructureChangesLog log = optionalLog.orElseGet(() -> new CourseStructureChangesLog(dto));
        updateCourseStructureChangesLog(log, dto, userDetails);
        return courseStructureChangesLogRepository.save(log).getId();
    }

    /**
     * Update course structure change log fields selectively.
     */
    private void updateCourseStructureChangesLog(CourseStructureChangesLog log, CourseStructureChangesLogDTO dto, CustomUserDetails userDetails) {
        if (dto.getStatus() != null) log.setStatus(dto.getStatus());
        if (dto.getJsonData() != null) log.setJsonData(dto.getJsonData());
        if (dto.getParentId() != null) log.setParentId(dto.getParentId());
        if (dto.getSourceId() != null) log.setSourceId(dto.getSourceId());
        if (dto.getSourceType() != null) log.setSourceType(dto.getSourceType());
    }

    /**
     * Convert jsonData to corresponding DTO and add the structure entry.
     */
    @Transactional
    public String getSourceIdBasedOnSourceTypeAndJsonData(
        String sourceType,
        String jsonData,
        CustomUserDetails userDetails,
        String packageSessionId,
        String parentId
    ) {
        switch (sourceType) {
            case "SUBJECT": {
                SubjectDTO dto = (SubjectDTO) fromJson(jsonData, SubjectDTO.class);
                return subjectService.addRequestSubject(dto, packageSessionId, userDetails);
            }
            case "MODULE": {
                ModuleDTO dto = (ModuleDTO) fromJson(jsonData, ModuleDTO.class);
                return moduleService.addRequestModule(parentId, packageSessionId, dto, userDetails); // parentId = subjectId
            }
            case "CHAPTER": {
                ChapterDTO dto = (ChapterDTO) fromJson(jsonData, ChapterDTO.class);
                return chapterService.addRequestChapter(dto, parentId, packageSessionId, userDetails); // parentId = moduleId
            }
            case "VIDEO_SLIDE": {
                SlideDTO dto = (SlideDTO) fromJson(jsonData, VideoSlideDTO.class);
                return videoSlideService.addOrUpdateVideoSlideRequeest(dto, parentId, userDetails); // parentId = chapterId
            }
            case "ASSIGNMENT_SLIDE": {
                SlideDTO dto = (SlideDTO) fromJson(jsonData, SlideDTO.class);
                return assignmentSlideService.addOrUpdateAssignmentSlideRequest(dto, parentId, userDetails);
            }
            default:
                throw new IllegalArgumentException("Unsupported sourceType: " + sourceType);
        }
    }

    /**
     * Generic JSON → DTO mapper.
     */
    public Object fromJson(String json, Class<?> clazz) {
        try {
            return objectMapper.readValue(json, clazz);
        } catch (Exception e) {
            log.error("Failed to deserialize json: {}", e);
            throw new VacademyException("Error occurred!!!");
        }
    }
}
