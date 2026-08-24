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
        /**
         * Cohorts (package_session ids) this reader may see, or null for all.
         *
         * The learner list above cannot scope a section whose subject is a CLASS
         * rather than a person — live attendance names no learner, so filtering it
         * by learner id is a no-op and a teacher would receive every colleague's
         * attendance rates. Same source mapping, one level up.
         */
        private final List<String> visibleCohortIds;
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

        if (byId.isEmpty()) return List.of();

        // Roles must be read PER INSTITUTE. UserDTO.roles is every role the person
        // holds anywhere (User.roles is a plain @OneToMany filtered only on
        // status IN ('ACTIVE','INVITED')), so deciding "is this an admin here" from
        // it lets a teacher at this institute who is an admin at ANY other one
        // bypass the cohort restriction and be emailed every learner by name.
        Map<String, List<String>> instituteRoles =
                authService.getInstituteRoles(instituteId, new ArrayList<>(byId.keySet()));

        List<Recipient> out = new ArrayList<>();
        for (UserDTO u : byId.values()) {
            Set<String> roles = instituteRoles.getOrDefault(u.getId(), List.of()).stream()
                    .filter(java.util.Objects::nonNull)
                    .map(r -> r.trim().toUpperCase(Locale.ROOT))
                    .collect(Collectors.toSet());

            if (roles.isEmpty()) {
                // No ACTIVE role at this institute — could be a stale explicit
                // recipient id, or the lookup failed. Either way, send nothing
                // rather than defaulting to unrestricted.
                log.warn("[reporting] recipient {} has no active role at institute {} — skipped",
                        u.getId(), instituteId);
                continue;
            }

            out.add(Recipient.builder()
                    .userId(u.getId())
                    .email(u.getEmail())
                    .name(u.getFullName())
                    .roles(roles)
                    .visibleLearnerIds(resolveVisibleLearners(instituteId, u.getId(), roles))
                    .visibleCohortIds(resolveVisibleCohorts(instituteId, u.getId(), roles))
                    .build());
        }
        return out;
    }

    /** Roles that can receive a report — mirrors the ROLES list on the config screen. */
    private static final List<String> CANDIDATE_ROLES = List.of("ADMIN", "TEACHER", "EVALUATOR");

    public record Candidate(String userId, String name, String email, List<String> roles) {}

    /**
     * People at this institute who could be named as recipients.
     *
     * Needed because a schedule could previously only target ROLES — "every ADMIN"
     * — which makes a careful first send impossible: there was no way to address a
     * report to one person. It also keeps the platform-users-only rule intact,
     * since the picker can only ever offer real users of this institute and never
     * a typed-in address.
     *
     * Users are collected per role so the roles reported back are the ones that
     * actually matched at THIS institute, rather than {@code UserDTO.roles}, which
     * carries no institute predicate and would leak an elsewhere-ADMIN into the
     * list as though they were an admin here.
     */
    public List<Candidate> candidates(String instituteId, String query, int limit) {
        Map<String, Candidate> byId = new LinkedHashMap<>();
        for (String role : CANDIDATE_ROLES) {
            List<UserDTO> users;
            try {
                users = authService.getUsersByInstituteAndRoles(instituteId, List.of(role));
            } catch (Exception e) {
                log.warn("[reporting] candidate lookup failed for role {} at institute {}",
                        role, instituteId, e);
                continue;
            }
            if (users == null) continue;
            for (UserDTO u : users) {
                if (u == null || u.getId() == null) continue;
                Candidate existing = byId.get(u.getId());
                List<String> roles = existing == null
                        ? new ArrayList<>()
                        : new ArrayList<>(existing.roles());
                if (!roles.contains(role)) roles.add(role);
                byId.put(u.getId(), new Candidate(u.getId(), u.getFullName(), u.getEmail(), roles));
            }
        }

        String q = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        int cap = Math.max(1, Math.min(limit, 200));
        return byId.values().stream()
                .filter(c -> q.isEmpty()
                        || (c.name() != null && c.name().toLowerCase(Locale.ROOT).contains(q))
                        || (c.email() != null && c.email().toLowerCase(Locale.ROOT).contains(q)))
                .limit(cap)
                .toList();
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
     * @return null when the reader may see every cohort, else the package sessions
     *         they are mapped to. Empty means "may see none", and stays distinct.
     */
    private List<String> resolveVisibleCohorts(String instituteId, String userId, Set<String> roles) {
        if (roles.contains("ADMIN") || roles.contains("SUPER_ADMIN")) return null;
        if (!roles.contains("TEACHER") && !roles.contains("EVALUATOR")) return List.of();
        try {
            return jdbcTemplate.queryForList(TEACHER_COHORTS_SQL, String.class, userId, instituteId);
        } catch (Exception e) {
            log.warn("[reporting] cohort lookup failed for teacher {} — showing no classes", userId, e);
            return List.of();
        }
    }

    /** The package sessions this faculty member teaches. Fails closed. */
    private static final String TEACHER_COHORTS_SQL = """
            SELECT DISTINCT f.package_session_id
            FROM faculty_subject_package_session_mapping f
            JOIN package_session ps ON ps.id = f.package_session_id
            JOIN package_institute pi ON pi.package_id = ps.package_id
            WHERE f.user_id = ?
              AND f.status <> 'DELETED'
              AND pi.institute_id = ?
            """;

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
