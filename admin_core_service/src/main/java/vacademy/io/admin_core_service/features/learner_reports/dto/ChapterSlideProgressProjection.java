package vacademy.io.admin_core_service.features.learner_reports.dto;

public interface ChapterSlideProgressProjection {
    String getChapterId();

    String getChapterName();

    String getSlides(); // JSON string of slides array
}