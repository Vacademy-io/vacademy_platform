package vacademy.io.admin_core_service.features.institute_learner.repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.Query;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.institute_learner.dto.projection.StudentListV2Projection;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Custom repository implementation for dynamic student queries with custom field filters.
 * Builds SQL queries dynamically based on customFieldFilters map.
 */
@Repository
public class InstituteStudentRepositoryImpl implements InstituteStudentRepositoryCustom {

    @PersistenceContext
    private EntityManager entityManager;

    private static final String BASE_SELECT = """
            SELECT
                s.full_name         AS fullName,
                s.email             AS email,
                s.username          AS username,
                s.mobile_number     AS phone,
                ssigm.package_session_id AS packageSessionId,
                CAST(GREATEST(0, COALESCE(EXTRACT(DAY FROM (ssigm.expiry_date - ssigm.enrolled_date)), 0)) AS int) AS accessDays,
                last_pl.payment_status AS paymentStatus,
                CAST(
                  COALESCE(
                    json_agg(
                      DISTINCT jsonb_build_object(
                        'custom_field_id', cf.id,
                        'value', cfv.value
                      )
                    ) FILTER (WHERE cf.id IS NOT NULL), '[]'
                  ) AS text
                ) AS customFieldsJson,
                s.user_id AS userId,
                s.id AS id,
                s.address_line AS addressLine,
                s.region AS region,
                s.city AS city,
                s.pin_code AS pinCode,
                s.date_of_birth AS dateOfBirth,
                s.gender AS gender,
                s.fathers_name AS fathersName,
                s.mothers_name AS mothersName,
                s.parents_mobile_number AS parentsMobileNumber,
                s.parents_email AS parentsEmail,
                s.linked_institute_name AS linkedInstituteName,
                s.created_at AS createdAt,
                s.updated_at AS updatedAt,
                s.face_file_id AS faceFileId,
                ssigm.expiry_date AS expiryDate,
                s.parents_to_mother_mobile_number AS parentsToMotherMobileNumber,
                s.parents_to_mother_email AS parentsToMotherEmail,
                ssigm.institute_enrollment_number AS instituteEnrollmentNumber,
                ssigm.institute_id AS instituteId,
                ssigm.group_id AS groupId,
                ssigm.status AS status,
                up.plan_json AS paymentPlanJson,
                up.payment_option_json AS paymentOptionJson,
                ssigm.destination_package_session_id AS destinationPackageSessionId,
                ssigm.user_plan_id AS userPlanId,
                up.enroll_invite_id AS enrollInviteId,
                ssigm.desired_level_id AS desiredLevelId,
                ssigm.sub_org_id AS subOrgId,
                sub_org.name AS subOrgName,
                ssigm.comma_separated_org_roles AS commaSeparatedOrgRoles
            FROM student s
            JOIN student_session_institute_group_mapping ssigm
                ON s.user_id = ssigm.user_id
            LEFT JOIN institute_custom_fields icf
                ON icf.institute_id = ssigm.institute_id
                AND (:customFieldStatus IS NULL OR icf.status IN :customFieldStatus)
            LEFT JOIN custom_fields cf
                ON cf.id = icf.custom_field_id
            LEFT JOIN custom_field_values cfv
                ON cfv.source_type = 'USER'
                AND cfv.source_id = ssigm.user_id
                AND cfv.custom_field_id = cf.id
            LEFT JOIN user_plan up
                ON up.id = ssigm.user_plan_id
            LEFT JOIN LATERAL (
                SELECT pl.payment_status
                FROM payment_log pl
                WHERE pl.user_plan_id = up.id
                ORDER BY pl.date DESC NULLS LAST
                LIMIT 1
            ) last_pl ON TRUE
            LEFT JOIN institutes sub_org
                ON sub_org.id = ssigm.sub_org_id
            """;

    private static final String BASE_COUNT = """
            SELECT COUNT(DISTINCT s.id)
            FROM student s
            JOIN student_session_institute_group_mapping ssigm
                ON s.user_id = ssigm.user_id
            LEFT JOIN user_plan up
                ON up.id = ssigm.user_plan_id
            LEFT JOIN LATERAL (
                SELECT pl.payment_status
                FROM payment_log pl
                WHERE pl.user_plan_id = up.id
                ORDER BY pl.date DESC NULLS LAST
                LIMIT 1
            ) last_pl ON TRUE
            """;

    private static final String GROUP_BY = """
            GROUP BY s.id, s.username, s.full_name, s.email, s.mobile_number,
                     ssigm.package_session_id, ssigm.enrolled_date, ssigm.expiry_date,
                     last_pl.payment_status, s.user_id, s.address_line, s.region, s.city,
                     s.pin_code, s.date_of_birth, s.gender, s.fathers_name, s.mothers_name,
                     s.parents_mobile_number, s.parents_email, s.linked_institute_name,
                     s.created_at, s.updated_at, s.face_file_id, s.parents_to_mother_mobile_number,
                     s.parents_to_mother_email, ssigm.institute_enrollment_number,
                     ssigm.institute_id, ssigm.group_id, ssigm.status, up.plan_json, up.payment_option_json, 
                     ssigm.destination_package_session_id, ssigm.user_plan_id, up.enroll_invite_id, ssigm.desired_level_id,
                     ssigm.sub_org_id, sub_org.name, ssigm.comma_separated_org_roles
            """;

    @Override
    public Page<StudentListV2Projection> getAllStudentV2WithSearchAndCustomFieldFilters(
            String name,
            List<String> instituteIds,
            List<String> statuses,
            List<String> paymentStatuses,
            List<String> customFieldStatus,
            List<String> sources,
            List<String> types,
            List<String> typeIds,
            List<String> destinationPackageSessionIds,
            List<String> levelIds,
            List<String> subOrgUserTypes,
            Map<String, List<String>> customFieldFilters,
            Pageable pageable) {

        StringBuilder whereClause = new StringBuilder(" WHERE (");
        
        // Search conditions
        whereClause.append("(s.full_name IS NOT NULL AND s.full_name != '' AND s.full_name ILIKE '%' || :name || '%') ");
        whereClause.append("OR (s.username IS NOT NULL AND s.username != '' AND s.username ILIKE '%' || :name || '%') ");
        whereClause.append("OR (s.email IS NOT NULL AND s.email != '' AND s.email ILIKE '%' || :name || '%') ");
        whereClause.append("OR (s.city IS NOT NULL AND s.city != '' AND s.city ILIKE '%' || :name || '%') ");
        whereClause.append("OR (ssigm.institute_enrollment_number IS NOT NULL AND ssigm.institute_enrollment_number != '' AND ssigm.institute_enrollment_number ILIKE '%' || :name || '%') ");
        whereClause.append("OR (s.user_id IS NOT NULL AND s.user_id != '' AND s.user_id ILIKE '%' || :name || '%') ");
        whereClause.append("OR (s.mobile_number IS NOT NULL AND s.mobile_number != '' AND s.mobile_number ILIKE '%' || :name || '%') ");
        whereClause.append("OR EXISTS (");
        whereClause.append("  SELECT 1 FROM custom_field_values cfv_inner ");
        whereClause.append("  WHERE cfv_inner.source_type = 'USER' ");
        whereClause.append("    AND cfv_inner.source_id = ssigm.user_id ");
        whereClause.append("    AND cfv_inner.value IS NOT NULL ");
        whereClause.append("    AND cfv_inner.value != '' ");
        whereClause.append("    AND LOWER(cfv_inner.value) LIKE LOWER('%' || :name || '%') ");
        whereClause.append(") ");
        whereClause.append(") ");

        // Standard filters
        whereClause.append("AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds)) ");
        whereClause.append("AND (:statuses IS NULL OR ssigm.status IN (:statuses)) ");
        whereClause.append("AND (:paymentStatuses IS NULL OR last_pl.payment_status IN (:paymentStatuses)) ");
        whereClause.append("AND (:sources IS NULL OR ssigm.source IN (:sources)) ");
        whereClause.append("AND (:types IS NULL OR ssigm.type IN (:types)) ");
        whereClause.append("AND (:typeIds IS NULL OR ssigm.type_id IN (:typeIds)) ");
        whereClause.append("AND (:destinationPackageSessionIds IS NULL OR ssigm.destination_package_session_id IN (:destinationPackageSessionIds)) ");
        whereClause.append("AND (:levelIds IS NULL OR ssigm.desired_level_id IN (:levelIds)) ");

        // Sub org user types filter
        whereClause.append("AND ( ");
        whereClause.append("  :subOrgUserTypes IS NULL ");
        whereClause.append("  OR ( ");
        whereClause.append("    ssigm.comma_separated_org_roles IS NOT NULL ");
        whereClause.append("    AND ssigm.comma_separated_org_roles != '' ");
        whereClause.append("    AND EXISTS ( ");
        whereClause.append("      SELECT 1 FROM unnest(string_to_array(ssigm.comma_separated_org_roles, ',')) AS role ");
        whereClause.append("      WHERE TRIM(role) IN (:subOrgUserTypes) ");
        whereClause.append("    ) ");
        whereClause.append("  ) ");
        whereClause.append(") ");

        // Custom field filters - dynamic WHERE clauses
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("name", name);
        parameters.put("instituteIds", instituteIds);
        parameters.put("statuses", statuses);
        parameters.put("paymentStatuses", paymentStatuses);
        parameters.put("customFieldStatus", customFieldStatus);
        parameters.put("sources", sources);
        parameters.put("types", types);
        parameters.put("typeIds", typeIds);
        parameters.put("destinationPackageSessionIds", destinationPackageSessionIds);
        parameters.put("levelIds", levelIds);
        parameters.put("subOrgUserTypes", subOrgUserTypes);

        if (customFieldFilters != null && !customFieldFilters.isEmpty()) {
            int filterIndex = 0;
            for (Map.Entry<String, List<String>> entry : customFieldFilters.entrySet()) {
                String fieldId = entry.getKey();
                List<String> values = entry.getValue();
                
                String paramFieldId = "customFieldId" + filterIndex;
                String paramValues = "customFieldValues" + filterIndex;
                
                whereClause.append("AND EXISTS ( ");
                whereClause.append("  SELECT 1 FROM custom_field_values cfv_filter").append(filterIndex).append(" ");
                whereClause.append("  WHERE cfv_filter").append(filterIndex).append(".source_type = 'USER' ");
                whereClause.append("    AND cfv_filter").append(filterIndex).append(".source_id = ssigm.user_id ");
                whereClause.append("    AND cfv_filter").append(filterIndex).append(".custom_field_id = :").append(paramFieldId).append(" ");
                whereClause.append("    AND cfv_filter").append(filterIndex).append(".value IN (:").append(paramValues).append(") ");
                whereClause.append(") ");
                
                parameters.put(paramFieldId, fieldId);
                parameters.put(paramValues, values);
                filterIndex++;
            }
        }

        // Build main query
        String mainQuery = BASE_SELECT + whereClause.toString() + GROUP_BY;
        String countQuery = BASE_COUNT + whereClause.toString();

        // Execute count query
        Query nativeCountQuery = entityManager.createNativeQuery(countQuery);
        setParameters(nativeCountQuery, parameters);
        long total = ((Number) nativeCountQuery.getSingleResult()).longValue();

        // Execute main query with pagination
        Query nativeQuery = entityManager.createNativeQuery(mainQuery, "StudentListV2ProjectionMapping");
        setParameters(nativeQuery, parameters);
        nativeQuery.setFirstResult((int) pageable.getOffset());
        nativeQuery.setMaxResults(pageable.getPageSize());

        @SuppressWarnings("unchecked")
        List<StudentListV2Projection> content = nativeQuery.getResultList();

        return new PageImpl<>(content, pageable, total);
    }

    @Override
    public Page<StudentListV2Projection> getAllStudentV2WithFilterAndCustomFieldFilters(
            List<String> statuses,
            List<String> gender,
            List<String> instituteIds,
            List<String> groupIds,
            List<String> packageSessionIds,
            List<String> paymentStatuses,
            List<String> customFieldStatus,
            List<String> sources,
            List<String> types,
            List<String> typeIds,
            List<String> destinationPackageSessionIds,
            List<String> levelIds,
            List<String> subOrgUserTypes,
            Map<String, List<String>> customFieldFilters,
            Pageable pageable) {

        StringBuilder whereClause = new StringBuilder(" WHERE 1=1 ");

        // Standard filters
        whereClause.append("AND (:statuses IS NULL OR ssigm.status IN (:statuses)) ");
        whereClause.append("AND (:gender IS NULL OR s.gender IN (:gender)) ");
        whereClause.append("AND (:instituteIds IS NULL OR ssigm.institute_id IN (:instituteIds)) ");
        whereClause.append("AND (:groupIds IS NULL OR ssigm.group_id IN (:groupIds)) ");
        whereClause.append("AND (:packageSessionIds IS NULL OR ssigm.package_session_id IN (:packageSessionIds)) ");
        whereClause.append("AND (:paymentStatuses IS NULL OR last_pl.payment_status IN (:paymentStatuses)) ");
        whereClause.append("AND (:sources IS NULL OR ssigm.source IN (:sources)) ");
        whereClause.append("AND (:types IS NULL OR ssigm.type IN (:types)) ");
        whereClause.append("AND (:typeIds IS NULL OR ssigm.type_id IN (:typeIds)) ");
        whereClause.append("AND (:destinationPackageSessionIds IS NULL OR ssigm.destination_package_session_id IN (:destinationPackageSessionIds)) ");
        whereClause.append("AND (:levelIds IS NULL OR ssigm.desired_level_id IN (:levelIds)) ");

        // Sub org user types filter
        whereClause.append("AND ( ");
        whereClause.append("  :subOrgUserTypes IS NULL ");
        whereClause.append("  OR ( ");
        whereClause.append("    ssigm.comma_separated_org_roles IS NOT NULL ");
        whereClause.append("    AND ssigm.comma_separated_org_roles != '' ");
        whereClause.append("    AND EXISTS ( ");
        whereClause.append("      SELECT 1 FROM unnest(string_to_array(ssigm.comma_separated_org_roles, ',')) AS role ");
        whereClause.append("      WHERE TRIM(role) IN (:subOrgUserTypes) ");
        whereClause.append("    ) ");
        whereClause.append("  ) ");
        whereClause.append(") ");

        // Prepare parameters
        Map<String, Object> parameters = new HashMap<>();
        parameters.put("statuses", statuses);
        parameters.put("gender", gender);
        parameters.put("instituteIds", instituteIds);
        parameters.put("groupIds", groupIds);
        parameters.put("packageSessionIds", packageSessionIds);
        parameters.put("paymentStatuses", paymentStatuses);
        parameters.put("customFieldStatus", customFieldStatus);
        parameters.put("sources", sources);
        parameters.put("types", types);
        parameters.put("typeIds", typeIds);
        parameters.put("destinationPackageSessionIds", destinationPackageSessionIds);
        parameters.put("levelIds", levelIds);
        parameters.put("subOrgUserTypes", subOrgUserTypes);

        if (customFieldFilters != null && !customFieldFilters.isEmpty()) {
            int filterIndex = 0;
            for (Map.Entry<String, List<String>> entry : customFieldFilters.entrySet()) {
                String fieldId = entry.getKey();
                List<String> values = entry.getValue();
                
                String paramFieldId = "customFieldId" + filterIndex;
                String paramValues = "customFieldValues" + filterIndex;
                
                whereClause.append("AND EXISTS ( ");
                whereClause.append("  SELECT 1 FROM custom_field_values cfv_filter").append(filterIndex).append(" ");
                whereClause.append("  WHERE cfv_filter").append(filterIndex).append(".source_type = 'USER' ");
                whereClause.append("    AND cfv_filter").append(filterIndex).append(".source_id = ssigm.user_id ");
                whereClause.append("    AND cfv_filter").append(filterIndex).append(".custom_field_id = :").append(paramFieldId).append(" ");
                whereClause.append("    AND cfv_filter").append(filterIndex).append(".value IN (:").append(paramValues).append(") ");
                whereClause.append(") ");
                
                parameters.put(paramFieldId, fieldId);
                parameters.put(paramValues, values);
                filterIndex++;
            }
        }

        // Build main query
        String mainQuery = BASE_SELECT + whereClause.toString() + GROUP_BY;
        String countQuery = BASE_COUNT + whereClause.toString();

        // Execute count query
        Query nativeCountQuery = entityManager.createNativeQuery(countQuery);
        setParameters(nativeCountQuery, parameters);
        long total = ((Number) nativeCountQuery.getSingleResult()).longValue();

        // Execute main query with pagination
        Query nativeQuery = entityManager.createNativeQuery(mainQuery, "StudentListV2ProjectionMapping");
        setParameters(nativeQuery, parameters);
        nativeQuery.setFirstResult((int) pageable.getOffset());
        nativeQuery.setMaxResults(pageable.getPageSize());

        List<StudentListV2Projection> content = nativeQuery.getResultList();

        return new PageImpl<>(content, pageable, total);
    }

    private void setParameters(Query query, Map<String, Object> parameters) {
        for (Map.Entry<String, Object> entry : parameters.entrySet()) {
            query.setParameter(entry.getKey(), entry.getValue());
        }
    }
}
