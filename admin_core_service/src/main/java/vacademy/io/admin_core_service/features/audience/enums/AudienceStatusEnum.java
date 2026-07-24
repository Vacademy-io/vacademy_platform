package vacademy.io.admin_core_service.features.audience.enums;

/**
 * Soft-delete lifecycle of a single lead ({@code audience_response}) row.
 *
 * <p>Deliberately separate from the three status columns already on the row:
 * <ul>
 *   <li>{@code overall_status} — engagement/opt-out ({@code OPTED_OUT} means the LEAD asked
 *       us to stop contacting them; it is the person's own choice)</li>
 *   <li>{@code conversion_status} — where they are in the funnel</li>
 *   <li>{@code lead_status_id} — the institute's custom pipeline stage</li>
 * </ul>
 * This column is the ADMIN's curation decision — "I don't want this row in my CRM" — which is a
 * different axis from all three. A lead can be opted-out but still visible; a deleted lead is
 * hidden regardless of consent.</p>
 */
public enum AudienceStatusEnum {
    /** Normal, visible, eligible for sends. */
    ACTIVE,
    /** Admin soft-deleted: hidden from lead views and from every send recipient list. */
    INACTIVE
}
