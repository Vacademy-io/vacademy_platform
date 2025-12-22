package vacademy.io.admin_core_service.features.institute_learner.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import vacademy.io.admin_core_service.features.institute_learner.dto.projection.StudentListV2Projection;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * Custom repository interface for dynamic student queries with custom field filters.
 * This allows building SQL queries dynamically based on the customFieldFilters map.
 */
public interface InstituteStudentRepositoryCustom {
    
    /**
     * Get students with search and custom field filters applied at database level.
     * 
     * @param name Search term for student name, email, city, etc.
     * @param instituteIds List of institute IDs
     * @param statuses List of student statuses
     * @param paymentStatuses List of payment statuses
     * @param customFieldStatus Custom field status filter
     * @param sources List of sources
     * @param types List of types
     * @param typeIds List of type IDs
     * @param destinationPackageSessionIds List of destination package session IDs
     * @param levelIds List of level IDs
     * @param subOrgUserTypes List of sub org user types (ADMIN/LEARNER)
     * @param customFieldFilters Map of custom field filters (fieldId -> allowed values)
     * @param startDate Start date for enrollment date range filter
     * @param endDate End date for enrollment date range filter
     * @param pageable Pagination parameters
     * @return Page of StudentListV2Projection
     */
    Page<StudentListV2Projection> getAllStudentV2WithSearchAndCustomFieldFilters(
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
            LocalDate startDate,
            LocalDate endDate,
            Pageable pageable);
    
    /**
     * Get students with filter and custom field filters applied at database level.
     * 
     * @param statuses List of student statuses
     * @param gender List of gender values
     * @param instituteIds List of institute IDs
     * @param groupIds List of group IDs
     * @param packageSessionIds List of package session IDs
     * @param paymentStatuses List of payment statuses
     * @param customFieldStatus Custom field status filter
     * @param sources List of sources
     * @param types List of types
     * @param typeIds List of type IDs
     * @param destinationPackageSessionIds List of destination package session IDs
     * @param levelIds List of level IDs
     * @param subOrgUserTypes List of sub org user types (ADMIN/LEARNER)
     * @param customFieldFilters Map of custom field filters (fieldId -> allowed values)
     * @param startDate Start date for enrollment date range filter
     * @param endDate End date for enrollment date range filter
     * @param pageable Pagination parameters
     * @return Page of StudentListV2Projection
     */
    Page<StudentListV2Projection> getAllStudentV2WithFilterAndCustomFieldFilters(
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
            LocalDate startDate,
            LocalDate endDate,
            Pageable pageable);
}
