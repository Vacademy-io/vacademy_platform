package vacademy.io.admin_core_service.features.invoice.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.invoice.dto.InvoiceDTO;
import vacademy.io.admin_core_service.features.invoice.service.InvoiceService;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/v1/invoices")
public class InvoiceController {

    @Autowired
    private InvoiceService invoiceService;

    /**
     * Get invoice by ID
     */
    @GetMapping("/{invoiceId}")
    public ResponseEntity<InvoiceDTO> getInvoice(@PathVariable String invoiceId) {
        InvoiceDTO invoice = invoiceService.getInvoiceById(invoiceId);
        return ResponseEntity.ok(invoice);
    }

    /**
     * Get invoices by user ID
     */
    @GetMapping("/user/{userId}")
    public ResponseEntity<List<InvoiceDTO>> getInvoicesByUser(@PathVariable String userId) {
        List<InvoiceDTO> invoices = invoiceService.getInvoicesByUserId(userId);
        return ResponseEntity.ok(invoices);
    }

    /**
     * Download invoice PDF
     * Note: This endpoint would need to be implemented to fetch PDF from S3
     */
    @GetMapping("/{invoiceId}/download")
    public ResponseEntity<String> downloadInvoice(@PathVariable String invoiceId) {
        InvoiceDTO invoice = invoiceService.getInvoiceById(invoiceId);
        if (invoice.getPdfUrl() != null) {
            // Return redirect to PDF URL or implement actual download
            HttpHeaders headers = new HttpHeaders();
            headers.add("Location", invoice.getPdfUrl());
            return new ResponseEntity<>(headers, HttpStatus.FOUND);
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Test endpoint: Manually trigger invoice generation for a payment log
     * This will group related payment logs (same vendor_id or time window) into one invoice
     * Useful for testing invoice generation without going through full payment flow
     * 
     * Usage: POST /admin-core-service/v1/invoices/test/generate/{paymentLogId}
     */
    @PostMapping("/test/generate/{paymentLogId}")
    public ResponseEntity<String> testGenerateInvoice(@PathVariable String paymentLogId) {
        try {
            return ResponseEntity.ok(invoiceService.testGenerateInvoice(paymentLogId));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error: " + e.getMessage());
        }
    }

    /**
     * Test endpoint: Generate invoice for a SINGLE payment log only (no grouping)
     * This bypasses the grouping logic and creates an invoice for just this one payment log
     * Useful for testing single payment log scenarios
     * 
     * Usage: POST /admin-core-service/v1/invoices/test/generate-single/{paymentLogId}
     */
    @PostMapping("/test/generate-single/{paymentLogId}")
    public ResponseEntity<String> testGenerateInvoiceSingle(@PathVariable String paymentLogId) {
        try {
            return ResponseEntity.ok(invoiceService.testGenerateInvoiceSingle(paymentLogId));
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error: " + e.getMessage());
        }
    }
}

