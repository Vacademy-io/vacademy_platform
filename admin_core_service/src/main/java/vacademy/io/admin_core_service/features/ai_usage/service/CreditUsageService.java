package vacademy.io.admin_core_service.features.ai_usage.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.RoleSummaryRow;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.UsageLogRow;
import vacademy.io.admin_core_service.features.ai_usage.dto.CreditUsageDtos.UserUsageRow;
import vacademy.io.admin_core_service.features.ai_usage.repository.CreditUsageRepository;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.common.auth.dto.UserDTO;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * Per-user AI credit usage. Aggregates from credit_transactions (admin_core DB)
 * and enriches names + roles from the auth-service (different DB) via AuthService,
 * since the user directory can't be SQL-joined here. The user-with-usage set is
 * bounded, so role-filter + sort + pagination happen in memory after enrichment.
 */
@Service
public class CreditUsageService {

    @Autowired
    private CreditUsageRepository repository;

    @Autowired
    private AuthService authService;

    public Page<UserUsageRow> listUsers(String instituteId, Timestamp from, Timestamp to,
                                        String role, Pageable pageable) {
        List<Object[]> agg = repository.findAllUserUsage(instituteId, from, to);
        Map<String, UserDTO> users = resolveUsers(agg);

        List<UserUsageRow> rows = new ArrayList<>();
        for (Object[] r : agg) {
            String uid = str(r[0]);
            UserDTO u = users.get(uid);
            List<String> roles = (u != null && u.getRoles() != null) ? u.getRoles() : List.of();
            // Role filter (sub-tab): keep users who hold the selected role.
            if (role != null && !roles.contains(role)) {
                continue;
            }
            String rolesStr = roles.isEmpty() ? str(r[1]) : String.join(",", roles);
            rows.add(UserUsageRow.builder()
                    .userId(uid)
                    .name(u != null ? u.getFullName() : null)
                    .email(u != null ? u.getEmail() : null)
                    .roles(rolesStr)
                    .totalCredits(round(dbl(r[2])))
                    .requestCount(lng(r[3]))
                    .build());
        }
        // Already ordered by net_credits DESC from the DB; paginate in memory.
        int total = rows.size();
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), total);
        List<UserUsageRow> pageContent = (start <= end && start < total) ? rows.subList(start, end) : List.of();
        return new PageImpl<>(pageContent, pageable, total);
    }

    public List<RoleSummaryRow> roleSummary(String instituteId, Timestamp from, Timestamp to) {
        List<Object[]> agg = repository.findAllUserUsage(instituteId, from, to);
        Map<String, UserDTO> users = resolveUsers(agg);

        // role -> [userCount, totalCredits]. A user with multiple roles counts in each.
        Map<String, double[]> byRole = new LinkedHashMap<>();
        for (Object[] r : agg) {
            String uid = str(r[0]);
            double credits = round(dbl(r[2]));
            UserDTO u = users.get(uid);
            List<String> roles;
            if (u != null && u.getRoles() != null && !u.getRoles().isEmpty()) {
                roles = u.getRoles();
            } else {
                String ledger = str(r[1]);
                roles = (ledger != null) ? List.of(ledger) : List.of("UNKNOWN");
            }
            for (String role : roles) {
                double[] v = byRole.computeIfAbsent(role, k -> new double[2]);
                v[0] += 1;
                v[1] += credits;
            }
        }
        return byRole.entrySet().stream()
                .map(e -> RoleSummaryRow.builder()
                        .role(e.getKey())
                        .userCount((long) e.getValue()[0])
                        .totalCredits(round(e.getValue()[1]))
                        .build())
                .sorted((a, b) -> Double.compare(b.getTotalCredits(), a.getTotalCredits()))
                .toList();
    }

    public Page<UsageLogRow> userLogs(String instituteId, String userId, Timestamp from,
                                      Timestamp to, Pageable pageable) {
        return repository.findUserLogs(instituteId, userId, from, to, pageable).map(this::toLogRow);
    }

    /** Batch-resolve user_id -> UserDTO from auth-service. Degrades to an empty map
     * (names shown as user_id) if auth-service is unavailable — never 500s. */
    private Map<String, UserDTO> resolveUsers(List<Object[]> agg) {
        List<String> ids = agg.stream().map(r -> str(r[0])).filter(Objects::nonNull).distinct().toList();
        if (ids.isEmpty()) {
            return Map.of();
        }
        try {
            return authService.getUsersFromAuthServiceByUserIds(ids).stream()
                    .filter(u -> u != null && u.getId() != null)
                    .collect(Collectors.toMap(UserDTO::getId, u -> u, (a, b) -> a));
        } catch (Exception e) {
            return Map.of();
        }
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

    // ── coercion helpers (native query returns JDBC types) ──
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
