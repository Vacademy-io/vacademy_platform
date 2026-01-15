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
            String enquiryStatus,
            String sourceType,
            String destinationPackageSessionId,
            Timestamp createdFrom,
            Timestamp createdTo,
            Pageable pageable) {

        StringBuilder jpql = new StringBuilder(
                "SELECT e FROM Enquiry e " +
                "WHERE EXISTS (" +
                "  SELECT 1 FROM AudienceResponse ar " +
                "  WHERE ar.enquiryId = CAST(e.id AS string) " +
                "  AND ar.audienceId = :audienceId"
        );

        Map<String, Object> parameters = new HashMap<>();
        parameters.put("audienceId", audienceId);

        // Add filters
        if (enquiryStatus != null && !enquiryStatus.isBlank()) {
            jpql.append(" AND e.enquiryStatus = :enquiryStatus");
            parameters.put("enquiryStatus", enquiryStatus);
        }

        if (sourceType != null && !sourceType.isBlank()) {
            jpql.append(" AND ar.sourceType = :sourceType");
            parameters.put("sourceType", sourceType);
        }

        if (destinationPackageSessionId != null && !destinationPackageSessionId.isBlank()) {
            jpql.append(" AND ar.destinationPackageSessionId = :destinationPackageSessionId");
            parameters.put("destinationPackageSessionId", destinationPackageSessionId);
        }

        if (createdFrom != null) {
            jpql.append(" AND e.createdAt >= :createdFrom");
            parameters.put("createdFrom", createdFrom);
        }

        if (createdTo != null) {
            jpql.append(" AND e.createdAt <= :createdTo");
            parameters.put("createdTo", createdTo);
        }

        jpql.append(")");

        // Count query - remove ORDER BY from count query
        String countJpql = jpql.toString().replace("SELECT e FROM Enquiry e", "SELECT COUNT(e) FROM Enquiry e");
        TypedQuery<Long> countQuery = entityManager.createQuery(countJpql, Long.class);
        parameters.forEach(countQuery::setParameter);
        Long total = countQuery.getSingleResult();

        // Data query - add ORDER BY only to data query
        String dataJpql = jpql.toString() + " ORDER BY e.createdAt DESC";
        TypedQuery<Enquiry> query = entityManager.createQuery(dataJpql, Enquiry.class);
        parameters.forEach(query::setParameter);
        query.setFirstResult((int) pageable.getOffset());
        query.setMaxResults(pageable.getPageSize());

        List<Enquiry> results = query.getResultList();

        return new PageImpl<>(results, pageable, total);
    }
}
