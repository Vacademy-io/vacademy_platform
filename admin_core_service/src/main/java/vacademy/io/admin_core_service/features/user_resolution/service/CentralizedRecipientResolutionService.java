package vacademy.io.admin_core_service.features.user_resolution.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
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
     * Resolve recipients with inclusions, exclusions, and custom field filters
     * Returns paginated results with all recipient types handled in one query
     */
    @Transactional(readOnly = true)
    public PaginatedUserIdResponse resolveRecipients(CentralizedRecipientResolutionRequest request) {
        log.info("Starting centralized recipient resolution for institute: {} with {} recipients",
                request.getInstituteId(), request.getRecipients().size());

        // Debug: Log all recipients and their exclusions
        for (CentralizedRecipientResolutionRequest.RecipientWithExclusions recipient : request.getRecipients()) {
            log.info("Recipient: type={}, id={}, exclusions={}",
                    recipient.getRecipientType(), recipient.getRecipientId(),
                    recipient.getExclusions() != null ? recipient.getExclusions().size() : 0);
            if (recipient.getExclusions() != null) {
                for (var exclusion : recipient.getExclusions()) {
                    log.info("  Exclusion: type={}, id={}", exclusion.getExclusionType(), exclusion.getExclusionId());
                }
            }
        }

        try {
            // Build the main query with UNION of all recipient fragments
            String mainQuery = buildMainQuery(request);
            String countQuery = buildCountQuery(request);

            // Execute count query first
            Query countJpaQuery = entityManager.createNativeQuery(countQuery);
            setQueryParameters(countJpaQuery, request, true);
            long totalElements = ((Number) countJpaQuery.getSingleResult()).longValue();

            // Calculate pagination
            int totalPages = (int) Math.ceil((double) totalElements / request.getPageSize());
            Pageable pageable = PageRequest.of(request.getPageNumber(), request.getPageSize());

            // Execute main query with pagination
            Query mainJpaQuery = entityManager.createNativeQuery(mainQuery);
            setQueryParameters(mainJpaQuery, request, false);
            mainJpaQuery.setFirstResult((int) pageable.getOffset());
            mainJpaQuery.setMaxResults(pageable.getPageSize());

            @SuppressWarnings("unchecked")
            List<String> userIds = mainJpaQuery.getResultList();

            // Build response
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

            log.info("Centralized recipient resolution completed: {} users (page {}/{}, total: {})",
                    userIds.size(), request.getPageNumber() + 1, totalPages, totalElements);

            return response;

        } catch (Exception e) {
            log.error("Error in centralized recipient resolution for institute: {}", request.getInstituteId(), e);
            // Return empty response on error
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

    /**
     * Build the main UNION query for all recipients
     */
    private String buildMainQuery(CentralizedRecipientResolutionRequest request) {
        List<String> unionFragments = new ArrayList<>();

        for (CentralizedRecipientResolutionRequest.RecipientWithExclusions recipient : request.getRecipients()) {
            String fragment = buildRecipientFragment(recipient, request.getInstituteId());
            if (fragment != null && !fragment.isEmpty()) {
                unionFragments.add(fragment);
            }
        }

        if (unionFragments.isEmpty()) {
            return "SELECT NULL as user_id WHERE FALSE"; // Return empty result if no valid recipients
        }

        return String.join(" UNION ALL ", unionFragments) +
               " ORDER BY user_id";
    }

    /**
     * Build the count query for pagination
     */
    private String buildCountQuery(CentralizedRecipientResolutionRequest request) {
        List<String> unionFragments = new ArrayList<>();

        for (CentralizedRecipientResolutionRequest.RecipientWithExclusions recipient : request.getRecipients()) {
            String fragment = buildRecipientFragment(recipient, request.getInstituteId());
            if (fragment != null && !fragment.isEmpty()) {
                unionFragments.add(fragment);
            }
        }

        if (unionFragments.isEmpty()) {
            return "SELECT 0 as count"; // Return 0 if no valid recipients
        }

        return "SELECT COUNT(DISTINCT user_id) FROM (" +
               String.join(" UNION ALL ", unionFragments) +
               ") as combined_recipients";
    }

    /**
     * Build query fragment for a single recipient with exclusions
     */
    private String buildRecipientFragment(CentralizedRecipientResolutionRequest.RecipientWithExclusions recipient, String instituteId) {
        String baseQuery = buildBaseRecipientQuery(recipient.getRecipientType(), recipient.getRecipientId(), instituteId);

        if (baseQuery == null) {
            return null;
        }

        // Apply custom field filters first (before exclusions)
        if (recipient.getCustomFieldFilters() != null && !recipient.getCustomFieldFilters().isEmpty()) {
            baseQuery = applyCustomFieldFilters(baseQuery, recipient.getCustomFieldFilters());
        }

        // Apply exclusions (with their own custom field filters)
        if (recipient.getExclusions() != null && !recipient.getExclusions().isEmpty()) {
            baseQuery = applyExclusions(baseQuery, recipient.getExclusions());
        }

        return baseQuery;
    }

    /**
     * Build base query for different recipient types
     */
    private String buildBaseRecipientQuery(String recipientType, String recipientId, String instituteId) {
        switch (recipientType.toUpperCase()) {
            case "USER":
                return "SELECT '" + recipientId.replace("'", "''") + "' as user_id";

            case "ROLE":
                return "SELECT DISTINCT ur.user_id FROM user_roles ur WHERE ur.role_name = '" + recipientId.replace("'", "''") +
                       "' AND ur.institute_id = '" + instituteId.replace("'", "''") + "' AND ur.status = 'ACTIVE'";

            case "PACKAGE_SESSION":
                return "SELECT DISTINCT ssigm.user_id FROM student_session_institute_group_mapping ssigm " +
                       "WHERE ssigm.package_session_id = '" + recipientId.replace("'", "''") + "' AND ssigm.status = 'ACTIVE'";

            case "PACKAGE_SESSION_COMMA_SEPARATED_ORG_ROLES":
                String[] parts = recipientId.split(":");
                if (parts.length != 2) return null;
                String packageSessionId = parts[0];
                String orgRoles = parts[1];

                return "SELECT DISTINCT ssigm.user_id FROM student_session_institute_group_mapping ssigm " +
                       "WHERE ssigm.package_session_id = '" + packageSessionId.replace("'", "''") + "' AND ssigm.status = 'ACTIVE' " +
                       "AND ssigm.comma_separated_org_roles IS NOT NULL " +
                       "AND EXISTS (SELECT 1 FROM unnest(string_to_array(ssigm.comma_separated_org_roles, ',')) AS role " +
                       "WHERE trim(role) = ANY(string_to_array('" + orgRoles.replace("'", "''") + "', ',')))";

            case "TAG":
                return "SELECT DISTINCT utm.user_id FROM user_tag_mappings utm " +
                       "WHERE utm.tag_id = '" + recipientId.replace("'", "''") + "' AND utm.status = 'ACTIVE'";

            case "CUSTOM_FIELD_FILTER":
                // For standalone custom field filters, we need to get users who match the filters
                // This is complex and would require dynamic query building
                log.warn("Standalone CUSTOM_FIELD_FILTER not fully implemented yet");
                return null;

            case "AUDIENCE":
                return "SELECT DISTINCT ar.user_id FROM audience_responses ar " +
                       "WHERE ar.audience_id = '" + recipientId.replace("'", "''") + "' AND ar.user_id IS NOT NULL";

            default:
                log.warn("Unknown recipient type: {}", recipientType);
                return null;
        }
    }

    /**
     * Apply custom field filters to a base query
     */
    private String applyCustomFieldFilters(String baseQuery, List<CentralizedRecipientResolutionRequest.RecipientWithExclusions.CustomFieldFilter> filters) {
        if (filters == null || filters.isEmpty()) {
            return baseQuery;
        }

        StringBuilder query = new StringBuilder("SELECT DISTINCT cf.user_id FROM (");
        query.append(baseQuery).append(") as base_query ");
        query.append("INNER JOIN custom_fields cf ON base_query.user_id = cf.user_id ");
        query.append("WHERE cf.status = 'ACTIVE' ");

        List<String> conditions = new ArrayList<>();
        for (CentralizedRecipientResolutionRequest.RecipientWithExclusions.CustomFieldFilter filter : filters) {
            String condition = buildCustomFieldCondition(filter);
            if (condition != null) {
                conditions.add(condition);
            }
        }

        if (!conditions.isEmpty()) {
            query.append(" AND (").append(String.join(" AND ", conditions)).append(")");
        }

        return query.toString();
    }

    /**
     * Apply exclusions to a base query
     */
    private String applyExclusions(String baseQuery, List<CentralizedRecipientResolutionRequest.RecipientWithExclusions.Exclusion> exclusions) {
        if (exclusions == null || exclusions.isEmpty()) {
            log.debug("No exclusions to apply");
            return baseQuery;
        }

        log.info("Applying {} exclusions to base query", exclusions.size());

        // For simple base queries, we can use NOT IN
        // For complex queries with subqueries, we need a different approach
        if (baseQuery.contains("SELECT DISTINCT") && !baseQuery.contains("(")) {
            // Simple query like "SELECT DISTINCT user_id FROM table WHERE ..."
            List<String> exclusionQueries = new ArrayList<>();
            for (CentralizedRecipientResolutionRequest.RecipientWithExclusions.Exclusion exclusion : exclusions) {
                String exclusionQuery = buildExclusionQuery(exclusion);
                log.debug("Built exclusion query: {}", exclusionQuery);
                if (exclusionQuery != null) {
                    exclusionQueries.add(exclusionQuery);
                }
            }

            if (!exclusionQueries.isEmpty()) {
                String exclusionUnion = String.join(" UNION ", exclusionQueries);
                return baseQuery + " AND user_id NOT IN (" + exclusionUnion + ")";
            }
        } else {
            // Complex query with subqueries - use LEFT JOIN approach
            log.debug("Using LEFT JOIN approach for complex query");
            List<String> exclusionConditions = new ArrayList<>();
            for (CentralizedRecipientResolutionRequest.RecipientWithExclusions.Exclusion exclusion : exclusions) {
                String exclusionQuery = buildExclusionQuery(exclusion);
                if (exclusionQuery != null) {
                    exclusionConditions.add("SELECT user_id FROM (" + exclusionQuery + ") as excl_sub");
                }
            }

            if (!exclusionConditions.isEmpty()) {
                String exclusionUnion = String.join(" UNION ", exclusionConditions);
                return "SELECT DISTINCT base_query.user_id FROM (" + baseQuery + ") as base_query " +
                       "LEFT JOIN (" + exclusionUnion + ") as exclusions ON base_query.user_id = exclusions.user_id " +
                       "WHERE exclusions.user_id IS NULL";
            }
        }

        return baseQuery;
    }

    /**
     * Build query for exclusion logic
     */
    private String buildExclusionQuery(CentralizedRecipientResolutionRequest.RecipientWithExclusions.Exclusion exclusion) {
        String baseExclusionQuery = buildBaseRecipientQuery(exclusion.getExclusionType(), exclusion.getExclusionId(), null);

        if (baseExclusionQuery == null) {
            return null;
        }

        // Apply custom field filters to exclusion if present
        if (exclusion.getCustomFieldFilters() != null && !exclusion.getCustomFieldFilters().isEmpty()) {
            baseExclusionQuery = applyCustomFieldFilters(baseExclusionQuery, exclusion.getCustomFieldFilters());
        }

        return baseExclusionQuery;
    }

    /**
     * Build condition for custom field filter
     */
    private String buildCustomFieldCondition(CentralizedRecipientResolutionRequest.RecipientWithExclusions.CustomFieldFilter filter) {
        String customFieldId = filter.getCustomFieldId();
        String fieldName = filter.getFieldName();
        String fieldValue = filter.getFieldValue();
        String operator = filter.getOperator() != null ? filter.getOperator().toLowerCase() : "equals";

        if (fieldValue == null) {
            return null;
        }

        // Use customFieldId if available (preferred), otherwise use fieldName
        String fieldCondition;
        String escapedFieldValue = fieldValue.replace("'", "''");

        if (customFieldId != null && !customFieldId.trim().isEmpty()) {
            // Use custom field ID for more precise filtering
            String escapedCustomFieldId = customFieldId.replace("'", "''");
            fieldCondition = "cf.custom_field_id = '" + escapedCustomFieldId + "'";
        } else if (fieldName != null && !fieldName.trim().isEmpty()) {
            // Fallback to field name
            String escapedFieldName = fieldName.replace("'", "''");
            fieldCondition = "cf.field_name = '" + escapedFieldName + "'";
        } else {
            log.warn("Custom field filter missing both customFieldId and fieldName");
            return null;
        }

        switch (operator) {
            case "equals":
                return fieldCondition + " AND cf.field_value = '" + escapedFieldValue + "'";
            case "not_equals":
                return fieldCondition + " AND cf.field_value != '" + escapedFieldValue + "'";
            case "contains":
                return fieldCondition + " AND cf.field_value LIKE '%" + escapedFieldValue + "%'";
            case "not_contains":
                return fieldCondition + " AND cf.field_value NOT LIKE '%" + escapedFieldValue + "%'";
            case "startswith":
                return fieldCondition + " AND cf.field_value LIKE '" + escapedFieldValue + "%'";
            case "endswith":
                return fieldCondition + " AND cf.field_value LIKE '%" + escapedFieldValue + "'";
            default:
                log.warn("Unknown custom field operator: {}, defaulting to equals", operator);
                return fieldCondition + " AND cf.field_value = '" + escapedFieldValue + "'";
        }
    }

    /**
     * Set query parameters for the JPA queries
     */
    private void setQueryParameters(Query query, CentralizedRecipientResolutionRequest request, boolean isCountQuery) {
        // For now, we embed parameters directly in the query string to avoid complexity
        // In production, you might want to use proper parameter binding for security

        if (!isCountQuery) {
            // No additional parameters needed for main query since we use setFirstResult/setMaxResults
        }
    }
}