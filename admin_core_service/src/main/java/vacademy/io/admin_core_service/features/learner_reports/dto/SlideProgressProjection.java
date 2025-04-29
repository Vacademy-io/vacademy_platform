package vacademy.io.admin_core_service.features.learner_reports.dto;

public interface SlideProgressProjection {
    String getSlideId();

    String getSlideTitle();

    String getChapter();

    String getChapterId();

    String getModuleId();

    String getModuleName();

    Double getConcentrationScore();

    Integer getTimeSpent();
}
