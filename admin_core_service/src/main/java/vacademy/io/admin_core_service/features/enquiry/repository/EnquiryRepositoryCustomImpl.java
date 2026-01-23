package vacademy.io.admin_core_service.features.enquiry.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.enquiry.entity.Enquiry;

import java.sql.Timestamp;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Custom repository implementation for complex enquiry queries
 */
@Repository
public class EnquiryRepositoryCustomImpl implements EnquiryRepositoryCustom {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public Page<Enquiry> findEnquiriesWithFilters(
            String audienceId,
            String instituteId,
            String enquiryStatus,
            String sourceType,
            String destinationPackageSessionId,
            Timestamp createdFrom,
            Timestamp createdTo,
            String searchText,
            String counsellorId,
            Boolean hasCounsellor,
            Pageable pageable) {

        StringBuilder jpql = new StringBuilder(
                "SELECT e FROM Enquiry e " +
                        "WHERE EXISTS (" +
                        "  SELECT 1 FROM AudienceResponse ar " +
                        "  WHERE ar.enquiryId = CAST(e.id AS string)");

        Map<String, Object> parameters = new HashMap<>();

        // Filter by audienceId OR instituteId (one is required - validated in service
        // layer)
        if (audienceId != null && !audienceId.isBlank()) {
            jpql.append(" AND ar.audienceId = :audienceId");
            parameters.put("audienceId", audienceId);
        } else if (instituteId != null && !instituteId.isBlank()) {
            // Search across all campaigns of this institute
            jpql.append(" AND ar.audienceId IN (SELECT a.id FROM Audience a WHERE a.instituteId = :instituteId)");
            parameters.put("instituteId", instituteId);
        }

        // NEW: searchText filter - search across parent name, email, and mobile
        if (searchText != null && !searchText.isBlank()) {
            String searchPattern = "%" + searchText.toLowerCase() + "%";
            jpql.append(" AND (LOWER(ar.parentName) LIKE :searchText " +
                    "OR LOWER(ar.parentEmail) LIKE :searchText " +
                    "OR ar.parentMobile LIKE :searchPattern)");
            parameters.put("searchText", searchPattern);
            parameters.put("searchPattern", "%" + searchText + "%");
        }

        // Existing filters
        if (sourceType != null && !sourceType.isBlank()) {
            jpql.append(" AND ar.sourceType = :sourceType");
            parameters.put("sourceType", sourceType);
        }

        if (destinationPackageSessionId != null && !destinationPackageSessionId.isBlank()) {
            jpql.append(" AND ar.destinationPackageSessionId = :destinationPackageSessionId");
            parameters.put("destinationPackageSessionId", destinationPackageSessionId);
        }

        // Close the EXISTS subquery for AudienceResponse
        jpql.append(")");

        // Enquiry status filter (outside EXISTS)
        if (enquiryStatus != null && !enquiryStatus.isBlank()) {
            jpql.append(" AND e.enquiryStatus = :enquiryStatus");
            parameters.put("enquiryStatus", enquiryStatus);
        }

        // Date filters (outside EXISTS)
        if (createdFrom != null) {
            jpql.append(" AND e.createdAt >= :createdFrom");
            parameters.put("createdFrom", createdFrom);
        }

        if (createdTo != null) {
            jpql.append(" AND e.createdAt <= :createdTo");
            parameters.put("createdTo", createdTo);
        }

        // NEW: counsellorId filter - filter by assigned counsellor
        if (counsellorId != null && !counsellorId.isBlank()) {
            jpql.append(" AND CAST(e.id AS string) IN (" +
                    "SELECT lu.sourceId FROM LinkedUsers lu " +
                    "WHERE lu.source = 'ENQUIRY' AND lu.userId = :counsellorId)");
            parameters.put("counsellorId", counsellorId);
        }

        // NEW: hasCounsellor filter - filter by whether counsellor is assigned or not
        if (hasCounsellor != null) {
            if (hasCounsellor) {
                // Has counsellor assigned
                jpql.append(" AND CAST(e.id AS string) IN (" +
                        "SELECT lu.sourceId FROM LinkedUsers lu WHERE lu.source = 'ENQUIRY')");
            } else {
                // Does NOT have counsellor assigned
                jpql.append(" AND CAST(e.id AS string) NOT IN (" +
                        "SELECT lu.sourceId FROM LinkedUsers lu WHERE lu.source = 'ENQUIRY')");
            }
        }

        // Count query
        String countJpql = jpql.toString().replace("SELECT e FROM Enquiry e", "SELECT COUNT(e) FROM Enquiry e");
        TypedQuery<Long> countQuery = entityManager.createQuery(countJpql, Long.class);
        parameters.forEach(countQuery::setParameter);
        Long total = countQuery.getSingleResult();

        // Data query - add ORDER BY
        String dataJpql = jpql.toString() + " ORDER BY e.createdAt DESC";
        TypedQuery<Enquiry> query = entityManager.createQuery(dataJpql, Enquiry.class);
        parameters.forEach(query::setParameter);
        query.setFirstResult((int) pageable.getOffset());
        query.setMaxResults(pageable.getPageSize());

        List<Enquiry> results = query.getResultList();

        return new PageImpl<>(results, pageable, total);
    }
}
