package vacademy.io.assessment_service.features.user_credentials.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Per-table row counts from a rename, so the caller's log line says what
 * actually moved rather than just "ok". A rename that reports all zeros is a
 * signal worth investigating (wrong old username, or the learner genuinely has
 * no assessment/live-class footprint).
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class UsernameRenameResponse {

    private int assessmentUserRegistrationRows;
    private int assessmentUserAccessRows;
    private int liveSessionParticipantRows;
    private int liveSessionResponseRows;

    /**
     * Participant rows left untouched because the session already had a row
     * under the new username (the {@code UNIQUE (session_id, username)}
     * constraint). Non-zero means that learner's history for those sessions
     * stays under the old name — rare, but it should be visible, not silent.
     */
    private int liveSessionParticipantConflicts;

    public int getTotalRows() {
        return assessmentUserRegistrationRows
                + assessmentUserAccessRows
                + liveSessionParticipantRows
                + liveSessionResponseRows;
    }
}
