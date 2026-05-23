package vacademy.io.admin_core_service.features.invoice.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.invoice.dto.InvoiceDTO;
import vacademy.io.admin_core_service.features.invoice.service.InvoiceService;

/**
 * Public (no-auth) invoice endpoints.
 * Mapped under /open/** which is in ALLOWED_PATHS in ApplicationSecurityConfig.
 */
@RestController
@RequestMapping("/admin-core-service/open/v1/invoices")
public class OpenInvoiceController {

    @Autowired
    private InvoiceService invoiceService;

    /**
     * Fetch invoice details by ID without authentication.
     * Used by the learner's shareable payment link page (/pay/invoice/{invoiceId}).
     */
    @GetMapping("/{invoiceId}")
    public ResponseEntity<InvoiceDTO> getInvoicePublic(@PathVariable String invoiceId) {
        InvoiceDTO invoice = invoiceService.getInvoiceById(invoiceId);
        return ResponseEntity.ok(invoice);
    }
}
