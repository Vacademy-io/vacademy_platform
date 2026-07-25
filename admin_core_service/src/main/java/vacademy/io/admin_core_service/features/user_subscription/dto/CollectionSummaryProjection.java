package vacademy.io.admin_core_service.features.user_subscription.dto;

/**
 * One row of the payment-collection summary: total PAID amount collected on a
 * single day (YYYY-MM-DD, UTC) for an institute (optionally scoped to a sub-org).
 */
public interface CollectionSummaryProjection {
    String getDay();

    Double getAmount();

    Long getCnt();

    String getCurrency();
}
