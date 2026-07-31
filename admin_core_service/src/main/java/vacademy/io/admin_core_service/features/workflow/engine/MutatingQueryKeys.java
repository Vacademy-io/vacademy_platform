package vacademy.io.admin_core_service.features.workflow.engine;

import java.util.Set;

/**
 * Prebuilt query keys that WRITE (create sessions/schedules/participants, upsert
 * custom fields, ...). Single source of truth shared by the execution gates
 * (QueryNodeHandler + IteratorProcessorStrategy skip these when the context has
 * dryRun=true, so Test Run cannot mutate) and the AI catalog (which documents
 * them as allowed-with-care instead of forbidden).
 */
public final class MutatingQueryKeys {

    public static final Set<String> KEYS = Set.of(
            "createLiveSession",
            "createSessionSchedule",
            "createSessionParticipent",
            "upsertUserCustomField",
            "updateSSIGMRemaingDaysByOne");

    private MutatingQueryKeys() {
    }

    public static boolean isMutating(String prebuiltKey) {
        if (prebuiltKey == null) {
            return false;
        }
        return KEYS.stream().anyMatch(k -> k.equalsIgnoreCase(prebuiltKey));
    }
}
