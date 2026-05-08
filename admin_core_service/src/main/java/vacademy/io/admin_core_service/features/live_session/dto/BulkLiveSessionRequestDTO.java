package vacademy.io.admin_core_service.features.live_session.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategy;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategy.SnakeCaseStrategy.class)
public class BulkLiveSessionRequestDTO {

    /**
     * One entry per session to create. Each entry uses the same shape as a
     * single step-1 request so existing client transformations are reusable.
     */
    private List<LiveSessionStep1RequestDTO> sessions;

    /**
     * Optional shared step-2 payload (access type, participants, notifications,
     * registration form fields). When provided, it is applied to every session
     * created from {@link #sessions}; the {@code session_id} on the template is
     * ignored and replaced per row.
     */
    private LiveSessionStep2RequestDTO step2Template;

    /**
     * Optional per-row step-2 payloads. When provided, this list MUST be the
     * same length as {@link #sessions} — entry {@code i} is applied to the
     * session created from {@code sessions[i]}. Takes precedence over
     * {@link #step2Template} so callers can express "different batches for
     * each row" in a single request without making N follow-up step-2 calls.
     * Each entry's {@code session_id} is ignored and replaced server-side.
     */
    private List<LiveSessionStep2RequestDTO> step2PerRow;
}
