package vacademy.io.admin_core_service.features.telephony.controller.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

/**
 * One IVR node in the admin builder payload. {@code id} is a client-generated
 * UUID that other nodes (and the menu's root) reference; on save it is persisted
 * verbatim so the tree's internal links stay valid across reloads.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties(ignoreUnknown = true)
public class IvrNodeDTO {
    /** Client-generated UUID; referenced by digitMap / nextNodeId / menu.rootNodeId. */
    private String id;
    /** PLAY | GATHER | DIAL | VOICEMAIL | HANGUP. */
    private String nodeType;
    private String label;
    private String promptText;
    private String promptAudioId;
    /** GATHER: pressed digit -> next node id. */
    private Map<String, String> digitMap;
    /** DIAL: E.164 numbers to ring. */
    private List<String> dialTargets;
    /** PLAY: next node after the prompt. */
    private String nextNodeId;
    private Integer timeoutSeconds;
    private Integer maxRetries;
}
