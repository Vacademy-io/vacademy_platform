package vacademy.io.admin_core_service.features.ai_usage.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.RoleSummaryRow;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.UsageLogRow;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.UserUsageRow;
import vacademy.io.admin_core_service.features.ai_usage.repository.CreditUsageRepository;

import java.sql.Timestamp;
import java.util.Date;
import java.util.List;

/**
 * Read service for per-user AI credit usage. Maps the native-query Object[] rows
 * (credit_transactions joined to the user directory) into typed DTOs.
 */
@Service
public class CreditUsageService {

    @Autowired
    private CreditUsageRepository repository;

    public Page<UserUsageRow> listUsers(String instituteId, Timestamp from, Timestamp to,
                                        String role, Pageable pageable) {
        return repository.findUserUsage(instituteId, from, to, role, pageable).map(this::toUserRow);
    }

    public List<RoleSummaryRow> roleSummary(String instituteId, Timestamp from, Timestamp to) {
        return repository.roleSummary(instituteId, from, to).stream()
                .map(r -> RoleSummaryRow.builder()
                        .role(str(r[0]))
                        .userCount(lng(r[1]))
                        .totalCredits(round(dbl(r[2])))
                        .build())
                .toList();
    }

    public Page<UsageLogRow> userLogs(String instituteId, String userId, Timestamp from,
                                      Timestamp to, Pageable pageable) {
        return repository.findUserLogs(instituteId, userId, from, to, pageable).map(this::toLogRow);
    }

    private UserUsageRow toUserRow(Object[] r) {
        return UserUsageRow.builder()
                .userId(str(r[0]))
                .name(str(r[1]))
                .email(str(r[2]))
                .roles(str(r[3]))
                .totalCredits(round(dbl(r[4])))
                .requestCount(lng(r[5]))
                .build();
    }

    private UsageLogRow toLogRow(Object[] r) {
        return UsageLogRow.builder()
                .id(str(r[0]))
                .createdAt(millis(r[1]))
                .requestType(str(r[2]))
                .model(str(r[3]))
                .credits(round(dbl(r[4])))
                .description(str(r[5]))
                .build();
    }

    // ── value coercion helpers (native query returns JDBC types) ──
    private static String str(Object o) {
        return o == null ? null : o.toString();
    }

    private static double dbl(Object o) {
        if (o == null) return 0d;
        if (o instanceof Number n) return n.doubleValue();
        try {
            return Double.parseDouble(o.toString());
        } catch (NumberFormatException e) {
            return 0d;
        }
    }

    private static long lng(Object o) {
        if (o == null) return 0L;
        if (o instanceof Number n) return n.longValue();
        try {
            return Long.parseLong(o.toString());
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private static Long millis(Object o) {
        if (o instanceof Timestamp ts) return ts.getTime();
        if (o instanceof Date d) return d.getTime();
        return null;
    }

    private static double round(double v) {
        return Math.round(v * 10000.0) / 10000.0;
    }
}
