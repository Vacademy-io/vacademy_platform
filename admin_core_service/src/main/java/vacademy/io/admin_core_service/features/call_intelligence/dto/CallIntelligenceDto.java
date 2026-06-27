package vacademy.io.admin_core_service.features.call_intelligence.dto;

import lombok.Builder;
import lombok.Data;
import vacademy.io.admin_core_service.features.call_intelligence.persistence.entity.CallIntelligence;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.Map;

/** Read model for one analyzed call (per-call view + per-lead list). */
@Data
@Builder
public class CallIntelligenceDto {

    private String id;
    private String callLogId;
    private String instituteId;
    private String counsellorUserId;
    private String responseId;
    private String userId;
    private String source;
    private String direction;
    private Timestamp callStartedAt;
    private Integer durationSeconds;

    private String status;
    private String skipReason;

    private String detectedLanguage;
    private String inferredGoal;
    private String callType;
    private String generalSummary;
    private String genericStatus;
    private BigDecimal callerSelfGoalRating;
    private BigDecimal callOutputRating;
    private String conversionLikelihood;
    private String leadSentiment;

    /** Full nested analysis (action_items, objections, qualities, coaching_tips, highlights, …). */
    private Map<String, Object> analysis;

    private BigDecimal creditsCharged;
    private String schemaVersion;
    private Timestamp completedAt;

    public static CallIntelligenceDto from(CallIntelligence c) {
        return CallIntelligenceDto.builder()
                .id(c.getId())
                .callLogId(c.getCallLogId())
                .instituteId(c.getInstituteId())
                .counsellorUserId(c.getCounsellorUserId())
                .responseId(c.getResponseId())
                .userId(c.getUserId())
                .source(c.getSource())
                .direction(c.getDirection())
                .callStartedAt(c.getCallStartedAt())
                .durationSeconds(c.getDurationSeconds())
                .status(c.getStatus())
                .skipReason(c.getSkipReason())
                .detectedLanguage(c.getDetectedLanguage())
                .inferredGoal(c.getInferredGoal())
                .callType(c.getCallType())
                .generalSummary(c.getGeneralSummary())
                .genericStatus(c.getGenericStatus())
                .callerSelfGoalRating(c.getCallerSelfGoalRating())
                .callOutputRating(c.getCallOutputRating())
                .conversionLikelihood(c.getConversionLikelihood())
                .leadSentiment(c.getLeadSentiment())
                .analysis(c.getAnalysisJson())
                .creditsCharged(c.getCreditsCharged())
                .schemaVersion(c.getSchemaVersion())
                .completedAt(c.getCompletedAt())
                .build();
    }
}
