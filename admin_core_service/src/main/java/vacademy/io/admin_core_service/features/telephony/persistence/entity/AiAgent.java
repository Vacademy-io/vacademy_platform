package vacademy.io.admin_core_service.features.telephony.persistence.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.sql.Timestamp;

/**
 * One AI voice agent (persona) an institute authored — referenced by the CALL_AI
 * workflow node, the IVR AI branch, campaigns and the manual AI-call button (the
 * agent id doubles as the VACADEMY_AI "campaignId"). See V355 + AiAgentService.
 */
@Entity
@Table(name = "ai_agent")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AiAgent {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "institute_id", nullable = false, length = 36)
    private String instituteId;

    @Column(name = "name", nullable = false, length = 128)
    private String name;

    @Column(name = "enabled", nullable = false)
    @Builder.Default
    private Boolean enabled = true;

    /** OUTBOUND | INBOUND | BOTH. */
    @Column(name = "direction", nullable = false, length = 16)
    @Builder.Default
    private String direction = "OUTBOUND";

    @Column(name = "language", length = 32)
    private String language;

    /** Sarvam Bulbul voice id. */
    @Column(name = "voice", length = 64)
    private String voice;

    @Column(name = "opening_line", columnDefinition = "TEXT")
    private String openingLine;

    @Column(name = "system_prompt", columnDefinition = "TEXT")
    private String systemPrompt;

    /** JSON array of the questions the agent should extract answers for. */
    @Column(name = "extraction_questions", columnDefinition = "TEXT")
    private String extractionQuestions;

    /** JSON array of allowed dispositions; blank = classifier defaults from settings. */
    @Column(name = "dispositions", columnDefinition = "TEXT")
    private String dispositions;

    /** JSON array of E.164 handoff targets; blank = telephony voicemail fallback. */
    @Column(name = "handoff_numbers", columnDefinition = "TEXT")
    private String handoffNumbers;

    @Column(name = "max_call_minutes")
    private Integer maxCallMinutes;

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;
}
