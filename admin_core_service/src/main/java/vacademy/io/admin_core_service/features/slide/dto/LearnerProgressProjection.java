package vacademy.io.admin_core_service.features.slide.dto;

public interface LearnerProgressProjection {
    Double getChapterCompletionPercentage();
    Double getModuleCompletionPercentage();
    Double getSubjectCompletionPercentage();
    Double getPackageSessionCompletionPercentage();
    String getLastWatchedSlideId();
}
