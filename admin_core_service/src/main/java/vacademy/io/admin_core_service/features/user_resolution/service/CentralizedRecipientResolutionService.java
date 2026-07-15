package vacademy.io.admin_core_service.features.user_resolution.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.user_resolution.dto.PaginatedUserIdResponse;
import vacademy.io.admin_core_service.features.user_resolution.dto.CentralizedRecipientResolutionRequest;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class CentralizedRecipientResolutionService {

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Resolve recipients with inclusions, exclusions, and custom field filters in one query.
     *
     * Tables referenced (all in admin_core_service's DB):
     *   - user_tags                              (TAG type)
     *   - student_session_institute_group_mapping (PACKAGE_SESSION/sub-org-roles, students)
     *   - faculty_subject_package_session_mapping (PACKAGE_SESSION/sub-org-roles, faculty)
     *   - audience_response                      (AUDIENCE type)
     *   - custom_field_values + institute_custom_fields + custom_fields (custom field filters)
     *
     * ROLE recipients are NOT handled here — auth_service owns the user_role/roles tables in a
     * separate DB, so notification_service pre-resolves ROLE recipients into USER recipients
     * before calling this endpoint.
     */
    @Transactional(readOnly = true)
    public PaginatedUserIdResponse resolveRecipients(CentralizedRecipientResolutionRequest request) {
        log.info("Centralized recipient resolution start: institute={}, recipients={}",
                request.getInstituteId(), request.getRecipients().size());

        try {
            QueryWithParams main = buildMainQuery(request);

            // Count
            QueryWithParams count = buildCountQuery(main);
            Query countJpaQuery = entityManager.createNativeQuery(count.sql);
            applyParams(countJpaQuery, count.params);
            long totalElements = ((Number) countJpaQuery.getSingleResult()).longValue();

            int totalPages = (int) Math.ceil((double) totalElements / Math.max(1, request.getPageSize()));

            // Page of results
            Query mainJpaQuery = entityManager.createNativeQuery(main.sql);
            applyParams(mainJpaQuery, main.params);
            mainJpaQuery.setFirstResult(request.getPageNumber() * request.getPageSize());
            mainJpaQuery.setMaxResults(request.getPageSize());

            @SuppressWarnings("unchecked")
            List<String> userIds = mainJpaQuery.getResultList();

            PaginatedUserIdResponse response = new PaginatedUserIdResponse();
            response.setUserIds(userIds);
            response.setPageNumber(request.getPageNumber());
            response.setPageSize(request.getPageSize());
            response.setTotalElements(totalElements);
            response.setTotalPages(totalPages);
            response.setHasNext(request.getPageNumber() < totalPages - 1);
            response.setHasPrevious(request.getPageNumber() > 0);
            response.setFirst(request.getPageNumber() == 0);
            response.setLast(request.getPageNumber() >= totalPages - 1);

            log.info("Centralized resolution done: {} users (page {}/{}, total {})",
                    userIds.size(), request.getPageNumber() + 1, totalPages, totalElements);
            return response;

        } catch (Exception e) {
            log.error("Error in centralized recipient resolution for institute: {}", request.getInstituteId(), e);
            return new PaginatedUserIdResponse(
                    new ArrayList<>(),
                    request.getPageNumber(),
                    request.getPageSize(),
                    0,
                    0,
                    false,
                    request.getPageNumber() > 0,
                    request.getPageNumber() == 0,
                    true
            );
        }
    }

    // -------- Query building --------

    /**
     * Holder for a SQL string plus its positional parameters. Positional parameters
     * (?1, ?2, ...) are used because we build fragments and UNION them together —
     * fragments need a contiguous index, easy to rebase when concatenating.
     */
    private static class QueryWithParams {
        String sql;
        List<Object> params = new ArrayList<>();

        QueryWithParams(String sql) { this.sql = sql; }
    }

    private QueryWithParams buildMainQuery(CentralizedRecipientResolutionRequest request) {
        QueryWithParams combined = new QueryWithParams(null);
        List<String> unionFragments = new ArrayList<>();
        int nextParamIndex = 1;

        for (CentralizedRecipientResolutionRequest.RecipientWithExclusions recipient : request.getRecipients()) {
            QueryWithParams fragment = buildRecipientFragment(recipient, request.getInstituteId(), nextParamIndex);
            if (fragment != null && fragment.sql != null && !fragment.sql.isEmpty()) {
                unionFragments.add(fragment.sql);
                combined.params.addAll(fragment.params);
                nextParamIndex += fragment.params.size();
            }
        }

        if (unionFragments.isEmpty()) {
            combined.sql = "SELECT NULL::text as user_id WHERE FALSE";
            return combined;
        }

        combined.sql = "SELECT DISTINCT user_id FROM (" +
                String.join(" UNION ALL ", unionFragments) +
                ") combined WHERE user_id IS NOT NULL ORDER BY user_id";
        return combined;
    }

    private QueryWithParams buildCountQuery(QueryWithParams main) {
        QueryWithParams count = new QueryWithParams(
                "SELECT COUNT(*) FROM (" + main.sql + ") c");
        count.params = new ArrayList<>(main.params);
        return count;
    }

    /** Per-recipient: base query + (optional) custom-field filters + (optional) exclusions. */
    private QueryWithParams buildRecipientFragment(
            CentralizedRecipientResolutionRequest.RecipientWithExclusions recipient,
            String instituteId,
            int paramOffset) {

        QueryWithParams base = buildBaseRecipientQuery(
                recipient.getRecipientType(), recipient.getRecipientId(), instituteId, recipient.getCustomFieldFilters(), paramOffset);
        if (base == null) {
            return null;
        }

        // Exclusions: wrap base with `WHERE user_id NOT IN (<excluded users>)`
        if (recipient.getExclusions() != null && !recipient.getExclusions().isEmpty()) {
            int nextIdx = paramOffset + base.params.size();
            List<String> exclusionUnions = new ArrayList<>();
            for (CentralizedRecipientResolutionRequest.RecipientWithExclusions.Exclusion exclusion : recipient.getExclusions()) {
                QueryWithParams ex = buildBaseRecipientQuery(
                        exclusion.getExclusionType(), exclusion.getExclusionId(), instituteId,
                        exclusion.getCustomFieldFilters(), nextIdx);
                if (ex != null && ex.sql != null && !ex.sql.isEmpty()) {
                    exclusionUnions.add(ex.sql);
                    base.params.addAll(ex.params);
                    nextIdx += ex.params.size();
                }
            }
            if (!exclusionUnions.isEmpty()) {
                base.sql = "SELECT user_id FROM (" + base.sql + ") inc " +
                        "WHERE user_id NOT IN (" + String.join(" UNION ", exclusionUnions) + ")";
            }
        }

        return base;
    }

    /**
     * Build the base "users matching <type=id>" query, optionally narrowed by an
     * inline set of custom-field filters. Each query exposes a column aliased `user_id`.
     */
    private QueryWithParams buildBaseRecipientQuery(
            String recipientType,
            String recipientId,
            String instituteId,
            List<CentralizedRecipientResolutionRequest.RecipientWithExclusions.CustomFieldFilter> filters,
            int paramOffset) {

        if (recipientType == null) return null;

        switch (recipientType.toUpperCase()) {
            case "USER": {
                QueryWithParams q = new QueryWithParams("SELECT ?" + paramOffset + " as user_id");
                q.params.add(recipientId);
                return narrowByFilters(q, filters, paramOffset + q.params.size());
            }

            case "PACKAGE_SESSION": {
                QueryWithParams q = packageSessionUnion(recipientId, paramOffset);
                return narrowByFilters(q, filters, paramOffset + q.params.size());
            }

            case "PACKAGE_SESSION_COMMA_SEPARATED_ORG_ROLES": {
                String[] parts = recipientId == null ? new String[0] : recipientId.split(":");
                if (parts.length != 2) return null;
                String packageSessionId = parts[0];
                String orgRoles = parts[1];

                // Students with matching org roles + faculty for that package_session.
                // Faculty assignment is independent of student org roles, so we include all
                // active faculty for the package session (matches the legacy resolver).
                String sql =
                        "SELECT DISTINCT ssigm.user_id FROM student_session_institute_group_mapping ssigm " +
                        "WHERE ssigm.package_session_id = ?" + paramOffset + " AND ssigm.status = 'ACTIVE' " +
                        "  AND ssigm.user_id IS NOT NULL " +
                        "  AND ssigm.comma_separated_org_roles IS NOT NULL " +
                        "  AND EXISTS (" +
                        "    SELECT 1 FROM unnest(string_to_array(ssigm.comma_separated_org_roles, ',')) AS role " +
                        "    WHERE trim(role) = ANY(string_to_array(?" + (paramOffset + 1) + ", ','))" +
                        "  ) " +
                        "UNION " +
                        "SELECT DISTINCT fspm.user_id FROM faculty_subject_package_session_mapping fspm " +
                        "WHERE fspm.package_session_id = ?" + paramOffset + " AND fspm.status = 'ACTIVE' " +
                        "  AND fspm.user_id IS NOT NULL";
                QueryWithParams q = new QueryWithParams(sql);
                q.params.add(packageSessionId);
                q.params.add(orgRoles);
                return narrowByFilters(q, filters, paramOffset + q.params.size());
            }

            case "TAG": {
                QueryWithParams q = new QueryWithParams(
                        "SELECT DISTINCT utg.user_id FROM user_tags utg " +
                        "WHERE utg.tag_id = ?" + paramOffset + " AND utg.status = 'ACTIVE'");
                q.params.add(recipientId);
                return narrowByFilters(q, filters, paramOffset + q.params.size());
            }

            case "CUSTOM_FIELD_FILTER": {
                // Standalone — the entire population is "users in this institute matching the filters".
                // Use institute_custom_fields as the scoping point (same shape as CustomFieldFilterService).
                if (filters == null || filters.isEmpty()) {
                    log.warn("CUSTOM_FIELD_FILTER recipient {} has no filters", recipientId);
                    return null;
                }
                return customFieldFilterQuery(instituteId, filters, paramOffset);
            }

            case "AUDIENCE": {
                // audience_status = 'ACTIVE' is hardcoded, not a filter option: this resolver
                // decides who RECEIVES an announcement, and a soft-deleted lead must never be
                // a recipient.
                QueryWithParams q = new QueryWithParams(
                        "SELECT DISTINCT ar.user_id FROM audience_response ar " +
                        "WHERE ar.audience_id = ?" + paramOffset + " AND ar.user_id IS NOT NULL " +
                        "AND ar.audience_status = 'ACTIVE'");
                q.params.add(recipientId);
                return narrowByFilters(q, filters, paramOffset + q.params.size());
            }

            case "ROLE":
                // ROLE lives in auth_service and notification_service pre-resolves it into USER
                // recipients before calling this endpoint. If a ROLE row still arrives here, it
                // means upstream pre-resolution failed — log and skip rather than execute a
                // query against a table that doesn't exist in this DB.
                log.warn("ROLE recipient {} reached centralized resolver — should have been pre-resolved by notification_service. Skipping.", recipientId);
                return null;

            default:
                log.warn("Unknown recipient type: {}", recipientType);
                return null;
        }
    }

    /** PACKAGE_SESSION = students UNION faculty for the given package_session_id. */
    private QueryWithParams packageSessionUnion(String packageSessionId, int paramOffset) {
        String sql =
                "SELECT DISTINCT ssigm.user_id FROM student_session_institute_group_mapping ssigm " +
                "WHERE ssigm.package_session_id = ?" + paramOffset + " AND ssigm.status = 'ACTIVE' " +
                "  AND ssigm.user_id IS NOT NULL " +
                "UNION " +
                "SELECT DISTINCT fspm.user_id FROM faculty_subject_package_session_mapping fspm " +
                "WHERE fspm.package_session_id = ?" + paramOffset + " AND fspm.status = 'ACTIVE' " +
                "  AND fspm.user_id IS NOT NULL";
        QueryWithParams q = new QueryWithParams(sql);
        // Same param used twice in SQL → only bind once
        q.params.add(packageSessionId);
        return q;
    }

    /**
     * Narrow an arbitrary "user_id-producing" query by intersecting with users whose
     * custom_field_values match every supplied filter. No-op if filters is null/empty.
     */
    private QueryWithParams narrowByFilters(
            QueryWithParams base,
            List<CentralizedRecipientResolutionRequest.RecipientWithExclusions.CustomFieldFilter> filters,
            int paramOffset) {
        if (filters == null || filters.isEmpty()) return base;

        // Build the filter-matching subquery. INTERSECT each filter so all must match.
        List<String> filterSubqueries = new ArrayList<>();
        for (CentralizedRecipientResolutionRequest.RecipientWithExclusions.CustomFieldFilter f : filters) {
            QueryWithParams sub = singleFilterSubquery(null /* institute scoping is on the base side */, f, paramOffset);
            if (sub == null) continue;
            filterSubqueries.add(sub.sql);
            base.params.addAll(sub.params);
            paramOffset += sub.params.size();
        }
        if (filterSubqueries.isEmpty()) return base;

        String intersected = filterSubqueries.size() == 1
                ? filterSubqueries.get(0)
                : "(" + String.join(") INTERSECT (", filterSubqueries) + ")";

        base.sql = "SELECT user_id FROM (" + base.sql + ") b WHERE user_id IN (" + intersected + ")";
        return base;
    }

    /**
     * Standalone CUSTOM_FIELD_FILTER recipient — every active user in the institute whose
     * custom_field_values match every supplied filter.
     */
    private QueryWithParams customFieldFilterQuery(
            String instituteId,
            List<CentralizedRecipientResolutionRequest.RecipientWithExclusions.CustomFieldFilter> filters,
            int paramOffset) {

        List<String> subQueries = new ArrayList<>();
        QueryWithParams combined = new QueryWithParams(null);

        for (CentralizedRecipientResolutionRequest.RecipientWithExclusions.CustomFieldFilter f : filters) {
            QueryWithParams sub = singleFilterSubquery(instituteId, f, paramOffset);
            if (sub == null) continue;
            subQueries.add(sub.sql);
            combined.params.addAll(sub.params);
            paramOffset += sub.params.size();
        }

        if (subQueries.isEmpty()) {
            log.warn("CUSTOM_FIELD_FILTER has no resolvable filters");
            return null;
        }

        // Wrap so the outer alias is `user_id` regardless of column-name in inner SELECTs.
        if (subQueries.size() == 1) {
            combined.sql = "SELECT DISTINCT user_id FROM (" + subQueries.get(0) + ") cff";
        } else {
            combined.sql = "SELECT DISTINCT user_id FROM ((" +
                    String.join(") INTERSECT (", subQueries) +
                    ")) cff";
        }
        return combined;
    }

    /**
     * Build a single-filter subquery returning `user_id`. If instituteId is non-null we
     * scope via institute_custom_fields (standalone CUSTOM_FIELD_FILTER); otherwise we
     * scope only by the filter's customFieldId/fieldName (narrowing an existing population).
     */
    private QueryWithParams singleFilterSubquery(
            String instituteId,
            CentralizedRecipientResolutionRequest.RecipientWithExclusions.CustomFieldFilter f,
            int paramOffset) {

        if (f == null || f.getFieldValue() == null) return null;

        String operator = f.getOperator() != null ? f.getOperator().toLowerCase() : "equals";

        StringBuilder sql = new StringBuilder();
        QueryWithParams q = new QueryWithParams(null);

        if (instituteId != null) {
            sql.append("SELECT cfv.source_id AS user_id ")
               .append("FROM custom_field_values cfv ")
               .append("JOIN institute_custom_fields icf ON icf.custom_field_id = cfv.custom_field_id ")
               .append("WHERE icf.institute_id = ?").append(paramOffset).append(" ")
               .append("  AND UPPER(TRIM(icf.status)) = 'ACTIVE' ")
               .append("  AND cfv.source_type = 'USER' ");
            q.params.add(instituteId);
            paramOffset++;
        } else {
            sql.append("SELECT cfv.source_id AS user_id ")
               .append("FROM custom_field_values cfv ")
               .append("WHERE cfv.source_type = 'USER' ");
        }

        if (f.getCustomFieldId() != null && !f.getCustomFieldId().isBlank()) {
            sql.append("AND cfv.custom_field_id = ?").append(paramOffset).append(" ");
            q.params.add(f.getCustomFieldId());
            paramOffset++;
        } else if (f.getFieldName() != null && !f.getFieldName().isBlank()) {
            sql.append("AND EXISTS (")
               .append("  SELECT 1 FROM custom_fields cf ")
               .append("  WHERE cf.id = cfv.custom_field_id AND LOWER(cf.field_name) = LOWER(?")
               .append(paramOffset).append(")")
               .append(") ");
            q.params.add(f.getFieldName());
            paramOffset++;
        } else {
            log.warn("Custom field filter missing both customFieldId and fieldName");
            return null;
        }

        switch (operator) {
            case "contains":
                sql.append("AND cfv.value LIKE ('%' || ?").append(paramOffset).append(" || '%')");
                break;
            case "not_contains":
                sql.append("AND cfv.value NOT LIKE ('%' || ?").append(paramOffset).append(" || '%')");
                break;
            case "startswith":
            case "starts_with":
                sql.append("AND cfv.value LIKE (?").append(paramOffset).append(" || '%')");
                break;
            case "endswith":
            case "ends_with":
                sql.append("AND cfv.value LIKE ('%' || ?").append(paramOffset).append(")");
                break;
            case "not_equals":
                sql.append("AND LOWER(cfv.value) <> LOWER(?").append(paramOffset).append(")");
                break;
            case "equals":
            default:
                sql.append("AND LOWER(cfv.value) = LOWER(?").append(paramOffset).append(")");
                break;
        }
        q.params.add(f.getFieldValue());

        q.sql = sql.toString();
        return q;
    }

    private static void applyParams(Query q, List<Object> params) {
        for (int i = 0; i < params.size(); i++) {
            q.setParameter(i + 1, params.get(i));
        }
    }
}
