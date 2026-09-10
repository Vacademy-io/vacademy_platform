package vacademy.io.admin_core_service.features.audience.dto;

import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Ids-only projection of the leads list, for "select all across pages".
 *
 * <p>Carries the three fields a selection actually needs — the response id it is keyed by, the
 * user id bulk actions operate on, and a display name for the confirm dialogs. Everything else
 * a {@code LeadDetailDTO} holds (score, tier, SLA deadlines, counsellor, follow-ups, the
 * auth_service user record) is there to paint a table row and costs a cross-service call plus
 * four IN-list queries per page to assemble. Select-all does not need any of it.</p>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
public class LeadIdsResponseDTO {

    /** The matching leads, capped at {@code MAX_SELECT_ALL_LEADS}. */
    private List<LeadIdItem> content;

    /** Total rows matching the filter — may exceed {@code content.size()} when truncated. */
    private long total;

    /**
     * True when {@code total} exceeded the select-all ceiling and {@code content} holds only the
     * first page of it. The UI must say so rather than let an admin believe a bulk action is
     * about to cover every matching lead.
     */
    private boolean truncated;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    @JsonNaming(PropertyNamingStrategies.SnakeCaseStrategy.class)
    public static class LeadIdItem {

        /** audience_response.id — what a row in the list is keyed by. */
        private String responseId;

        /** The lead's user id. Never blank: rows without one are dropped, since no bulk action
         *  can act on them. */
        private String userId;

        /** Display label only, from {@code audience_response.parent_name}; may be blank for leads
         *  whose name lives solely on the auth user. */
        private String name;
    }
}
