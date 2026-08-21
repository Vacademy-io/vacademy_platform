package vacademy.io.admin_core_service.features.reporting.service;

import lombok.Builder;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.reporting.dto.ReportScheduleConfig;
import vacademy.io.common.auth.dto.UserDTO;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Turns a schedule's recipient rule into actual people, and works out what each of
 * them is allowed to be shown.
 *
 * Two things happen here that must not be moved into configuration:
 *
 * <p><b>1. Roles are expanded server-side.</b> Role membership lives in
 * auth_service's database, so admin_core cannot join to it — the expansion is an
 * internal HTTP call, and only ACTIVE memberships come back.
 *
 * <p><b>2. Teachers are hard-scoped to their own cohorts.</b> A report can name
 * learners. A TEACHER recipient therefore only ever sees learners in the batches
 * they actually teach, resolved from faculty_subject_package_session_mapping, and
 * a schedule cannot widen that no matter how it was configured. An admin who ticks
 * "institute-wide" and adds four teachers gets one institute-wide document and four
 * cohort-limited ones — not five copies of every child's name.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ReportRecipientResolver {

    private final AuthService authService;
    private final JdbcTemplate jdbcTemplate;

    @Getter
    @Builder
    public static class Recipient {
        private final String userId;
        private final String email;
        private final String name;
        private final Set<String> roles;
        /** Null = may see every learner. Non-null = hard limit, enforced downstream. */
        private final List<String> visibleLearnerIds;
    }

    public List<Recipient> resolve(String instituteId, ReportScheduleConfig schedule) {
        ReportScheduleConfig.Recipients rule = schedule.getRecipients();
        if (rule == null) return List.of();

        // Keyed by user id so someone who is both named explicitly and covered by a
        // role rule receives one document, not two.
        Map<String, UserDTO> byId = new LinkedHashMap<>();

        if (rule.getUserIds() != null && !rule.getUserIds().isEmpty()) {
            try {
                for (UserDTO u : authService.getUsersFromAuthServiceByUserIds(rule.getUserIds())) {
                    if (u != null && u.getId() != null) byId.put(u.getId(), u);
                }
            } catch (Exception e) {
                log.warn("[reporting] could not resolve explicit recipients for institute {}", instituteId, e);
            }
        }

        if (rule.getRoles() != null && !rule.getRoles().isEmpty()) {
            for (UserDTO u : authService.getUsersByInstituteAndRoles(instituteId, rule.getRoles())) {
                if (u != null && u.getId() != null) byId.putIfAbsent(u.getId(), u);
            }
        }

        List<Recipient> out = new ArrayList<>();
        for (UserDTO u : byId.values()) {
            Set<String> roles = u.getRoles() == null ? Set.of()
                    : u.getRoles().stream().filter(java.util.Objects::nonNull)
                        .map(r -> r.trim().toUpperCase(Locale.ROOT)).collect(Collectors.toSet());

            out.add(Recipient.builder()
                    .userId(u.getId())
                    .email(u.getEmail())
                    .name(u.getFullName())
                    .roles(roles)
                    .visibleLearnerIds(resolveVisibleLearners(instituteId, u.getId(), roles))
                    .build());
        }
        return out;
    }

    /**
     * @return null when the reader may see everyone, or the explicit set of learner
     *         ids they may see. An empty list means "may see nobody", which is
     *         different from null and must stay different.
     */
    private List<String> resolveVisibleLearners(String instituteId, String userId, Set<String> roles) {
        boolean privileged = roles.contains("ADMIN") || roles.contains("SUPER_ADMIN");
        if (privileged) return null;
        if (!roles.contains("TEACHER") && !roles.contains("EVALUATOR")) {
            // Unknown role with no cohort of its own — show them no learners rather
            // than defaulting open.
            return List.of();
        }
        try {
            return jdbcTemplate.queryForList(TEACHER_LEARNERS_SQL, String.class, userId, instituteId);
        } catch (Exception e) {
            log.warn("[reporting] cohort lookup failed for teacher {} — naming nobody", userId, e);
            return List.of();
        }
    }

    /**
     * Learners enrolled in the package sessions this faculty member is mapped to.
     * Fails closed by returning nothing if the mapping is absent.
     */
    private static final String TEACHER_LEARNERS_SQL = """
            SELECT DISTINCT m.user_id
            FROM faculty_subject_package_session_mapping f
            JOIN student_session_institute_group_mapping m
              ON m.package_session_id = f.package_session_id
            WHERE f.user_id = ?
              AND f.status <> 'DELETED'
              AND m.institute_id = ?
              AND m.status = 'ACTIVE'
            """;
}
