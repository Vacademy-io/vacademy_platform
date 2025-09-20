package vacademy.io.admin_core_service.features.institute.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.institute.entity.Template;

import java.util.List;
import java.util.Optional;

@Repository
public interface TemplateRepository extends JpaRepository<Template, String> {

    // Find templates by institute ID
    List<Template> findByInstituteId(String instituteId);

    // Find templates by institute ID and type
    List<Template> findByInstituteIdAndType(String instituteId, String type);

    // Find templates by institute ID, type, and vendor ID
    List<Template> findByInstituteIdAndTypeAndVendorId(String instituteId, String type, String vendorId);

    // Find template by institute ID and name
    Optional<Template> findByInstituteIdAndName(String instituteId, String name);

    // Find templates by vendor ID
    List<Template> findByVendorId(String vendorId);

    // Find templates by type
    List<Template> findByType(String type);

    // Find templates that can be deleted
    List<Template> findByCanDeleteTrue();

    // Find templates that cannot be deleted
    List<Template> findByCanDeleteFalse();

    // Find templates by institute ID and can delete flag
    List<Template> findByInstituteIdAndCanDelete(String instituteId, Boolean canDelete);

    // Search templates by name containing text
    @Query("SELECT t FROM Template t WHERE t.instituteId = :instituteId AND LOWER(t.name) LIKE LOWER(CONCAT('%', :searchText, '%'))")
    List<Template> findByNameContainingIgnoreCase(@Param("instituteId") String instituteId, @Param("searchText") String searchText);

    // Search templates by content containing text
    @Query("SELECT t FROM Template t WHERE t.instituteId = :instituteId AND LOWER(t.content) LIKE LOWER(CONCAT('%', :searchText, '%'))")
    List<Template> findByContentContainingIgnoreCase(@Param("instituteId") String instituteId, @Param("searchText") String searchText);

    // Search templates by subject containing text
    @Query("SELECT t FROM Template t WHERE t.instituteId = :instituteId AND LOWER(t.subject) LIKE LOWER(CONCAT('%', :searchText, '%'))")
    List<Template> findBySubjectContainingIgnoreCase(@Param("instituteId") String instituteId, @Param("searchText") String searchText);

    // Count templates by institute ID and type
    long countByInstituteIdAndType(String instituteId, String type);

    // Count templates by institute ID
    long countByInstituteId(String instituteId);

    // Find templates by institute ID with pagination support
    @Query("SELECT t FROM Template t WHERE t.instituteId = :instituteId ORDER BY t.createdAt DESC")
    List<Template> findByInstituteIdOrderByCreatedAtDesc(@Param("instituteId") String instituteId);

    // Find templates by institute ID and type with pagination support
    @Query("SELECT t FROM Template t WHERE t.instituteId = :instituteId AND t.type = :type ORDER BY t.createdAt DESC")
    List<Template> findByInstituteIdAndTypeOrderByCreatedAtDesc(@Param("instituteId") String instituteId, @Param("type") String type);

    // Check if template name exists for institute
    boolean existsByInstituteIdAndName(String instituteId, String name);

    // Check if template name exists for institute excluding specific template ID
    @Query("SELECT COUNT(t) > 0 FROM Template t WHERE t.instituteId = :instituteId AND t.name = :name AND t.id != :excludeId")
    boolean existsByInstituteIdAndNameAndIdNot(@Param("instituteId") String instituteId, @Param("name") String name, @Param("excludeId") String excludeId);

    // Find templates by institute ID and status
    List<Template> findByInstituteIdAndStatus(String instituteId, String status);

    // Find templates by institute ID and template category
    List<Template> findByInstituteIdAndTemplateCategory(String instituteId, String templateCategory);

    // Find templates by institute ID, status, and template category
    List<Template> findByInstituteIdAndStatusAndTemplateCategory(String instituteId, String status, String templateCategory);

    // Find templates by status
    List<Template> findByStatus(String status);

    // Find templates by template category
    List<Template> findByTemplateCategory(String templateCategory);

    // Count templates by institute ID and status
    long countByInstituteIdAndStatus(String instituteId, String status);

    // Count templates by institute ID and template category
    long countByInstituteIdAndTemplateCategory(String instituteId, String templateCategory);

    // Count templates by institute ID, status, and template category
    long countByInstituteIdAndStatusAndTemplateCategory(String instituteId, String status, String templateCategory);
}
