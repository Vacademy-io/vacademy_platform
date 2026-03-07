package vacademy.io.admin_core_service.features.admission.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.admission.dto.AdmissionResponsesListRequestDTO;
import vacademy.io.admin_core_service.features.audience.entity.AudienceResponse;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Repository
public class AdmissionResponsesRepositoryCustomImpl implements AdmissionResponsesRepositoryCustom {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public Page<AudienceResponse> findAdmissionResponses(AdmissionResponsesListRequestDTO filter, Pageable pageable) {
        StringBuilder where = new StringBuilder(" WHERE 1=1 ");
        Map<String, Object> params = new HashMap<>();

        // Mandatory session filter: audience_response.destination_package_session_id -> package_session.session_id
        // This supports manual admissions where audience_id may be null.
        where.append(" AND ar.destination_package_session_id IN (")
                .append("SELECT ps.id FROM package_session ps WHERE ps.session_id = :sessionId")
                .append(") ");
        params.put("sessionId", filter.getSessionId());

        // Optional package session filter
        if (StringUtils.hasText(filter.getDestinationPackageSessionId())) {
            where.append(" AND ar.destination_package_session_id = :destinationPackageSessionId ");
            params.put("destinationPackageSessionId", filter.getDestinationPackageSessionId());
        }

        // Optional date filters
        if (filter.getCreatedFrom() != null) {
            where.append(" AND ar.created_at >= :createdFrom ");
            params.put("createdFrom", filter.getCreatedFrom());
        }
        if (filter.getCreatedTo() != null) {
            where.append(" AND ar.created_at <= :createdTo ");
            params.put("createdTo", filter.getCreatedTo());
        }

        // Optional source bifurcation
        String from = StringUtils.hasText(filter.getFrom()) ? filter.getFrom().trim().toUpperCase(Locale.ROOT) : null;
        if ("ENQUIRY".equals(from)) {
            where.append(" AND ar.enquiry_id IS NOT NULL ");
        } else if ("APPLICATION".equals(from)) {
            where.append(" AND ar.applicant_id IS NOT NULL ");
        }

        // Optional search
        String searchBy = StringUtils.hasText(filter.getSearchBy()) ? filter.getSearchBy().trim().toUpperCase(Locale.ROOT)
                : null;
        String searchText = StringUtils.hasText(filter.getSearchText()) ? filter.getSearchText().trim() : null;

        if (StringUtils.hasText(searchBy) && StringUtils.hasText(searchText)) {
            switch (searchBy) {
                case "PARENT_EMAIL" -> {
                    where.append(" AND LOWER(ar.parent_email) LIKE LOWER(:parentEmailLike) ");
                    params.put("parentEmailLike", "%" + searchText + "%");
                }
                case "PARENT_MOBILE" -> {
                    where.append(" AND ar.parent_mobile LIKE :parentMobileLike ");
                    params.put("parentMobileLike", "%" + searchText + "%");
                }
                case "STUDENT_NAME" -> {
                    where.append(" AND EXISTS (")
                            .append("SELECT 1 FROM student s ")
                            .append("WHERE s.user_id = ar.student_user_id ")
                            .append("AND LOWER(s.full_name) LIKE LOWER(:studentNameLike)")
                            .append(") ");
                    params.put("studentNameLike", "%" + searchText + "%");
                }
                case "ENQUIRY_ID" -> {
                    where.append(" AND ar.enquiry_id = :enquiryId ");
                    params.put("enquiryId", searchText);
                }
                case "APPLICANT_ID" -> {
                    where.append(" AND ar.applicant_id = :applicantId ");
                    params.put("applicantId", searchText);
                }
                default -> {
                    // ignore unknown search_by
                }
            }
        }

        String baseSql = " FROM audience_response ar " + where;
        String countSql = "SELECT COUNT(*) " + baseSql;
        String dataSql = "SELECT ar.* " + baseSql + " ORDER BY ar.created_at DESC ";

        Query countQ = entityManager.createNativeQuery(countSql);
        Query dataQ = entityManager.createNativeQuery(dataSql, AudienceResponse.class);
        params.forEach((k, v) -> {
            countQ.setParameter(k, v);
            dataQ.setParameter(k, v);
        });

        Number total = (Number) countQ.getSingleResult();
        dataQ.setFirstResult((int) pageable.getOffset());
        dataQ.setMaxResults(pageable.getPageSize());

        @SuppressWarnings("unchecked")
        List<AudienceResponse> rows = dataQ.getResultList();

        return new PageImpl<>(rows, pageable, total.longValue());
    }
}

