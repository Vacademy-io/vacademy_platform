package vacademy.io.admin_core_service.features.audience.dto;

import lombok.Builder;
import lombok.Data;
import lombok.Singular;

import java.util.List;

/**
 * Safe representation of a Facebook Page returned to the frontend.
 * Contains only id and name — the page access token is never exposed.
 *
 * Also carries the connecting user's page tasks so the UI can warn BEFORE
 * connecting: subscribing a Page to lead webhooks requires the {@code MANAGE}
 * task (Full control). An account with only {@code MANAGE_LEADS}/{@code ADVERTISE}
 * can read leads but Meta rejects the webhook subscribe with error #200, so the
 * connector would silently never receive leads.
 */
@Data
@Builder
public class MetaPageDTO {
    private String id;
    private String name;

    /** Tasks the connecting user holds on this Page (MANAGE, MANAGE_LEADS, ADVERTISE, ...). */
    @Singular("task")
    private List<String> tasks;

    /** True when {@link #tasks} contains MANAGE — required to receive leads automatically. */
    private boolean hasManageTask;

    /** Same as {@link #hasManageTask}; named for the UI ("can this page receive leads?"). */
    private boolean canReceiveLeads;

    /** Non-null warning to show next to a page the user can pick but that won't deliver leads. */
    private String warning;
}
