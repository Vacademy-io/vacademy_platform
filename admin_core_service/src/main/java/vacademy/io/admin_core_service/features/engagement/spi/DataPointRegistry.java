package vacademy.io.admin_core_service.features.engagement.spi;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Auto-collects every DataPointProvider bean (the RecipientResolverRegistry idiom).
 * hydrate() = one fetch per selected provider per cohort.
 *
 * Failure contract: a throwing provider marks the WHOLE bundle incomplete and the decision
 * loop defers those members (re-lease) — it never feeds the model an empty block, because
 * "the fetch failed" and "this learner has no data" must never be the same input.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class DataPointRegistry {

    private final List<DataPointProvider> providers;

    public List<DataPointProvider> all() {
        return providers;
    }

    public DataPointProvider byKey(String key) {
        return providers.stream().filter(p -> p.key().equals(key)).findFirst().orElse(null);
    }

    /** Selected + always-on providers, unknown keys warned and skipped (forward-compatible). */
    public List<DataPointProvider> resolveSelection(List<String> selectedKeys) {
        List<DataPointProvider> resolved = new ArrayList<>();
        for (DataPointProvider p : providers) {
            if (p.alwaysOn() || (selectedKeys != null && selectedKeys.contains(p.key()))) {
                resolved.add(p);
            }
        }
        if (selectedKeys != null) {
            for (String key : selectedKeys) {
                if (byKey(key) == null) {
                    log.warn("Engine selected unknown data point '{}' — skipped (provider removed/renamed?)", key);
                }
            }
        }
        return resolved;
    }

    /**
     * providerKey → (memberId → payload). Throws on the FIRST provider failure — the caller
     * defers the cohort rather than deciding on partial context.
     */
    public CohortBundle hydrate(FetchContext ctx, List<String> selectedKeys, List<Subject> subjects) {
        Map<String, Map<String, JsonNode>> byProvider = new LinkedHashMap<>();
        List<DataPointProvider> selection = resolveSelection(selectedKeys);
        for (DataPointProvider p : selection) {
            byProvider.put(p.key(), p.fetch(ctx, subjects)); // provider failure propagates
        }
        return new CohortBundle(selection, byProvider);
    }

    /** Immutable hydration result for one cohort. */
    public record CohortBundle(List<DataPointProvider> selection,
                               Map<String, Map<String, JsonNode>> byProvider) {

        /** Rendered prompt blocks for one member, in provider order. */
        public Map<String, String> renderFor(String memberId) {
            Map<String, String> blocks = new LinkedHashMap<>();
            for (DataPointProvider p : selection) {
                JsonNode payload = byProvider.getOrDefault(p.key(), Map.of()).get(memberId);
                blocks.put(p.key(), p.render(payload));
            }
            return blocks;
        }

        /** Raw payloads for one member (fingerprinting). */
        public Map<String, JsonNode> payloadsFor(String memberId) {
            Map<String, JsonNode> out = new HashMap<>();
            for (DataPointProvider p : selection) {
                JsonNode payload = byProvider.getOrDefault(p.key(), Map.of()).get(memberId);
                if (payload != null) out.put(p.key(), payload);
            }
            return out;
        }
    }
}
