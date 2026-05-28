package vacademy.io.admin_core_service.features.invoice.controller;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.invoice.dto.AdminCreateInvoiceRequestDTO;
import vacademy.io.admin_core_service.features.invoice.dto.AdminInvoicePaymentLinkResponseDTO;
import vacademy.io.admin_core_service.features.invoice.dto.InvoiceDTO;
import vacademy.io.admin_core_service.features.invoice.service.InvoiceService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.payment.dto.PaymentResponseDTO;

import java.time.LocalDateTime;
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
    public ResponseEntity<List<InvoiceDTO>> getInvoicesByUser(
            @PathVariable String userId,
            @RequestParam(required = false) String instituteId) {
        List<InvoiceDTO> invoices = invoiceService.getInvoicesByUserId(userId, instituteId);
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
     * Get invoices by institute ID with optional filters and pagination.
     *
     * Usage: GET /admin-core-service/v1/invoices/institute/{instituteId}?page=0&size=20&userId=...&status=...&startDate=...&endDate=...
     */
    @GetMapping("/institute/{instituteId}")
    public ResponseEntity<Page<InvoiceDTO>> getInvoicesByInstitute(
            @PathVariable String instituteId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String userId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime endDate) {
        Page<InvoiceDTO> invoices = invoiceService.getInvoicesByInstituteId(
                instituteId, userId, status, startDate, endDate, page, size);
        return ResponseEntity.ok(invoices);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin invoice endpoints
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Admin creates invoices for one or multiple users.
     * No package session / enroll invite required.
     * Returns one entry per userId with a shareable payment link.
     *
     * POST /admin-core-service/v1/invoices/admin/create
     */
    @PostMapping("/admin/create")
    public ResponseEntity<List<AdminInvoicePaymentLinkResponseDTO>> createAdminInvoices(
            @Valid @RequestBody AdminCreateInvoiceRequestDTO request,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        List<AdminInvoicePaymentLinkResponseDTO> result = invoiceService.createAdminInvoices(request);
        return ResponseEntity.ok(result);
    }

    /**
     * Initiates gateway payment for an admin-created invoice.
     * Called when the user opens the payment link and clicks "Pay Now".
     * Returns gateway order/session details for the frontend to complete payment.
     *
     * POST /admin-core-service/v1/invoices/{invoiceId}/initiate-payment?instituteId=xxx
     */
    @PostMapping("/{invoiceId}/initiate-payment")
    public ResponseEntity<PaymentResponseDTO> initiatePaymentForAdminInvoice(
            @PathVariable String invoiceId,
            @RequestParam String instituteId,
            @RequestAttribute("user") CustomUserDetails userDetails) {
        PaymentResponseDTO response = invoiceService.initiatePaymentForAdminInvoice(invoiceId, instituteId, userDetails);
        return ResponseEntity.ok(response);
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
     * Test endpoint: Generate invoice for MULTI-PACKAGE enrollment (v2 API)
     * This simulates the v2 API scenario where multiple payment logs have the same order ID
     * and should be grouped into a single invoice with multiple line items
     *
     * Usage: POST /admin-core-service/v1/invoices/test/generate-multi-package/{orderId}
     */
    @PostMapping("/test/generate-multi-package/{orderId}")
    public ResponseEntity<String> testGenerateInvoiceMultiPackage(@PathVariable String orderId) {
        try {
            return ResponseEntity.ok(invoiceService.testGenerateInvoiceForMultiPackage(orderId));
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

