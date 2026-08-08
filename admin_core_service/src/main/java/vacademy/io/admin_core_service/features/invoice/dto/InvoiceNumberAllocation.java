package vacademy.io.admin_core_service.features.invoice.dto;

/**
 * A rendered invoice number together with the sequence position behind it.
 *
 * <p>All three values must be persisted on the {@code invoice} row: {@code seqNo} and
 * {@code scopeKey} ARE the counter (there is no side table), so an invoice saved without
 * them is invisible to the next allocation and its number will eventually be handed out
 * again — caught by the unique constraint, but only after a wasted PDF render.
 *
 * @param number   the rendered invoice number, e.g. {@code ACME/2026-27/0042}
 * @param seqNo    sequence position within {@code scopeKey}
 * @param scopeKey reset window: {@code ALL | YYYY | YYYYMM | YYYYMMDD}
 */
public record InvoiceNumberAllocation(String number, Long seqNo, String scopeKey) {

    /**
     * For numbers that are NOT sequence-allocated — an admin's explicit override, or the
     * uniqueness fallback. Stored with a null {@code seqNo} so they never move the
     * institute's counter.
     */
    public static InvoiceNumberAllocation unsequenced(String number) {
        return new InvoiceNumberAllocation(number, null, null);
    }
}
