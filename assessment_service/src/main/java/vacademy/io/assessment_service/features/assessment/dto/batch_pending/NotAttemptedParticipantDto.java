package vacademy.io.assessment_service.features.assessment.dto.batch_pending;

import vacademy.io.assessment_service.features.assessment.dto.ParticipantsDetailsDto;

import java.util.Date;

/**
 * A batch-enrolled learner who has not attempted the assessment, shaped as a
 * {@link ParticipantsDetailsDto} so the Pending tab reuses the existing table, row
 * mapping and response envelope.
 *
 * <p>Everything attempt-shaped is null on purpose: these learners have no
 * {@code assessment_user_registration} row and no {@code student_attempt} row — that
 * absence IS the reason they appear here. Consumers must treat a null
 * {@code registrationId}/{@code attemptId} as "never started", not as missing data.
 */
public class NotAttemptedParticipantDto implements ParticipantsDetailsDto {

    private final String userId;
    private final String studentName;
    private final String batchId;

    public NotAttemptedParticipantDto(String userId, String studentName, String batchId) {
        this.userId = userId;
        this.studentName = studentName;
        this.batchId = batchId;
    }

    @Override
    public String getUserId() {
        return userId;
    }

    @Override
    public String getStudentName() {
        return studentName;
    }

    @Override
    public String getBatchId() {
        return batchId;
    }

    // --- No attempt exists, so nothing attempt-derived can be reported. ---

    @Override
    public String getRegistrationId() {
        return null;
    }

    @Override
    public String getAttemptId() {
        return null;
    }

    @Override
    public Date getAttemptDate() {
        return null;
    }

    @Override
    public Date getEndTime() {
        return null;
    }

    @Override
    public Long getDuration() {
        return null;
    }

    @Override
    public Double getScore() {
        return null;
    }

    @Override
    public String getEvaluationStatus() {
        return null;
    }

    @Override
    public String getReportReleaseResultStatus() {
        return null;
    }

    @Override
    public Date getLastReportReleaseDate() {
        return null;
    }

    @Override
    public String getUserEmail() {
        return null;
    }
}
