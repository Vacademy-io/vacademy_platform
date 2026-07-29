package vacademy.io.admin_core_service.features.institute_pulse.dto;

/**
 * One slide with at least one live learner, carrying its full
 * course → subject → module → chapter path.
 *
 * <p>Each learner is resolved to exactly ONE path before grouping, so head counts roll up
 * exactly at every level — see {@code InstitutePulseRepository.getContentMap}.
 */
public interface InstituteContentMapProjection {

    String getCourseId();

    String getCourseName();

    String getSubjectId();

    String getSubjectName();

    String getModuleId();

    String getModuleName();

    String getChapterId();

    String getChapterName();

    String getSlideId();

    String getSlideTitle();

    String getSlideType();

    Long getHeadsNow();

    Long getAvgOnSlideSeconds();
}
