package vacademy.io.admin_core_service.features.invoice.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Response for {@code POST /v1/invoices/admin/preview}. Powers the "Review & Preview"
 * step of the admin Create-Invoice dialog:
 *
 * <ul>
 *   <li>{@link #html} — the institute's invoice template with every {@code {{placeholder}}}
 *       filled in (same substitution the PDF uses), rendered live in a sandboxed iframe.</li>
 *   <li>{@link #resolvedValues} — one entry per editable/derived placeholder actually present
 *       in the template, so the UI can seed and let the admin edit the dynamic values before
 *       the invoice is created.</li>
 * </ul>
 *
 * Nothing is persisted and no invoice number is consumed when this is called.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class AdminInvoicePreviewResponseDTO {

    /** The rendered invoice HTML (all placeholders substituted). */
    private String html;

    /** Editable / derived placeholder values discovered in the template. */
    private List<PlaceholderValue> resolvedValues;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class PlaceholderValue {
        /** Placeholder name without braces, e.g. {@code invoice_number}. */
        private String key;
        /** Human-friendly label for the field, e.g. "Invoice Number". */
        private String label;
        /** UI grouping, e.g. INVOICE / BILL TO / INSTITUTE / TAX / AMOUNTS / NOTES. */
        private String group;
        /** Current value: the override when supplied, else the auto-derived value. */
        private String value;
        /** Whether the admin may edit this field (false for derived amounts). */
        private boolean editable;
        /** Preferred input control: {@code text} | {@code textarea} | {@code date}. */
        private String inputType;
    }
}
