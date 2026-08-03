package vacademy.io.admin_core_service.features.learner_credentials.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

/**
 * Per-channel outcome of a credential share.
 *
 * <p>Deliberately not a bare 200/500: a send can partly succeed (email goes out,
 * WhatsApp has no template bound or the learner has no phone), and the admin
 * needs to be told which channel actually delivered. Returning "OK" for a
 * request where nothing was sent is the failure mode this shape exists to
 * prevent.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LearnerCredentialSendResult {

    /** Channels a message was actually dispatched on. */
    @Builder.Default
    private List<String> sentChannels = new ArrayList<>();

    /** Channels asked for that produced nothing, with the reason. */
    @Builder.Default
    private List<String> skippedChannels = new ArrayList<>();

    private String message;
}
