package vacademy.io.assessment_service.features.assessment.dto.export;

import java.util.Date;

/**
 * One row of the result CSV.
 *
 * <p>Separate from {@link vacademy.io.assessment_service.features.assessment.dto.ParticipantsDetailsDto}
 * on purpose. That interface is the projection for ~10 different participant queries, and
 * adding a getter to it obliges every one of them to select the column — any that did not
 * would fail at runtime, not compile time. This projection is bound to a single query, so
 * the contact columns the export needs can be added without touching the rest.
 */
public interface ResultExportRowDto {

    String getRegistrationId();

    String getStudentName();

    String getUserEmail();

    String getPhoneNumber();

    String getUsername();

    /** Batch id; the export resolves it to a display name via admin_core. */
    String getBatchId();

    Date getAttemptDate();

    Long getDuration();

    Double getScore();
}
