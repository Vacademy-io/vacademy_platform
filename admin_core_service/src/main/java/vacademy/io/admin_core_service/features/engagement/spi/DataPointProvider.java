package vacademy.io.admin_core_service.features.engagement.spi;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.List;
import java.util.Map;

/**
 * One pluggable data point the brain can read. Spring collects every @Component implementation
 * into the registry automatically (the RecipientResolverRegistry idiom) — adding a data point
 * is ONE new file, zero core edits.
 *
 * fetch() takes the WHOLE cohort: the plural signature makes an N+1 unrepresentable. A provider
 * that fails must THROW (the decision loop defers the affected members) — never return an empty
 * map on error: a 500 from a sibling service and "this learner has no data" must never become
 * the same input to the model.
 */
public interface DataPointProvider {

    /** Stable key stored in engagement_engine.data_points, e.g. "crm_lead". */
    String key();

    /** Always-on providers are hydrated for every engine regardless of selection. */
    boolean alwaysOn();

    /** Catalog entry: label, description (LLM-facing), sensitivity, cost hint. */
    DataPointSpec declare();

    /**
     * One batched fetch per cohort. Returns member.id → payload for members that HAVE data;
     * absence means "no data", which render() must express honestly.
     */
    Map<String, JsonNode> fetch(FetchContext ctx, List<Subject> subjects);

    /** Compact prompt block for one member's payload (null payload = "no data" line). */
    String render(JsonNode payload);
}
