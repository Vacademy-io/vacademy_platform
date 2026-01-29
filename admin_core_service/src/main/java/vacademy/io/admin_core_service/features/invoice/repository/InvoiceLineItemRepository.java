package vacademy.io.admin_core_service.features.invoice.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.invoice.entity.Invoice;
import vacademy.io.admin_core_service.features.invoice.entity.InvoiceLineItem;

import java.util.List;

@Repository
public interface InvoiceLineItemRepository extends JpaRepository<InvoiceLineItem, String> {
    
    List<InvoiceLineItem> findByInvoice(Invoice invoice);
    
    List<InvoiceLineItem> findByInvoiceId(String invoiceId);
}


