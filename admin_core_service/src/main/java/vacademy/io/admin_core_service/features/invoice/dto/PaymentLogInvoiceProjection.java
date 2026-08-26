package vacademy.io.admin_core_service.features.invoice.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Flat (payment log -> invoice) row read straight out of {@code invoice_payment_log_mapping}
 * joined to {@code invoice}.
 *
 * <p>Deliberately a projection rather than the {@link InvoiceDTO} the other listings return:
 * that mapper resolves a presigned PDF URL through the media service for every invoice it
 * touches, which is one cross-service HTTP call per row. The payments table only needs a
 * number to render — the PDF is presigned lazily, when someone actually clicks preview.
 */
public interface PaymentLogInvoiceProjection {
    String getPaymentLogId();

    String getInvoiceId();

    String getInvoiceNumber();

    LocalDateTime getInvoiceDate();

    String getStatus();

    BigDecimal getTotalAmount();

    String getCurrency();

    String getPdfFileId();

    LocalDateTime getCreatedAt();
}
