package vacademy.io.admin_core_service.features.product_page.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Prices a basket as a WHOLE, instead of adding up what each course costs.
 *
 * Some catalogues do not sell courses at a price each — they sell "pick any 3
 * for ₹799, ₹150 for each one after that". iThinkers Olympiad is one: every
 * course on the page is ₹0 because the money is a function of how many subjects
 * the parent picks, not which. Summing item prices there yields ₹0 forever, so
 * when this is configured it REPLACES the sum rather than discounting it.
 *
 * Configured under `basketPricing` in the product page's settings_json:
 *
 *   ladder            prices[] for a basket of 1, 2, 3 … plus perExtra for each
 *                     one beyond the last listed price.
 *   groups            label → the level names belonging to it. No groups
 *                     configured means the whole basket is one group.
 *   ladderScope       GROUP (default) runs the ladder inside each group, so a
 *                     parent buying one subject each for two children pays two
 *                     single-subject prices rather than collecting a sibling
 *                     discount. BASKET runs it across everything, so those two
 *                     subjects reach the two-subject price. Which one is right
 *                     is a commercial decision, not a technical one — hence the
 *                     switch. Full packs and combos stay per-group either way,
 *                     because a "full grade pack" only means something within
 *                     one grade.
 *   groups[].packPrice  price for taking EVERY level in that group — the "full
 *                     grade pack". Exact per group, so it keeps working when a
 *                     class gains or loses a subject.
 *   wholeGroupPrices  count → price, the older fallback for groups with no
 *                     packPrice of their own. Fragile: a class that gains a
 *                     subject lands on a different count's price.
 *   combos            a named set of package names at a fixed price, matched
 *                     within a group ("English + Maths + Science = ₹749").
 *                     Matched on package rather than level so one entry covers
 *                     every class.
 *
 * Whichever of those yields the LOWEST price for a group wins — a bigger
 * selection must never cost more than a smaller one.
 *
 * Groups are matched against admin-authored level lists, never by parsing a
 * class out of a level name: the real names drift ("Cyber AI- Class 6",
 * "Social Science Class - 5") and one course is filed under another subject's
 * level entirely.
 *
 * THIS IS THE AUTHORITATIVE COPY — ProductPageEnrollmentService overwrites the
 * client's amount with what this returns. basket-pricing.ts mirrors it for
 * display and the two must be changed together.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class BasketPricingCalculator {

    private final ObjectMapper objectMapper = new ObjectMapper();

    /** One selected course, reduced to the only two things pricing cares about. */
    public record BasketItem(String levelName, String packageName) {
    }

    /** What a basket costs, and the per-group breakdown behind it. */
    @Getter
    public static class BasketPrice {
        private final double total;
        private final List<String> breakdown = new ArrayList<>();

        BasketPrice(double total) {
            this.total = total;
        }
    }

    private static String key(String value) {
        return value == null ? "" : value.trim().toLowerCase();
    }

    /**
     * The basket's price, or null when this page does not use basket pricing —
     * in which case the caller keeps summing item prices as before.
     */
    public BasketPrice price(String settingsJson, List<BasketItem> items) {
        if (settingsJson == null || settingsJson.isBlank() || items == null || items.isEmpty()) {
            return null;
        }

        try {
            JsonNode cfg = objectMapper.readTree(settingsJson).path("basketPricing");
            if (!cfg.path("enabled").asBoolean(false)) {
                return null;
            }

            List<Double> ladder = new ArrayList<>();
            for (JsonNode p : cfg.path("ladder").path("prices")) {
                ladder.add(p.asDouble(0));
            }
            double perExtra = cfg.path("ladder").path("perExtra").asDouble(0);
            if (ladder.isEmpty()) {
                // Nothing to price with. Better to fall back to item prices than
                // to hand back a free basket.
                return null;
            }

            Map<String, List<BasketItem>> grouped = groupItems(cfg.path("groups"), items);
            boolean ladderAcrossBasket = "BASKET".equalsIgnoreCase(cfg.path("ladderScope").asText("GROUP"));

            double total = 0;
            List<String> lines = new ArrayList<>();

            for (Map.Entry<String, List<BasketItem>> entry : grouped.entrySet()) {
                GroupQuote quote = priceGroup(cfg, entry.getKey(), entry.getValue(), ladder, perExtra);
                total += quote.amount;
                lines.add(quote.label);
            }

            if (ladderAcrossBasket) {
                // One ladder over every subject in the basket. Still never worse
                // than pricing the groups apart — a full pack or combo inside one
                // group can beat it, so take whichever is cheaper.
                double whole = ladderPrice(ladder, perExtra, items.size());
                if (whole < total) {
                    total = whole;
                    lines.clear();
                    lines.add(items.size() + " subject" + (items.size() == 1 ? "" : "s"));
                }
            }

            BasketPrice priced = new BasketPrice(Math.max(0, Math.round(total)));
            priced.breakdown.addAll(lines);
            return priced;

        } catch (Exception e) {
            // A page must stay sellable through a bad settings blob.
            log.warn("Could not read basketPricing from product page settings: {}", e.getMessage());
            return null;
        }
    }

    /** Splits the basket by configured group; anything unmatched shares one bucket. */
    private Map<String, List<BasketItem>> groupItems(JsonNode groups, List<BasketItem> items) {
        Map<String, List<BasketItem>> out = new LinkedHashMap<>();

        Map<String, String> levelToGroup = new LinkedHashMap<>();
        if (groups.isArray()) {
            for (JsonNode group : groups) {
                String label = group.path("label").asText("");
                for (JsonNode level : group.path("levels")) {
                    levelToGroup.put(key(level.asText()), label);
                }
            }
        }

        for (BasketItem item : items) {
            String label = levelToGroup.getOrDefault(key(item.levelName()), "");
            out.computeIfAbsent(label, k -> new ArrayList<>()).add(item);
        }
        return out;
    }

    private record GroupQuote(double amount, String label) {
    }

    private GroupQuote priceGroup(JsonNode cfg, String groupLabel, List<BasketItem> picked,
            List<Double> ladder, double perExtra) {
        int count = picked.size();

        double best = ladderPrice(ladder, perExtra, count);
        String how = count + " subject" + (count == 1 ? "" : "s");

        // Full pack: every level configured for this group is in the basket.
        Double wholeGroup = wholeGroupPrice(cfg, groupLabel, picked, count);
        if (wholeGroup != null && wholeGroup < best) {
            best = wholeGroup;
            how = "full pack";
        }

        // Named combo: the group's packages are exactly a combo's set.
        Set<String> pickedPackages = new LinkedHashSet<>();
        for (BasketItem item : picked) {
            pickedPackages.add(key(item.packageName()));
        }
        for (JsonNode combo : cfg.path("combos")) {
            Set<String> comboPackages = new LinkedHashSet<>();
            for (JsonNode name : combo.path("packages")) {
                comboPackages.add(key(name.asText()));
            }
            if (!comboPackages.isEmpty() && comboPackages.equals(pickedPackages)) {
                double comboPrice = combo.path("price").asDouble(Double.MAX_VALUE);
                if (comboPrice < best) {
                    best = comboPrice;
                    how = combo.path("label").asText("combo");
                }
            }
        }

        String label = (groupLabel == null || groupLabel.isBlank() ? "Basket" : groupLabel)
                + " — " + how;
        return new GroupQuote(best, label);
    }

    private Double wholeGroupPrice(JsonNode cfg, String groupLabel, List<BasketItem> picked, int count) {
        if (groupLabel == null || groupLabel.isBlank()) {
            return null;
        }
        Set<String> configured = new LinkedHashSet<>();
        Double ownPackPrice = null;
        for (JsonNode group : cfg.path("groups")) {
            if (groupLabel.equals(group.path("label").asText(""))) {
                for (JsonNode level : group.path("levels")) {
                    configured.add(key(level.asText()));
                }
                JsonNode own = group.path("packPrice");
                if (!own.isMissingNode() && own.asDouble(0) > 0) {
                    ownPackPrice = own.asDouble();
                }
            }
        }
        if (configured.isEmpty()) {
            return null;
        }
        Set<String> pickedLevels = new LinkedHashSet<>();
        for (BasketItem item : picked) {
            pickedLevels.add(key(item.levelName()));
        }
        if (!pickedLevels.containsAll(configured)) {
            return null;
        }
        // A price on the group itself is exact and survives the catalogue
        // changing shape. The count map is the older, fragile fallback: add one
        // subject to a class and its count silently lands on another class's
        // price.
        if (ownPackPrice != null) {
            return ownPackPrice;
        }
        JsonNode price = cfg.path("wholeGroupPrices").path(String.valueOf(count));
        return price.isMissingNode() ? null : price.asDouble();
    }

    /** prices[n-1] while the list lasts, then the last price plus perExtra each. */
    private double ladderPrice(List<Double> prices, double perExtra, int count) {
        if (count <= 0) {
            return 0;
        }
        if (count <= prices.size()) {
            return prices.get(count - 1);
        }
        return prices.get(prices.size() - 1) + perExtra * (count - prices.size());
    }
}
