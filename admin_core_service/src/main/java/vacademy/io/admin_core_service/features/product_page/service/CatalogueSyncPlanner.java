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
import java.util.Objects;
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
 *       on its open DEFAULT invite's bridge row and that row's cheapest ACTIVE
 *       plan (ProductPageCatalogueRepository chooses the row). Sessions the
 *       page already sells (on any row) are left exactly as they are.</li>
 *   <li>Not added: sessions with no ACTIVE bridge row, no open DEFAULT invite
 *       (a scholarship or promo link must never set the store's price), a
 *       closed default invite (inactive, not started, expired), an inactive
 *       payment option, a CPO payment option (the cart checks out one CPO
 *       course at a time), or no ACTIVE plan.</li>
 *   <li>Not added either: a course on another payment gateway or in another
 *       currency than the page (one checkout charges one gateway and one
 *       currency), or one whose invite and plan name different currencies.
 *       The page's gateway and currency are its first remaining course's (the
 *       ones the learner page shows); on an empty page, the first course
 *       added. Courses already on the page are never changed by this; mixed
 *       ones are reported in the warnings.</li>
 *   <li>A free course (plan price 0) is charged nothing, so only its gateway
 *       counts: the first course in a cart still picks the gateway. Its
 *       currency is often only a default label (free plans are created in
 *       INR, or GBP by the admin app), so it neither sets the page's currency
 *       nor keeps the course off the page, exactly as checkout ignores it.</li>
 *   <li>With deactivateMissing: a mapping whose session left the catalogue is
 *       switched off, and so is one sold through an inactive bridge row,
 *       payment option or plan, or a closed invite (inactive, not started,
 *       expired: the rule sessions are added by); its session is then added
 *       again from the catalogue when it can be sold.</li>
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
    static final String NON_DEFAULT_INVITE = "non_default_invite";
    static final String CURRENCY_MISMATCH = "currency_mismatch";
    static final String VENDOR_MISMATCH = "vendor_mismatch";

    /** How many course names a warning lists before "and N more". */
    static final int NAMES_IN_WARNING = 5;

    private static final String ACTIVE = "ACTIVE";
    private static final String DEFAULT_TAG = "DEFAULT";

    private CatalogueSyncPlanner() {
    }

    /** A catalogue package session and the bridge row + plan the catalogue query chose for it. */
    record Pick(String packageSessionId, String packageName, String levelName,
                String psliId, String inviteId, String inviteStatus, String inviteTag,
                Date inviteStartDate, Date inviteEndDate, String inviteVendor, String inviteCurrency,
                String paymentOptionId, String paymentOptionType, String paymentPlanId, Double planPrice,
                String planCurrency) {
    }

    /** An ACTIVE mapping already on the page, with the state of everything it sells through. */
    record Row(String mappingId, int displayOrder, String packageSessionId, String packageName, String levelName,
               String bridgeId, String bridgeStatus,
               String inviteId, String inviteStatus, Date inviteStartDate, Date inviteEndDate,
               String inviteVendor, String inviteCurrency,
               boolean paymentOptionFound, String paymentOptionStatus, String paymentOptionType,
               String planId, boolean planFound, String planStatus, Double planPrice, String planCurrency) {
    }

    /** How the gateway warning names invites that set none (checkout then uses the institute's default). */
    static final String DEFAULT_GATEWAY_LABEL = "institute default";

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
        List<Row> kept = new ArrayList<>();
        Set<String> mapped = new HashSet<>();
        for (Row row : rows) {
            if (leaving.contains(row.mappingId())) continue;
            kept.add(row);
            mapped.add(row.packageSessionId());
        }
        List<Pick> candidates = new ArrayList<>();
        for (Pick pick : catalogue.values()) {
            if (!mapped.contains(pick.packageSessionId())) candidates.add(pick);
        }
        Terms page = pageTerms(kept, candidates);
        List<Pick> adds = new ArrayList<>();
        List<Skip> skipped = new ArrayList<>();
        for (Pick pick : candidates) {
            String reason = skipReason(pick);
            if (reason == null) reason = termsReason(pick, page);
            if (reason == null) {
                adds.add(pick);
            } else {
                skipped.add(new Skip(pick, reason));
            }
        }
        return new Additions(adds, skipped);
    }

    /**
     * The gateway and currency every course added to the page must share.
     * Null fields: an invite naming no gateway (vendor), or nothing on the
     * page naming a currency yet (currency, which then constrains nothing).
     */
    record Terms(String vendor, String currency) {
    }

    /**
     * What the page charges through: the first remaining row's gateway, as
     * the learner page shows it (by-code reads its first mapping), and the
     * first currency a remaining priced row names (invite currency, else
     * plan currency: the order checkout reads them in). A page with no rows
     * left takes its gateway from the first course that can be added to it,
     * and a page whose priced rows name no currency takes its currency from
     * the first priced course on that gateway naming one, so the course that
     * decides always goes in. A free course can set the gateway, never the
     * currency. Visible for testing.
     */
    static Terms pageTerms(List<Row> kept, List<Pick> candidates) {
        List<Pick> sellable = new ArrayList<>();
        for (Pick pick : candidates) {
            if (skipReason(pick) == null && !mixedCurrencies(pick)) sellable.add(pick);
        }
        String vendor = !kept.isEmpty() ? code(kept.get(0).inviteVendor())
                : !sellable.isEmpty() ? code(sellable.get(0).inviteVendor()) : null;
        String currency = null;
        for (Row row : kept) {
            if (!priced(row.planPrice())) continue;
            currency = firstCode(row.inviteCurrency(), row.planCurrency());
            if (currency != null) return new Terms(vendor, currency);
        }
        for (Pick pick : sellable) {
            if (!priced(pick.planPrice())) continue;
            // A course on another gateway is skipped anyway; it decides nothing.
            if (!Objects.equals(code(pick.inviteVendor()), vendor)) continue;
            currency = firstCode(pick.inviteCurrency(), pick.planCurrency());
            if (currency != null) return new Terms(vendor, currency);
        }
        return new Terms(vendor, null);
    }

    /**
     * Why a sellable catalogue session still cannot join this page; null when
     * it can. Checkout charges a whole cart in one currency through one
     * gateway, so a course on any other would be charged wrongly or fail. A
     * course whose invite and plan disagree on the currency would be charged
     * its plan's price in its invite's currency, whatever the page. A free
     * course is charged nothing, so only its gateway is checked.
     */
    static String termsReason(Pick pick, Terms page) {
        if (mixedCurrencies(pick)) return CURRENCY_MISMATCH;
        String currency = priced(pick.planPrice()) ? firstCode(pick.inviteCurrency(), pick.planCurrency()) : null;
        if (currency != null && page.currency() != null && !currency.equals(page.currency())) {
            return CURRENCY_MISMATCH;
        }
        if (!Objects.equals(code(pick.inviteVendor()), page.vendor())) return VENDOR_MISMATCH;
        return null;
    }

    /** A priced course whose invite and plan name different currencies. A free one is charged in neither. */
    private static boolean mixedCurrencies(Pick pick) {
        if (!priced(pick.planPrice())) return false;
        String invite = code(pick.inviteCurrency());
        String plan = code(pick.planCurrency());
        return invite != null && plan != null && !invite.equals(plan);
    }

    /**
     * A course that costs something. A free one (price 0, or no plan) is
     * charged nothing, so its currency decides nothing: the rule checkout
     * uses (ProductPageEnrollmentService.checkoutCurrency).
     */
    private static boolean priced(Double price) {
        return price != null && price > 0;
    }

    /** Why a catalogue session cannot be sold from a product page; null when it can. */
    static String skipReason(Pick pick) {
        if (pick.psliId() == null) return NO_ACTIVE_INVITE;
        if (pick.inviteId() == null) return INVITE_INACTIVE;
        // The catalogue query prefers an open DEFAULT invite's row, so any
        // other invite here means the course has no open default link. Its
        // own (scholarship, promo, private) link would set the store's price
        // and enrollment settings for every buyer, so it is never added
        // silently; a closed DEFAULT link is reported as closed below.
        if (!DEFAULT_TAG.equalsIgnoreCase(trim(pick.inviteTag()))) return NON_DEFAULT_INVITE;
        String closed = closedInviteReason(pick.inviteStatus(), pick.inviteStartDate(), pick.inviteEndDate());
        if (closed != null) return closed;
        if (pick.paymentOptionId() == null) return PAYMENT_OPTION_INACTIVE;
        if ("CPO".equalsIgnoreCase(trim(pick.paymentOptionType()))) return CPO_NOT_SUPPORTED;
        if (pick.paymentPlanId() == null) return NO_ACTIVE_PLAN;
        return null;
    }

    /**
     * Why an existing mapping can no longer be sold; null when it still can.
     * Only an explicit non-ACTIVE status counts: rows written before statuses
     * were set carry none, and they sell fine today. The invite is held to the
     * rule a catalogue session is added by (skipReason): one whose enrollment
     * window has closed, or not opened yet, is no longer sold either, exactly
     * when the Courses page badges the course as closed.
     */
    static String staleReason(Row row) {
        if (inactive(row.bridgeStatus())) return BRIDGE_INACTIVE;
        if (inactive(row.inviteStatus())) return INVITE_INACTIVE;
        // The status was judged just above, as leniently as every other status
        // here; only the enrollment window is left to check.
        String closed = closedInviteReason(null, row.inviteStartDate(), row.inviteEndDate());
        if (closed != null) return closed;
        if (!row.paymentOptionFound() || inactive(row.paymentOptionStatus())) return PAYMENT_OPTION_INACTIVE;
        if (!row.planFound()) return PLAN_MISSING;
        if (inactive(row.planStatus())) return PLAN_INACTIVE;
        return null;
    }

    /**
     * An invite that does not accept enrollments now, by the rule the Courses
     * page and the enrollment guard use (EnrollInviteAvailabilityUtil); null
     * when it is open.
     */
    private static String closedInviteReason(String status, Date startDate, Date endDate) {
        switch (EnrollInviteAvailabilityUtil.compute(status, startDate, endDate)) {
            case EnrollInviteAvailabilityUtil.INACTIVE:
                return INVITE_INACTIVE;
            case EnrollInviteAvailabilityUtil.NOT_STARTED:
                return INVITE_NOT_STARTED;
            case EnrollInviteAvailabilityUtil.EXPIRED:
                return INVITE_EXPIRED;
            default:
                return null;
        }
    }

    private static List<String> warnings(List<Row> kept, List<Add> adds, Map<String, Pick> catalogue) {
        List<String> out = new ArrayList<>();

        Set<String> vendors = new TreeSet<>();
        // What each course is charged in: its invite's currency, else its plan's.
        Set<String> currencies = new TreeSet<>();
        List<String> splitCurrency = new ArrayList<>();
        // An invite that names no gateway pays through the institute's default
        // one, which is a gateway of its own as far as the cart is concerned.
        boolean defaultGateway = false;
        for (Row row : kept) {
            defaultGateway |= blank(row.inviteVendor());
            addCode(vendors, row.inviteVendor());
            // A free course is charged nothing: checkout ignores its currency.
            if (priced(row.planPrice())) {
                addCode(currencies, firstCode(row.inviteCurrency(), row.planCurrency()));
                String invite = code(row.inviteCurrency());
                String plan = code(row.planCurrency());
                if (invite != null && plan != null && !invite.equals(plan)) {
                    splitCurrency.add(label(row.packageName(), row.levelName()));
                }
            }
        }
        for (Add add : adds) {
            defaultGateway |= blank(add.pick().inviteVendor());
            addCode(vendors, add.pick().inviteVendor());
            if (priced(add.pick().planPrice())) {
                addCode(currencies, firstCode(add.pick().inviteCurrency(), add.pick().planCurrency()));
            }
        }
        List<String> gateways = new ArrayList<>(vendors);
        if (defaultGateway && !vendors.isEmpty()) gateways.add(DEFAULT_GATEWAY_LABEL);
        if (gateways.size() > 1) {
            out.add("Courses on this page are paid through more than one payment gateway (" + String.join(", ", gateways)
                    + "). Checkout charges the whole cart through the gateway of the first course in it.");
        }
        if (currencies.size() > 1) {
            out.add("Courses on this page are priced in more than one currency (" + String.join(", ", currencies)
                    + "). Checkout refuses a cart that mixes them, so visitors have to buy them separately.");
        }
        if (!splitCurrency.isEmpty()) {
            out.add(count(splitCurrency) + " charged in the currency the enrollment link names, not the one the "
                    + "plan names: " + names(splitCurrency) + ". Check that the price is right.");
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
            out.add(count(drifted) + " sold here through a different enrollment link or plan than the course's "
                    + "default one, so the price may differ: " + names(drifted)
                    + ". Remove them and sync again to sell them through the default link.");
        }
        if (!stale.isEmpty()) {
            out.add(count(stale) + " sold here through an inactive or closed enrollment link, payment option or plan: "
                    + names(stale) + ".");
        }
        if (!outside.isEmpty()) {
            out.add(count(outside) + " on this page but not in the catalogue: " + names(outside) + ".");
        }

        List<String> recurring = new ArrayList<>();
        for (Add add : adds) {
            Pick pick = add.pick();
            String type = trim(pick.paymentOptionType());
            if ("SUBSCRIPTION".equalsIgnoreCase(type) || "DONATION".equalsIgnoreCase(type)) {
                recurring.add(label(pick.packageName(), pick.levelName()));
            }
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
        String c = code(code);
        if (c != null) into.add(c);
    }

    /** A gateway or currency code, compared without case or padding; null when blank. */
    private static String code(String s) {
        return blank(s) ? null : s.trim().toUpperCase(Locale.ROOT);
    }

    private static String firstCode(String first, String second) {
        String c = code(first);
        return c != null ? c : code(second);
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
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
