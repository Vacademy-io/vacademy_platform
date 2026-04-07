package vacademy.io.admin_core_service.features.audience.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.sql.Timestamp;

/**
 * Stores computed lead score for each AudienceResponse.
 * raw_score is updated in real-time on every lead event.
 * percentile_rank is recalculated in batch every 15 minutes.
 */
@Entity
@Table(name = "lead_score")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LeadScore {

    @Id
    @UuidGenerator
    @Column(name = "id", nullable = false, unique = true)
    private String id;

    @Column(name = "audience_response_id", nullable = false, unique = true)
    private String audienceResponseId;

    @Column(name = "audience_id", nullable = false)
    private String audienceId;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "raw_score", nullable = false)
    @Builder.Default
    private Integer rawScore = 0;

    @Column(name = "percentile_rank")
    @Builder.Default
    private BigDecimal percentileRank = new BigDecimal("50.00");

    @Column(name = "scoring_factors_json", columnDefinition = "TEXT")
    private String scoringFactorsJson;

    @Column(name = "last_calculated_at", nullable = false)
    @Builder.Default
    private Timestamp lastCalculatedAt = new Timestamp(System.currentTimeMillis());

    @Column(name = "created_at", insertable = false, updatable = false)
    private Timestamp createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private Timestamp updatedAt;

    /**
     * Returns the lead tier based on raw score.
     */
    public String getTier() {
        if (rawScore >= 80) return "HOT";
        if (rawScore >= 50) return "WARM";
        return "COLD";
    }
}
