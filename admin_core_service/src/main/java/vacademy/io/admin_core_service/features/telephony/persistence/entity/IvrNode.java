package vacademy.io.admin_core_service.features.telephony.persistence.entity;

import jakarta.persistence.*;
import lombok.*;

import java.sql.Timestamp;

/**
 * One node in an IVR tree. {@code digit_map} (GATHER) and {@code dial_targets}
 * (DIAL) hold JSON; the service parses them. See V352 + {@code IvrNodeType}.
 */
@Entity
@Table(name = "ivr_node")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class IvrNode {

    @Id
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "menu_id", nullable = false, length = 36)
    private String menuId;

    @Column(name = "node_type", nullable = false, length = 24)
    private String nodeType;

    @Column(name = "label", length = 128)
    private String label;

    @Column(name = "prompt_text", columnDefinition = "TEXT")
    private String promptText;

    @Column(name = "prompt_audio_id", length = 64)
    private String promptAudioId;

    /** GATHER: JSON map {"1":"<nodeId>",...}. */
    @Column(name = "digit_map", columnDefinition = "TEXT")
    private String digitMap;

    /** DIAL: JSON array ["+9198...",...]. */
    @Column(name = "dial_targets", columnDefinition = "TEXT")
    private String dialTargets;

    /** PLAY: the next node after the prompt. */
    @Column(name = "next_node_id", length = 36)
    private String nextNodeId;

    @Column(name = "timeout_seconds", nullable = false)
    @Builder.Default
    private Integer timeoutSeconds = 6;

    @Column(name = "max_retries", nullable = false)
    @Builder.Default
    private Integer maxRetries = 2;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
