package vacademy.io.admin_core_service.features.audience.enums;

/**
 * Lifecycle status of an audience_response (lead) row.
 *
 * <p>This is the soft-delete switch, kept separate from {@code overall_status}
 * (which carries opt-out/engagement meaning) and {@code conversion_status}.
 * Operational lead views and — most importantly — promotional/automated
 * email + WhatsApp recipient-selection queries must exclude {@link #INACTIVE}
 * rows so a deleted lead stops receiving messages.</p>
 */
public enum AudienceStatusEnum {
    ACTIVE,    // Visible everywhere; eligible for promotional sends
    INACTIVE   // Soft-deleted by an admin; hidden from lead views + send recipient lists
}
