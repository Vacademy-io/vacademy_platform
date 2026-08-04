package vacademy.io.assessment_service.features.assessment.dto.offline_entry;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.*;

/**
 * The scanned artifacts an admin attaches to an offline data-entry attempt.
 * Every field is optional — a blank/absent id leaves whatever is already on the
 * attempt untouched, so a re-upload of just one sheet never wipes the others.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class OfflineAttachmentsRequest {
    // The learner's raw answer sheet -> attempt_data JSON key "fileId"
    private String studentFileId;
    // The evaluator's annotated/checked copy -> student_attempt.evaluated_file_id
    private String checkedFileId;
    // An externally prepared result report -> attempt_data JSON key "reportFileId".
    // Deliberately NOT report_pdf_file_id: that column caches the system-generated
    // report and is overwritten on every result release, which would silently
    // destroy an admin-uploaded file.
    private String reportFileId;
}
