package vacademy.io.admin_core_service.features.learner_tracking.repository;

import java.sql.Timestamp;

/**
 * One row in a learner's "Activity Insights" list.
 *
 * <p>Deliberately excludes {@code raw_json} and {@code processed_json}: a list of twenty
 * reports that each carry their full analysis payload is megabytes of response for a
 * screen that shows a title and a date. The body is fetched per report on open.
 */
public interface LearnerInsightSummaryProjection {

    String getId();

    String getSourceType();

    String getSlideId();

    String getSourceId();

    /** Slide title, resolved by join. Null if the slide has since been deleted. */
    String getTitle();

    Timestamp getCreatedAt();
}
