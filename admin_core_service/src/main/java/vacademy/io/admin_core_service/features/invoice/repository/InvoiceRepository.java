package vacademy.io.admin_core_service.features.invoice.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.invoice.entity.Invoice;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface InvoiceRepository extends JpaRepository<Invoice, String> {
    
    Optional<Invoice> findByInvoiceNumber(String invoiceNumber);
    
    List<Invoice> findByUserIdOrderByCreatedAtDesc(String userId);
    
    List<Invoice> findByInstituteIdOrderByCreatedAtDesc(String instituteId);
    
    /**
     * Find invoices by user plan ID via payment log mapping
     * Since Invoice no longer has direct userPlanId, we query through the mapping table
     */
    @Query("SELECT DISTINCT i FROM Invoice i " +
           "JOIN i.paymentLogMappings m " +
           "JOIN m.paymentLog pl " +
           "WHERE pl.userPlan.id = :userPlanId " +
           "ORDER BY i.createdAt DESC")
    List<Invoice> findByUserPlanIdOrderByCreatedAtDesc(@Param("userPlanId") String userPlanId);
    
    @Query("SELECT i FROM Invoice i WHERE i.userId = :userId AND i.instituteId = :instituteId ORDER BY i.createdAt DESC")
    List<Invoice> findByUserIdAndInstituteIdOrderByCreatedAtDesc(@Param("userId") String userId, @Param("instituteId") String instituteId);
    
    @Query("SELECT COUNT(i) FROM Invoice i WHERE i.instituteId = :instituteId AND DATE(i.invoiceDate) = DATE(:date)")
    Long countByInstituteIdAndInvoiceDate(@Param("instituteId") String instituteId, @Param("date") LocalDateTime date);
    
    @Query("SELECT i FROM Invoice i WHERE i.instituteId = :instituteId AND i.invoiceDate >= :startDate AND i.invoiceDate <= :endDate ORDER BY i.createdAt DESC")
    Page<Invoice> findByInstituteIdAndDateRange(@Param("instituteId") String instituteId, 
                                                  @Param("startDate") LocalDateTime startDate, 
                                                  @Param("endDate") LocalDateTime endDate, 
                                                  Pageable pageable);
}


