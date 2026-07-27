package vacademy.io.admin_core_service.features.course_pulse.dto;

/**
 * One engaged slide with its full hierarchy labels, from the Content Map query.
 * Only slides with at least one live learner are returned; the service nests these
 * into a subject → module → chapter → slide tree and rolls head counts up.
 */
public interface ContentMapSlideProjection {
    String getSubjectId();
    String getSubjectName();
    String getModuleId();
    String getModuleName();
    String getChapterId();
    String getChapterName();
    String getSlideId();
    String getSlideTitle();
    String getSlideType();

    /** distinct live learners on this slide right now. */
    Long getHeadsNow();

    /** average seconds the current occupants have been on this slide. */
    Long getAvgOnSlideSeconds();
}
