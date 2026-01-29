package vacademy.io.admin_core_service.features.invoice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.invoice.entity.Invoice;
import vacademy.io.admin_core_service.features.invoice.entity.InvoicePaymentLogMapping;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;

import java.util.List;

@Repository
public interface InvoicePaymentLogMappingRepository extends JpaRepository<InvoicePaymentLogMapping, String> {
    
    List<InvoicePaymentLogMapping> findByInvoice(Invoice invoice);
    
    List<InvoicePaymentLogMapping> findByInvoiceId(String invoiceId);
    
    List<InvoicePaymentLogMapping> findByPaymentLog(PaymentLog paymentLog);
    
    @Query("SELECT iplm.paymentLog FROM InvoicePaymentLogMapping iplm WHERE iplm.invoice.id = :invoiceId")
    List<PaymentLog> findPaymentLogsByInvoiceId(@Param("invoiceId") String invoiceId);
    
    boolean existsByPaymentLogId(String paymentLogId);
}

