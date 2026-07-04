package vacademy.io.admin_core_service.features.learner_tracking.dto;

/**
 * Native-query projection for per-slide marks used by the v2 comprehensive
 * report's "Marks by Subject" section (SubjectMarksCollector).
 *
 * <p>Backed by QUESTION and QUIZ native queries in {@code QuestionSlideTrackedRepository}
 * and {@code QuizSlideQuestionTrackedRepository} respectively. Subject/title are
 * resolved via the standard slide → chapter_to_slides → chapter → module_chapter_mapping
 * → modules → subject_module_mapping → subject join (same as SlideRepository#findSlideMetadataBySlideId).
 */
public interface SlideMarksProjection {
    String getSlideId();
    String getTitle();
    String getSubjectName();
    Double getMarksObtained();
    Double getTotalMarks();
}
