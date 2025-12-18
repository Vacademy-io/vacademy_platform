package vacademy.io.admin_core_service.features.invoice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.UuidGenerator;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
@Entity
@Table(name = "invoice")
public class Invoice {
    
    @Id
    @UuidGenerator
    @Column(name = "id")
    private String id;

    @Column(name = "invoice_number", unique = true, nullable = false, length = 100)
    private String invoiceNumber;

    // Multiple payment logs supported via InvoicePaymentLogMapping
    // UserPlan can be accessed via: paymentLogMappings -> paymentLog -> userPlan
    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<InvoicePaymentLogMapping> paymentLogMappings;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(name = "institute_id", nullable = false)
    private String instituteId;

    @Column(name = "invoice_date", nullable = false)
    private LocalDateTime invoiceDate;

    @Column(name = "due_date", nullable = false)
    private LocalDateTime dueDate;

    @Column(name = "subtotal", nullable = false, precision = 10, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "discount_amount", precision = 10, scale = 2)
    private BigDecimal discountAmount;

    @Column(name = "tax_amount", precision = 10, scale = 2)
    private BigDecimal taxAmount;

    @Column(name = "total_amount", nullable = false, precision = 10, scale = 2)
    private BigDecimal totalAmount;

    @Column(name = "currency", nullable = false, length = 10)
    private String currency;

    @Column(name = "status", nullable = false, length = 50)
    private String status; // GENERATED, SENT, VIEWED

    @Column(name = "pdf_file_id", length = 255)
    private String pdfFileId;

    @Column(name = "invoice_data_json", columnDefinition = "TEXT")
    private String invoiceDataJson;

    @Column(name = "tax_included")
    private Boolean taxIncluded;

    @Column(name = "created_at", insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false, updatable = false)
    private LocalDateTime updatedAt;

    @OneToMany(mappedBy = "invoice", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<InvoiceLineItem> lineItems;
}


