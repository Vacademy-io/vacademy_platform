package vacademy.io.admin_core_service.features.invoice.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.invoice.dto.InvoiceDTO;
import vacademy.io.admin_core_service.features.invoice.service.InvoiceService;
import vacademy.io.common.payment.dto.PaymentResponseDTO;

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

    /**
     * Initiate gateway payment for an admin-created invoice without authentication.
     * The invoice already contains the user_id, so no session is required.
     * Used by the shareable invoice payment link (/pay/invoice/{invoiceId}).
     */
    @PostMapping("/{invoiceId}/initiate-payment")
    public ResponseEntity<PaymentResponseDTO> initiatePaymentPublic(
            @PathVariable String invoiceId,
            @RequestParam String instituteId) {
        PaymentResponseDTO response = invoiceService.initiatePaymentForAdminInvoice(invoiceId, instituteId, null);
        return ResponseEntity.ok(response);
    }
}
