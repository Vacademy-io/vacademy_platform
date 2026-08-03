package vacademy.io.assessment_service.features.assessment.service.export;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.json.JsonMapper;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import vacademy.io.assessment_service.features.learner_assessment.dto.ReportBrandingDto;
import vacademy.io.assessment_service.features.learner_assessment.dto.ReportClassContext;
import vacademy.io.assessment_service.features.learner_assessment.dto.context.AssessmentOverviewSnapshot;
import vacademy.io.assessment_service.features.learner_assessment.dto.context.HistogramSpec;
import vacademy.io.assessment_service.features.learner_assessment.dto.context.LeaderBoardSnapshot;
import vacademy.io.assessment_service.features.learner_assessment.dto.context.MarksRankSnapshot;
import vacademy.io.assessment_service.features.learner_assessment.dto.context.SectionAggregateSnapshot;

import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Jackson to/from {@code job.context_snapshot}, versioned. See
 * ARCHITECTURE.md §9. Uses a dedicated {@link ObjectMapper} rather than the
 * Spring-managed one — the Spring mapper's configuration is shared with the
 * HTTP layer and can be changed by anyone; the snapshot format must stay
 * stable across deploys independent of that.
 */
@Slf4j
@Component
public class ReportExportContextSerializer {

    public static final int CURRENT_VERSION = 1;

    private static final ObjectMapper MAPPER = JsonMapper.builder()
            .addModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .serializationInclusion(JsonInclude.Include.NON_NULL)
            .build();

    /**
     * Private transport record: every field concrete, nothing interface-typed,
     * so Jackson never has to infer a target type for a projection interface
     * (X1 — the whole reason this class exists instead of serialising
     * ReportClassContext directly).
     */
    private record Snapshot(
            int version, String assessmentId, String instituteId, String assessmentName,
            AssessmentOverviewSnapshot overview,
            List<MarksRankSnapshot> marksDistribution,
            List<LeaderBoardSnapshot> fullLeaderboard,
            Map<String, SectionAggregateSnapshot> sectionAggregation,
            Double totalMarks, Double classAccuracy, Double highestMarks, Double lowestMarks,
            HistogramSpec histogram, ReportBrandingDto branding) {
    }

    public String toJson(ReportClassContext ctx) {
        Snapshot snapshot = new Snapshot(
                CURRENT_VERSION, ctx.getAssessmentId(), ctx.getInstituteId(), ctx.getAssessmentName(),
                ctx.getOverview() != null ? AssessmentOverviewSnapshot.from(ctx.getOverview()) : null,
                narrowMarks(ctx.getMarksDistribution()),
                narrowLeaderboard(ctx.getFullLeaderboard()),
                ctx.getSectionAggregation(),
                ctx.getTotalMarks(), ctx.getClassAccuracy(), ctx.getHighestMarks(), ctx.getLowestMarks(),
                ctx.getHistogram(), ctx.getBranding());
        try {
            return MAPPER.writeValueAsString(snapshot);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialise report class context: " + e.getMessage(), e);
        }
    }

    /**
     * Returns empty on any failure (missing snapshot, wrong version, malformed
     * JSON, class-shape drift across a deploy) — callers must rebuild fresh and
     * flag context_drift rather than fail the job (D5). Never throws.
     */
    public Optional<ReportClassContext> fromJson(String json, Integer storedVersion) {
        if (json == null || json.isBlank()) return Optional.empty();
        if (storedVersion == null || storedVersion != CURRENT_VERSION) {
            log.warn("[report-export] context snapshot version mismatch (stored={}, current={}) — will rebuild",
                    storedVersion, CURRENT_VERSION);
            return Optional.empty();
        }
        try {
            Snapshot s = MAPPER.readValue(json, Snapshot.class);
            if (s.version() != CURRENT_VERSION) return Optional.empty();
            ReportClassContext ctx = ReportClassContext.builder()
                    .assessmentId(s.assessmentId())
                    .instituteId(s.instituteId())
                    .assessmentName(s.assessmentName())
                    .overview(s.overview())
                    .marksDistribution(s.marksDistribution() != null ? List.copyOf(s.marksDistribution()) : List.of())
                    .fullLeaderboard(s.fullLeaderboard() != null ? List.copyOf(s.fullLeaderboard()) : List.of())
                    .sectionAggregation(s.sectionAggregation())
                    .totalMarks(s.totalMarks())
                    .classAccuracy(s.classAccuracy())
                    .highestMarks(s.highestMarks())
                    .lowestMarks(s.lowestMarks())
                    .histogram(s.histogram())
                    .branding(s.branding())
                    .snapshotVersion(s.version())
                    .build();
            return Optional.of(ctx);
        } catch (Exception e) {
            log.warn("[report-export] Failed to deserialise context snapshot: {}", e.getMessage());
            return Optional.empty();
        }
    }

    private static List<MarksRankSnapshot> narrowMarks(List<?> raw) {
        if (raw == null) return List.of();
        return raw.stream()
                .map(o -> o instanceof MarksRankSnapshot m ? m
                        : MarksRankSnapshot.from((vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.MarksRankDto) o))
                .toList();
    }

    private static List<LeaderBoardSnapshot> narrowLeaderboard(List<?> raw) {
        if (raw == null) return List.of();
        return raw.stream()
                .map(o -> o instanceof LeaderBoardSnapshot l ? l
                        : LeaderBoardSnapshot.from((vacademy.io.assessment_service.features.assessment.dto.LeaderBoardDto) o))
                .toList();
    }
}
