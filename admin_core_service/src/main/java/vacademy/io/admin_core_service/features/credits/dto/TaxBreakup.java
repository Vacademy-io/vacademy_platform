package vacademy.io.admin_core_service.features.credits.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * Computed tax for a single line at order time. All amounts in minor units
 * (paise / cents). All rates in basis points (1800 = 18.00%).
 *
 * Exactly one of (cgst+sgst) OR igst will be non-zero for INR; both are zero
 * for export (USD).
 */
@Getter
@Builder
public class TaxBreakup {
    private final long baseAmountMinor;
    private final long taxAmountMinor;       // cgst + sgst + igst
    private final long totalAmountMinor;     // base + tax

    private final int cgstRateBps;
    private final long cgstAmountMinor;
    private final int sgstRateBps;
    private final long sgstAmountMinor;
    private final int igstRateBps;
    private final long igstAmountMinor;

    /** "29" Karnataka, "27" Maharashtra; "96" for export / outside India. */
    private final String placeOfSupply;
    private final boolean isExport;
}
