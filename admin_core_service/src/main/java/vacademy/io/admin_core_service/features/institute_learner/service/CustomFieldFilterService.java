package vacademy.io.admin_core_service.features.institute_learner.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.institute_learner.dto.CustomFieldFilterRequest;
import vacademy.io.admin_core_service.features.institute_learner.dto.PaginatedUserIdResponse;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class CustomFieldFilterService {

    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Get user IDs by custom field filters with pagination
     * This method supports multiple filters and is scalable for large datasets (0.15M+ users)
     */
    public PaginatedUserIdResponse getUserIdsByCustomFieldFilters(
            String instituteId,
            List<CustomFieldFilterRequest.CustomFieldFilter> filters,
            List<String> statuses,
            int pageNumber,
            int pageSize) {

        if (filters == null || filters.isEmpty()) {
            return new PaginatedUserIdResponse(
                    new ArrayList<>(),
                    pageNumber,
                    pageSize,
                    0,
                    0,
                    false,
                    false
            );
        }

        // Build dynamic query for custom field filters
        // Query structure:
        // For single filter: Direct query from custom_field_values
        // For multiple filters: Use INTERSECT or EXISTS to ensure all filters match
        
        StringBuilder queryBuilder = new StringBuilder();
        
        if (filters.size() == 1) {
            // Single filter - simpler direct query
            CustomFieldFilterRequest.CustomFieldFilter filter = filters.get(0);
            String operator = filter.getOperator() != null ? filter.getOperator().toLowerCase() : "equals";
            
            queryBuilder.append("""
                SELECT DISTINCT cfv.source_id as user_id
                FROM custom_field_values cfv
                JOIN institute_custom_fields icf ON icf.custom_field_id = cfv.custom_field_id
                WHERE icf.institute_id = :instituteId
                    AND UPPER(TRIM(icf.status)) = 'ACTIVE'
                    AND cfv.source_type = 'USER'
                """);
            
            if (filter.getCustomFieldId() != null && !filter.getCustomFieldId().isBlank()) {
                queryBuilder.append(" AND icf.custom_field_id = :filter0CustomFieldId");
            } else if (filter.getFieldName() != null && !filter.getFieldName().isBlank()) {
                queryBuilder.append("""
                    AND EXISTS (
                        SELECT 1 FROM custom_fields cf 
                        WHERE cf.id = cfv.custom_field_id 
                        AND LOWER(cf.field_name) = LOWER(:filter0FieldName)
                    )""");
            }
            
            // Add value condition
            switch (operator) {
                case "contains":
                    queryBuilder.append(" AND cfv.value LIKE ('%' || :filter0FieldValue || '%')");
                    break;
                case "startswith":
                    queryBuilder.append(" AND cfv.value LIKE (:filter0FieldValue || '%')");
                    break;
                case "endswith":
                    queryBuilder.append(" AND cfv.value LIKE ('%' || :filter0FieldValue)");
                    break;
                case "equals":
                default:
                    queryBuilder.append(" AND LOWER(cfv.value) = LOWER(:filter0FieldValue)");
                    break;
            }
        } else {
            // Multiple filters - use INTERSECT approach
            List<String> subQueries = new ArrayList<>();
            
            for (int i = 0; i < filters.size(); i++) {
                CustomFieldFilterRequest.CustomFieldFilter filter = filters.get(i);
                String paramPrefix = "filter" + i;
                String operator = filter.getOperator() != null ? filter.getOperator().toLowerCase() : "equals";
                
                StringBuilder subQuery = new StringBuilder();
                subQuery.append("""
                    SELECT cfv.source_id
                    FROM custom_field_values cfv
                    JOIN institute_custom_fields icf ON icf.custom_field_id = cfv.custom_field_id
                    WHERE icf.institute_id = :instituteId
                        AND UPPER(TRIM(icf.status)) = 'ACTIVE'
                        AND cfv.source_type = 'USER'
                    """);
                
                if (filter.getCustomFieldId() != null && !filter.getCustomFieldId().isBlank()) {
                    subQuery.append(" AND icf.custom_field_id = :").append(paramPrefix).append("CustomFieldId");
                } else if (filter.getFieldName() != null && !filter.getFieldName().isBlank()) {
                    subQuery.append("""
                        AND EXISTS (
                            SELECT 1 FROM custom_fields cf 
                            WHERE cf.id = cfv.custom_field_id 
                            AND LOWER(cf.field_name) = LOWER(:""");
                    subQuery.append(paramPrefix).append("FieldName)");
                } else {
                    log.warn("Filter {} has neither customFieldId nor fieldName, skipping", i);
                    continue;
                }
                
                // Add value condition
                switch (operator) {
                    case "contains":
                        subQuery.append(" AND cfv.value LIKE ('%' || :").append(paramPrefix).append("FieldValue || '%')");
                        break;
                    case "startswith":
                        subQuery.append(" AND cfv.value LIKE (:").append(paramPrefix).append("FieldValue || '%')");
                        break;
                    case "endswith":
                        subQuery.append(" AND cfv.value LIKE ('%' || :").append(paramPrefix).append("FieldValue)");
                        break;
                    case "equals":
                    default:
                        subQuery.append(" AND LOWER(cfv.value) = LOWER(:").append(paramPrefix).append("FieldValue)");
                        break;
                }
                
                subQueries.add(subQuery.toString());
            }
            
            // Combine subqueries with INTERSECT
            queryBuilder.append("SELECT DISTINCT source_id as user_id FROM (");
            for (int i = 0; i < subQueries.size(); i++) {
                if (i > 0) {
                    queryBuilder.append(" INTERSECT ");
                }
                queryBuilder.append("(").append(subQueries.get(i)).append(")");
            }
            queryBuilder.append(") combined");
        }

        // Optional: Add status filter if provided (requires joining with student_session_institute_group_mapping)
        if (statuses != null && !statuses.isEmpty()) {
            if (filters.size() == 1) {
                queryBuilder.append("""
                     AND EXISTS (
                         SELECT 1
                         FROM student_session_institute_group_mapping ssigm
                         WHERE ssigm.user_id = cfv.source_id
                             AND ssigm.institute_id = :instituteId
                             AND ssigm.status IN (:statuses)
                     )
                    """);
            } else {
                queryBuilder.append("""
                     AND EXISTS (
                         SELECT 1
                         FROM student_session_institute_group_mapping ssigm
                         WHERE ssigm.user_id = combined.source_id
                             AND ssigm.institute_id = :instituteId
                             AND ssigm.status IN (:statuses)
                     )
                    """);
            }
        }

        // Create count query (same structure as data query)
        StringBuilder countQueryBuilder = new StringBuilder();
        
        if (filters.size() == 1) {
            CustomFieldFilterRequest.CustomFieldFilter filter = filters.get(0);
            String operator = filter.getOperator() != null ? filter.getOperator().toLowerCase() : "equals";
            
            countQueryBuilder.append("""
                SELECT COUNT(DISTINCT cfv.source_id)
                FROM custom_field_values cfv
                JOIN institute_custom_fields icf ON icf.custom_field_id = cfv.custom_field_id
                WHERE icf.institute_id = :instituteId
                    AND UPPER(TRIM(icf.status)) = 'ACTIVE'
                    AND cfv.source_type = 'USER'
                """);
            
            if (filter.getCustomFieldId() != null && !filter.getCustomFieldId().isBlank()) {
                countQueryBuilder.append(" AND icf.custom_field_id = :filter0CustomFieldId");
            } else if (filter.getFieldName() != null && !filter.getFieldName().isBlank()) {
                countQueryBuilder.append("""
                    AND EXISTS (
                        SELECT 1 FROM custom_fields cf 
                        WHERE cf.id = cfv.custom_field_id 
                        AND LOWER(cf.field_name) = LOWER(:filter0FieldName)
                    )""");
            }
            
            switch (operator) {
                case "contains":
                    countQueryBuilder.append(" AND cfv.value LIKE ('%' || :filter0FieldValue || '%')");
                    break;
                case "startswith":
                    countQueryBuilder.append(" AND cfv.value LIKE (:filter0FieldValue || '%')");
                    break;
                case "endswith":
                    countQueryBuilder.append(" AND cfv.value LIKE ('%' || :filter0FieldValue)");
                    break;
                case "equals":
                default:
                    countQueryBuilder.append(" AND LOWER(cfv.value) = LOWER(:filter0FieldValue)");
                    break;
            }
        } else {
            // Multiple filters - same INTERSECT approach
            List<String> subQueries = new ArrayList<>();
            
            for (int i = 0; i < filters.size(); i++) {
                CustomFieldFilterRequest.CustomFieldFilter filter = filters.get(i);
                String paramPrefix = "filter" + i;
                String operator = filter.getOperator() != null ? filter.getOperator().toLowerCase() : "equals";
                
                StringBuilder subQuery = new StringBuilder();
                subQuery.append("""
                    SELECT cfv.source_id
                    FROM custom_field_values cfv
                    JOIN institute_custom_fields icf ON icf.custom_field_id = cfv.custom_field_id
                    WHERE icf.institute_id = :instituteId
                        AND UPPER(TRIM(icf.status)) = 'ACTIVE'
                        AND cfv.source_type = 'USER'
                    """);
                
                if (filter.getCustomFieldId() != null && !filter.getCustomFieldId().isBlank()) {
                    subQuery.append(" AND icf.custom_field_id = :").append(paramPrefix).append("CustomFieldId");
                } else if (filter.getFieldName() != null && !filter.getFieldName().isBlank()) {
                    subQuery.append("""
                        AND EXISTS (
                            SELECT 1 FROM custom_fields cf 
                            WHERE cf.id = cfv.custom_field_id 
                            AND LOWER(cf.field_name) = LOWER(:""");
                    subQuery.append(paramPrefix).append("FieldName)");
                } else {
                    continue;
                }
                
                switch (operator) {
                    case "contains":
                        subQuery.append(" AND cfv.value LIKE ('%' || :").append(paramPrefix).append("FieldValue || '%')");
                        break;
                    case "startswith":
                        subQuery.append(" AND cfv.value LIKE (:").append(paramPrefix).append("FieldValue || '%')");
                        break;
                    case "endswith":
                        subQuery.append(" AND cfv.value LIKE ('%' || :").append(paramPrefix).append("FieldValue)");
                        break;
                    case "equals":
                    default:
                        subQuery.append(" AND LOWER(cfv.value) = LOWER(:").append(paramPrefix).append("FieldValue)");
                        break;
                }
                
                subQueries.add(subQuery.toString());
            }
            
            countQueryBuilder.append("SELECT COUNT(DISTINCT source_id) FROM (");
            for (int i = 0; i < subQueries.size(); i++) {
                if (i > 0) {
                    countQueryBuilder.append(" INTERSECT ");
                }
                countQueryBuilder.append("(").append(subQueries.get(i)).append(")");
            }
            countQueryBuilder.append(") combined");
        }
        
        if (statuses != null && !statuses.isEmpty()) {
            if (filters.size() == 1) {
                countQueryBuilder.append("""
                     AND EXISTS (
                         SELECT 1
                         FROM student_session_institute_group_mapping ssigm
                         WHERE ssigm.user_id = cfv.source_id
                             AND ssigm.institute_id = :instituteId
                             AND ssigm.status IN (:statuses)
                     )
                    """);
            } else {
                countQueryBuilder.append("""
                     AND EXISTS (
                         SELECT 1
                         FROM student_session_institute_group_mapping ssigm
                         WHERE ssigm.user_id = combined.source_id
                             AND ssigm.institute_id = :instituteId
                             AND ssigm.status IN (:statuses)
                     )
                    """);
            }
        }

        try {
            // Log filter details for debugging
            log.info("🔍 Executing custom field filter query for institute: {}", instituteId);
            for (int i = 0; i < filters.size(); i++) {
                CustomFieldFilterRequest.CustomFieldFilter filter = filters.get(i);
                if (filter.getCustomFieldId() != null && !filter.getCustomFieldId().isBlank()) {
                    log.info("🔍 Filter {}: customFieldId='{}', fieldValue='{}', operator='{}'", 
                            i, filter.getCustomFieldId(), filter.getFieldValue(), 
                            filter.getOperator() != null ? filter.getOperator() : "equals");
                } else {
                    log.info("🔍 Filter {}: fieldName='{}', fieldValue='{}', operator='{}'", 
                            i, filter.getFieldName(), filter.getFieldValue(), 
                            filter.getOperator() != null ? filter.getOperator() : "equals");
                }
            }
            if (statuses != null && !statuses.isEmpty()) {
                log.info("🔍 Status filter: {}", statuses);
            } else {
                log.info("🔍 No status filter applied");
            }
            
            // Execute count query
            Query countQuery = entityManager.createNativeQuery(countQueryBuilder.toString());
            countQuery.setParameter("instituteId", instituteId);
            if (statuses != null && !statuses.isEmpty()) {
                countQuery.setParameter("statuses", statuses);
            }
            
            for (int i = 0; i < filters.size(); i++) {
                CustomFieldFilterRequest.CustomFieldFilter filter = filters.get(i);
                String paramPrefix = "filter" + i;
                String fieldValue = filter.getFieldValue();
                countQuery.setParameter(paramPrefix + "FieldValue", fieldValue);
                
                if (filter.getCustomFieldId() != null && !filter.getCustomFieldId().isBlank()) {
                    countQuery.setParameter(paramPrefix + "CustomFieldId", filter.getCustomFieldId());
                    log.info("🔍 Set query parameter: {}CustomFieldId='{}', {}FieldValue='{}'", 
                            paramPrefix, filter.getCustomFieldId(), paramPrefix, fieldValue);
                } else if (filter.getFieldName() != null && !filter.getFieldName().isBlank()) {
                    countQuery.setParameter(paramPrefix + "FieldName", filter.getFieldName());
                    log.info("🔍 Set query parameter: {}FieldName='{}', {}FieldValue='{}'", 
                            paramPrefix, filter.getFieldName(), paramPrefix, fieldValue);
                }
            }
            
            long totalElements = ((Number) countQuery.getSingleResult()).longValue();
            int totalPages = (int) Math.ceil((double) totalElements / pageSize);
            
            log.info("✅ Query executed: found {} total users matching filters for institute {}", totalElements, instituteId);
            
            // Execute data query with pagination
            Query dataQuery = entityManager.createNativeQuery(queryBuilder.toString());
            dataQuery.setParameter("instituteId", instituteId);
            if (statuses != null && !statuses.isEmpty()) {
                dataQuery.setParameter("statuses", statuses);
            }
            
            for (int i = 0; i < filters.size(); i++) {
                CustomFieldFilterRequest.CustomFieldFilter filter = filters.get(i);
                String paramPrefix = "filter" + i;
                dataQuery.setParameter(paramPrefix + "FieldValue", filter.getFieldValue());
                
                if (filter.getCustomFieldId() != null && !filter.getCustomFieldId().isBlank()) {
                    dataQuery.setParameter(paramPrefix + "CustomFieldId", filter.getCustomFieldId());
                } else if (filter.getFieldName() != null && !filter.getFieldName().isBlank()) {
                    dataQuery.setParameter(paramPrefix + "FieldName", filter.getFieldName());
                }
            }
            
            // Apply pagination
            dataQuery.setFirstResult(pageNumber * pageSize);
            dataQuery.setMaxResults(pageSize);
            
            @SuppressWarnings("unchecked")
            List<Object> rawResults = dataQuery.getResultList();
            // Convert results to List<String> - PostgreSQL may return different types
            List<String> userIds = rawResults.stream()
                    .map(obj -> obj != null ? obj.toString() : null)
                    .filter(userId -> userId != null)
                    .distinct()
                    .collect(Collectors.toList());
            
            boolean hasNext = pageNumber < totalPages - 1;
            boolean hasPrevious = pageNumber > 0;
            
            log.info("Found {} users for institute {} with {} filters (page {} of {})", 
                    userIds.size(), instituteId, filters.size(), pageNumber + 1, totalPages);
            
            return new PaginatedUserIdResponse(
                    userIds,
                    pageNumber,
                    pageSize,
                    totalElements,
                    totalPages,
                    hasNext,
                    hasPrevious
            );
            
        } catch (Exception e) {
            log.error("Error querying users by custom field filters for institute {}", instituteId, e);
            return new PaginatedUserIdResponse(
                    new ArrayList<>(),
                    pageNumber,
                    pageSize,
                    0,
                    0,
                    false,
                    false
            );
        }
    }
}

