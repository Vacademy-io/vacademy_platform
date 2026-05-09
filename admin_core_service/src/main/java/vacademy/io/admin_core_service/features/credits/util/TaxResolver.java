package vacademy.io.admin_core_service.features.credits.util;

import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.credits.dto.TaxBreakup;
import vacademy.io.common.institute.entity.Institute;

/**
 * Compute the GST breakup for an AI credit pack purchase line.
 *
 * Rules (Indian GST):
 *   INR + buyer state == supplier state  -> CGST 9% + SGST 9%   (intra-state)
 *   INR + buyer state != supplier state  -> IGST 18%             (inter-state)
 *   USD or any non-INR (export)          -> 0%, place_of_supply="96"
 *
 * Buyer state is read from {@link Institute#getStateCode()} (V239 added it).
 * If buyer state_code is null on an INR purchase, we conservatively treat the
 * sale as inter-state (IGST 18%) — safer for the supplier than missing tax.
 *
 * Supplier state code comes from platform_payment_config and is passed in by
 * the caller (we don't load it here to keep this resolver pure).
 */
@Component
public class TaxResolver {

    private static final int GST_HALF_RATE_BPS = 900;     // 9.00% — CGST/SGST each leg
    private static final int GST_FULL_RATE_BPS = 1800;    // 18.00% — IGST or combined
    private static final String EXPORT_PLACE_OF_SUPPLY = "96";

    public TaxBreakup resolveTax(
            Institute institute,
            String currency,
            long baseAmountMinor,
            String supplierStateCode) {

        if (!CurrencyResolver.INR.equalsIgnoreCase(currency)) {
            // Export / non-INR — zero-rated.
            return TaxBreakup.builder()
                    .baseAmountMinor(baseAmountMinor)
                    .taxAmountMinor(0L)
                    .totalAmountMinor(baseAmountMinor)
                    .placeOfSupply(EXPORT_PLACE_OF_SUPPLY)
                    .isExport(true)
                    .build();
        }

        String buyerStateCode = institute == null ? null : institute.getStateCode();
        boolean intraState = supplierStateCode != null
                && buyerStateCode != null
                && supplierStateCode.equalsIgnoreCase(buyerStateCode);

        long taxAmount;
        long cgst;
        long sgst;
        long igst;
        int cgstBps;
        int sgstBps;
        int igstBps;

        if (intraState) {
            cgst = roundHalfUp(baseAmountMinor, GST_HALF_RATE_BPS);
            sgst = roundHalfUp(baseAmountMinor, GST_HALF_RATE_BPS);
            igst = 0L;
            cgstBps = GST_HALF_RATE_BPS;
            sgstBps = GST_HALF_RATE_BPS;
            igstBps = 0;
            taxAmount = cgst + sgst;
        } else {
            cgst = 0L;
            sgst = 0L;
            igst = roundHalfUp(baseAmountMinor, GST_FULL_RATE_BPS);
            cgstBps = 0;
            sgstBps = 0;
            igstBps = GST_FULL_RATE_BPS;
            taxAmount = igst;
        }

        return TaxBreakup.builder()
                .baseAmountMinor(baseAmountMinor)
                .taxAmountMinor(taxAmount)
                .totalAmountMinor(baseAmountMinor + taxAmount)
                .cgstRateBps(cgstBps)
                .cgstAmountMinor(cgst)
                .sgstRateBps(sgstBps)
                .sgstAmountMinor(sgst)
                .igstRateBps(igstBps)
                .igstAmountMinor(igst)
                .placeOfSupply(buyerStateCode != null ? buyerStateCode : supplierStateCode)
                .isExport(false)
                .build();
    }

    /** amount * (rateBps / 10000) with banker's-style HALF_UP rounding. */
    private static long roundHalfUp(long amountMinor, int rateBps) {
        // (amount * rate + 5000) / 10000 — integer division, half rounds up
        long product = amountMinor * (long) rateBps;
        return (product + 5000L) / 10000L;
    }
}
