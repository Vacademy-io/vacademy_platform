package vacademy.io.admin_core_service.features.user_subscription.dto;

/**
 * One row of the Manage Payments listing, before it is loaded.
 *
 * <p>The listing is a union of two different things: real payments (a {@code payment_log}) and
 * invoices that have been raised but never paid against. The latter have no payment_log at all —
 * one is only created when the learner initiates payment — so they are carried by invoice id and
 * discriminated by {@link #getRowType()}.
 */
public interface CombinedPaymentRowProjection {

    /** payment_log.id or invoice.id, depending on {@link #getRowType()}. */
    String getRowId();

    /** {@code PAYMENT_LOG} or {@code INVOICE}. */
    String getRowType();
}
