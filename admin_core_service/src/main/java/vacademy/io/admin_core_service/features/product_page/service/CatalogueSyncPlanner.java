package vacademy.io.admin_core_service.features.product_page.service;

import vacademy.io.admin_core_service.features.enroll_invite.util.EnrollInviteAvailabilityUtil;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/**
 * Decides what a catalogue sync does to a product page, without touching the
 * database: which catalogue courses to add, which existing mappings to switch
 * off, what to skip and what to warn about. ProductPageCatalogueSyncService
 * feeds it the page and the catalogue and applies the result.
 *
 * The rules:
 * <ul>
 *   <li>One mapping per catalogue package session the page does not sell yet,
 *       on the bridge row and plan the Courses page prices it with. Sessions
 *       the page already sells (on any row) are left exactly as they are.</li>
 *   <li>Not added: sessions with no ACTIVE bridge row, a closed invite
 *       (inactive, not started, expired), an inactive payment option, a CPO
 *       payment option (the cart checks out one CPO course at a time), or no
 *       ACTIVE plan.</li>
 *   <li>With deactivateMissing: a mapping whose session left the catalogue is
 *       switched off, and so is one sold through an inactive bridge row,
 *       invite, payment option or plan; its session is then added again from
 *       the catalogue when it can be sold.</li>
 *   <li>Never empties a page: when every mapping would go and nothing would be
 *       added (an empty catalogue, most likely a misconfiguration), nothing is
 *       switched off.</li>
 * </ul>
 */
final class CatalogueSyncPlanner {

    static final String LEFT_CATALOGUE = "left_catalogue";
    static final String BRIDGE_INACTIVE = "bridge_inactive";
    static final String INVITE_INACTIVE = "invite_inactive";
    static final String INVITE_NOT_STARTED = "invite_not_started";
    static final String INVITE_EXPIRED = "invite_expired";
    static final String PAYMENT_OPTION_INACTIVE = "payment_option_inactive";
    static final String CPO_NOT_SUPPORTED = "cpo_not_supported";
    static final String NO_ACTIVE_INVITE = "no_active_invite";
    static final String NO_ACTIVE_PLAN = "no_active_plan";
    static final String PLAN_INACTIVE = "plan_inactive";
    static final String PLAN_MISSING = "plan_missing";

    /** How many course names a warning lists before "and N more". */
    static final int NAMES_IN_WARNING = 5;

    private static final String ACTIVE = "ACTIVE";
    private static final String DEFAULT_TAG = "DEFAULT";

    private CatalogueSyncPlanner() {
    }

    /** A catalogue package session and the bridge row + plan the Courses page prices it with. */
    record Pick(String packageSessionId, String packageName, String levelName,
                String psliId, String inviteId, String inviteStatus, String inviteTag,
                Date inviteStartDate, Date inviteEndDate, String inviteVendor, String inviteCurrency,
                String paymentOptionId, String paymentOptionType, String paymentPlanId, String planCurrency) {
    }

    /** An ACTIVE mapping already on the page, with the state of everything it sells through. */
    record Row(String mappingId, int displayOrder, String packageSessionId, String packageName, String levelName,
               String bridgeId, String bridgeStatus,
               String inviteId, String inviteStatus, String inviteVendor, String inviteCurrency,
               boolean paymentOptionFound, String paymentOptionStatus, String paymentOptionType,
               String planId, boolean planFound, String planStatus, String planCurrency) {
    }

    record Add(Pick pick, int displayOrder) {
    }

    record Deactivation(Row row, String reason) {
    }

    record Skip(Pick pick, String reason) {
    }

    record Plan(List<Add> adds, List<Deactivation> deactivations, List<Skip> skipped, List<String> warnings) {
    }

    private record Additions(List<Pick> adds, List<Skip> skipped) {
    }

    static Plan plan(List<Row> rows, List<Pick> picks, boolean deactivateMissing) {
        Map<String, Pick> catalogue = new LinkedHashMap<>();
        for (Pick pick : picks) {
            if (pick.packageSessionId() != null) catalogue.putIfAbsent(pick.packageSessionId(), pick);
        }
        List<String> warnings = new ArrayList<>();

        List<Deactivation> deactivations = new ArrayList<>();
        if (deactivateMissing) {
            for (Row row : rows) {
                String reason = catalogue.containsKey(row.packageSessionId()) ? staleReason(row) : LEFT_CATALOGUE;
                if (reason != null) deactivations.add(new Deactivation(row, reason));
            }
        }
        Additions additions = additions(rows, deactivations, catalogue);

        if (!rows.isEmpty() && deactivations.size() == rows.size() && additions.adds().isEmpty()) {
            warnings.add(catalogue.isEmpty()
                    ? "The catalogue has no published courses, so nothing on this page was deactivated."
                    : "Every course on this page has left the catalogue or can no longer be sold, and nothing "
                    + "could be added, so nothing was deactivated rather than leave the page empty.");
            deactivations.clear();
            additions = additions(rows, deactivations, catalogue);
        }

        int next = rows.stream().mapToInt(Row::displayOrder).max().orElse(-1) + 1;
        List<Add> adds = new ArrayList<>();
        for (Pick pick : additions.adds()) {
            adds.add(new Add(pick, next++));
        }

        Set<String> leaving = new HashSet<>();
        for (Deactivation d : deactivations) leaving.add(d.row().mappingId());
        List<Row> kept = rows.stream().filter(r -> !leaving.contains(r.mappingId())).toList();
        warnings.addAll(warnings(kept, adds, catalogue));

        return new Plan(adds, deactivations, additions.skipped(), warnings);
    }

    /** Catalogue sessions with no remaining mapping: added when they can be sold, skipped (with why) when not. */
    private static Additions additions(List<Row> rows, List<Deactivation> deactivations, Map<String, Pick> catalogue) {
        Set<String> leaving = new HashSet<>();
        for (Deactivation d : deactivations) leaving.add(d.row().mappingId());
        Set<String> mapped = new HashSet<>();
        for (Row row : rows) {
            if (!leaving.contains(row.mappingId())) mapped.add(row.packageSessionId());
        }
        List<Pick> adds = new ArrayList<>();
        List<Skip> skipped = new ArrayList<>();
        for (Pick pick : catalogue.values()) {
            if (mapped.contains(pick.packageSessionId())) continue;
            String reason = skipReason(pick);
            if (reason == null) {
                adds.add(pick);
            } else {
                skipped.add(new Skip(pick, reason));
            }
        }
        return new Additions(adds, skipped);
    }

    /** Why a catalogue session cannot be sold from a product page; null when it can. */
    static String skipReason(Pick pick) {
        if (pick.psliId() == null) return NO_ACTIVE_INVITE;
        if (pick.inviteId() == null) return INVITE_INACTIVE;
        switch (EnrollInviteAvailabilityUtil.compute(
                pick.inviteStatus(), pick.inviteStartDate(), pick.inviteEndDate())) {
            case EnrollInviteAvailabilityUtil.INACTIVE:
                return INVITE_INACTIVE;
            case EnrollInviteAvailabilityUtil.NOT_STARTED:
                return INVITE_NOT_STARTED;
            case EnrollInviteAvailabilityUtil.EXPIRED:
                return INVITE_EXPIRED;
            default:
                break;
        }
        if (pick.paymentOptionId() == null) return PAYMENT_OPTION_INACTIVE;
        if ("CPO".equalsIgnoreCase(trim(pick.paymentOptionType()))) return CPO_NOT_SUPPORTED;
        if (pick.paymentPlanId() == null) return NO_ACTIVE_PLAN;
        return null;
    }

    /**
     * Why an existing mapping can no longer be sold; null when it still can.
     * Only an explicit non-ACTIVE status counts: rows written before statuses
     * were set carry none, and they sell fine today.
     */
    static String staleReason(Row row) {
        if (inactive(row.bridgeStatus())) return BRIDGE_INACTIVE;
        if (inactive(row.inviteStatus())) return INVITE_INACTIVE;
        if (!row.paymentOptionFound() || inactive(row.paymentOptionStatus())) return PAYMENT_OPTION_INACTIVE;
        if (!row.planFound()) return PLAN_MISSING;
        if (inactive(row.planStatus())) return PLAN_INACTIVE;
        return null;
    }

    private static List<String> warnings(List<Row> kept, List<Add> adds, Map<String, Pick> catalogue) {
        List<String> out = new ArrayList<>();

        Set<String> vendors = new TreeSet<>();
        Set<String> currencies = new TreeSet<>();
        for (Row row : kept) {
            addCode(vendors, row.inviteVendor());
            addCode(currencies, row.inviteCurrency());
            addCode(currencies, row.planCurrency());
        }
        for (Add add : adds) {
            addCode(vendors, add.pick().inviteVendor());
            addCode(currencies, add.pick().inviteCurrency());
            addCode(currencies, add.pick().planCurrency());
        }
        if (vendors.size() > 1) {
            out.add("Courses on this page are paid through more than one payment gateway (" + String.join(", ", vendors)
                    + "). Checkout charges the whole cart through the gateway of the first course in it.");
        }
        if (currencies.size() > 1) {
            out.add("Courses on this page are priced in more than one currency (" + String.join(", ", currencies)
                    + "). Checkout charges the whole cart in the currency of the first course in it.");
        }

        Map<String, List<Row>> bySession = new LinkedHashMap<>();
        for (Row row : kept) bySession.computeIfAbsent(row.packageSessionId(), k -> new ArrayList<>()).add(row);

        List<String> duplicated = new ArrayList<>();
        List<String> drifted = new ArrayList<>();
        List<String> stale = new ArrayList<>();
        List<String> outside = new ArrayList<>();
        for (List<Row> group : bySession.values()) {
            Row row = group.get(0);
            if (group.size() > 1) duplicated.add(label(row.packageName(), row.levelName()));
            Pick pick = catalogue.get(row.packageSessionId());
            if (pick == null) {
                outside.add(label(row.packageName(), row.levelName()));
            } else if (group.stream().anyMatch(r -> staleReason(r) != null)) {
                stale.add(label(row.packageName(), row.levelName()));
            } else if (group.size() == 1 && skipReason(pick) == null
                    && (!pick.psliId().equals(row.bridgeId()) || !pick.paymentPlanId().equals(row.planId()))) {
                drifted.add(label(row.packageName(), row.levelName()));
            }
        }
        if (!duplicated.isEmpty()) {
            out.add(count(duplicated) + " on this page more than once (for example on different plans): "
                    + names(duplicated) + ". A cart holding one of them selects every copy.");
        }
        if (!drifted.isEmpty()) {
            out.add(count(drifted) + " sold here through a different enrollment link or plan than the Courses page "
                    + "uses, so the price may differ: " + names(drifted)
                    + ". Remove them and sync again to use the Courses page price.");
        }
        if (!stale.isEmpty()) {
            out.add(count(stale) + " sold here through an inactive enrollment link, payment option or plan: "
                    + names(stale) + ".");
        }
        if (!outside.isEmpty()) {
            out.add(count(outside) + " on this page but not in the catalogue: " + names(outside) + ".");
        }

        List<String> nonDefault = new ArrayList<>();
        List<String> recurring = new ArrayList<>();
        for (Add add : adds) {
            Pick pick = add.pick();
            if (!DEFAULT_TAG.equalsIgnoreCase(trim(pick.inviteTag()))) {
                nonDefault.add(label(pick.packageName(), pick.levelName()));
            }
            String type = trim(pick.paymentOptionType());
            if ("SUBSCRIPTION".equalsIgnoreCase(type) || "DONATION".equalsIgnoreCase(type)) {
                recurring.add(label(pick.packageName(), pick.levelName()));
            }
        }
        if (!nonDefault.isEmpty()) {
            out.add(countAdded(nonDefault) + " through an enrollment link that is not the course's default one, "
                    + "because that is the link the Courses page prices them with: " + names(nonDefault) + ".");
        }
        if (!recurring.isEmpty()) {
            out.add(countAdded(recurring) + " on a subscription or donation payment option, which this page "
                    + "charges as a one-time payment: " + names(recurring) + ".");
        }
        return out;
    }

    private static boolean inactive(String status) {
        String s = trim(status);
        return s != null && !s.isEmpty() && !ACTIVE.equalsIgnoreCase(s);
    }

    private static void addCode(Set<String> into, String code) {
        String c = trim(code);
        if (c != null && !c.isEmpty()) into.add(c.toUpperCase(Locale.ROOT));
    }

    static String label(String packageName, String levelName) {
        String course = trim(packageName);
        String level = trim(levelName);
        if (course == null || course.isEmpty()) course = "Untitled course";
        if (level == null || level.isEmpty() || "DEFAULT".equalsIgnoreCase(level)) return course;
        return course + " (" + level + ")";
    }

    private static String names(List<String> labels) {
        List<String> distinct = new ArrayList<>(new LinkedHashSet<>(labels));
        if (distinct.size() <= NAMES_IN_WARNING) return String.join(", ", distinct);
        return String.join(", ", distinct.subList(0, NAMES_IN_WARNING))
                + " and " + (distinct.size() - NAMES_IN_WARNING) + " more";
    }

    private static String count(List<String> labels) {
        return labels.size() == 1 ? "1 course is" : labels.size() + " courses are";
    }

    private static String countAdded(List<String> labels) {
        return labels.size() == 1 ? "1 course was added" : labels.size() + " courses were added";
    }

    private static String trim(String s) {
        return s == null ? null : s.trim();
    }
}
