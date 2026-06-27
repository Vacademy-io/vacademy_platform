package vacademy.io.admin_core_service.features.call_intelligence.core;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.call_intelligence.dto.CallIntelligenceAnalyticsDto;
import vacademy.io.admin_core_service.features.call_intelligence.dto.CallIntelligenceDto;
import vacademy.io.admin_core_service.features.call_intelligence.persistence.repository.CallIntelligenceRepository;
import vacademy.io.admin_core_service.features.counsellor_workbench.service.CounsellorScopeService;

import java.sql.Timestamp;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Read side of Call Intelligence: per-call and per-lead detail, plus the
 * per-counsellor and per-team (sales head) roll-ups that power the dashboards.
 * Team scope is resolved through {@link CounsellorScopeService} so a head only
 * ever sees their own reporting line.
 */
@Service
@RequiredArgsConstructor
public class CallIntelligenceQueryService {

    private static final long DEFAULT_WINDOW_DAYS = 30;

    private final CallIntelligenceRepository repo;
    private final CounsellorScopeService counsellorScopeService;

    public Optional<CallIntelligenceDto> getByCallLogId(String callLogId) {
        return repo.findByCallLogId(callLogId).map(CallIntelligenceDto::from);
    }

    public List<CallIntelligenceDto> getByResponseId(String responseId) {
        return repo.findByResponseIdOrderByCallStartedAtDesc(responseId).stream()
                .map(CallIntelligenceDto::from).toList();
    }

    /** One counsellor's intelligence over the window. */
    public CallIntelligenceAnalyticsDto counsellorAnalytics(String counsellorUserId, Long fromMillis, Long toMillis) {
        return aggregate(List.of(counsellorUserId), from(fromMillis), to(toMillis), false);
    }

    /** A sales head's whole team (self + all reports) over the window. */
    public CallIntelligenceAnalyticsDto teamAnalytics(String instituteId, String callerUserId,
                                                      Long fromMillis, Long toMillis) {
        List<String> ids = counsellorScopeService.descendantUserIdsForCaller(instituteId, callerUserId);
        return aggregate(ids, from(fromMillis), to(toMillis), true);
    }

    // -------------------------------------------------------------------------

    private CallIntelligenceAnalyticsDto aggregate(List<String> ids, Timestamp from, Timestamp to,
                                                   boolean includePerCounsellor) {
        if (ids == null || ids.isEmpty()) {
            return CallIntelligenceAnalyticsDto.builder()
                    .totalAnalyzed(0)
                    .statusDistribution(Map.of())
                    .sentimentDistribution(Map.of())
                    .perCounsellor(includePerCounsellor ? List.of() : null)
                    .build();
        }

        List<Object[]> aggRows = repo.aggregate(ids, from, to);
        Object[] agg = aggRows.isEmpty() ? new Object[]{0L, null, null} : aggRows.get(0);

        var builder = CallIntelligenceAnalyticsDto.builder()
                .totalAnalyzed(asLong(agg[0]))
                .avgCallerSelfGoalRating(asDouble(agg[1]))
                .avgCallOutputRating(asDouble(agg[2]))
                .statusDistribution(toCountMap(repo.statusDistribution(ids, from, to)))
                .sentimentDistribution(toCountMap(repo.sentimentDistribution(ids, from, to)));

        if (includePerCounsellor) {
            builder.perCounsellor(repo.perCounsellor(ids, from, to).stream()
                    .map(r -> CallIntelligenceAnalyticsDto.CounsellorStat.builder()
                            .counsellorUserId((String) r[0])
                            .totalAnalyzed(asLong(r[1]))
                            .avgCallerSelfGoalRating(asDouble(r[2]))
                            .avgCallOutputRating(asDouble(r[3]))
                            .build())
                    .toList());
        }
        return builder.build();
    }

    private static Map<String, Long> toCountMap(List<Object[]> rows) {
        Map<String, Long> m = new LinkedHashMap<>();
        for (Object[] r : rows) {
            String key = r[0] == null ? "UNKNOWN" : String.valueOf(r[0]);
            m.put(key, asLong(r[1]));
        }
        return m;
    }

    private static long asLong(Object o) {
        return o instanceof Number n ? n.longValue() : 0L;
    }

    private static Double asDouble(Object o) {
        return o instanceof Number n ? n.doubleValue() : null;
    }

    private static Timestamp from(Long millis) {
        if (millis != null) return new Timestamp(millis);
        return new Timestamp(System.currentTimeMillis() - DEFAULT_WINDOW_DAYS * 24L * 60 * 60 * 1000);
    }

    private static Timestamp to(Long millis) {
        return new Timestamp(millis != null ? millis : System.currentTimeMillis());
    }
}
