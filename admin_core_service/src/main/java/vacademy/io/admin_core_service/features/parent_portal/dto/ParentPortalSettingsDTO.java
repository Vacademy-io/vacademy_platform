package vacademy.io.admin_core_service.features.parent_portal.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Map;

/**
 * Resolved parent-portal configuration for one institute, read from
 * {@code PARENT_SETTING.data.parentPortal}. All fields default so an institute
 * that has never configured the portal deserializes cleanly (portal off).
 *
 * <p>These are <b>authorization boundaries enforced server-side</b>, not just UI
 * hints: a hidden-but-reachable module endpoint would still be a breach, so each
 * BFF handler consults this. Contrast with STUDENT_DISPLAY_SETTINGS, which only
 * gates learner UI tabs.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ParentPortalSettingsDTO {

    /** Master gate. Default false — the portal is opt-in per institute. */
    private boolean enabled;

    /** module key -> visible. Keys: overview, attendance, liveSessions, assessments,
     *  progress, payments, badges, certificates, reports. */
    private Map<String, Boolean> modules;

    /** "COMPLETED_ONLY" (default) etc. — which reports a parent may open. */
    private String reportAccess;

    /** "View as my child" gate. Default true once the portal is enabled. */
    private boolean allowViewAsChild;

    /** Show a "Switch to Parent view" action for dual-role (STUDENT+PARENT) users. */
    private boolean allowSwitchToParentView;
}
