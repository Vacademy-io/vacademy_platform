package vacademy.io.admin_core_service.features.product_page.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * The catalogue sync's decisions: what a store page gains, loses and skips
 * when it is filled from the catalogue. Pure logic, no database.
 */
class CatalogueSyncPlannerTest {

    private static final long DAY = 24L * 60 * 60 * 1000;

    /** A sellable catalogue session: ACTIVE DEFAULT invite, ONE_TIME option, INR plan. */
    private static CatalogueSyncPlanner.Pick pick(String session) {
        return new CatalogueSyncPlanner.Pick(session, "Course " + session, "Hindi",
                "psli-" + session, "inv-" + session, "ACTIVE", "DEFAULT", null, null, "RAZORPAY", "INR",
                "po-" + session, "ONE_TIME", "plan-" + session, "INR");
    }

    private static CatalogueSyncPlanner.Pick with(CatalogueSyncPlanner.Pick p, String field, Object value) {
        return new CatalogueSyncPlanner.Pick(p.packageSessionId(), p.packageName(), p.levelName(),
                field.equals("psli") ? (String) value : p.psliId(),
                field.equals("invite") ? (String) value : p.inviteId(),
                field.equals("inviteStatus") ? (String) value : p.inviteStatus(),
                field.equals("inviteTag") ? (String) value : p.inviteTag(),
                field.equals("start") ? (Date) value : p.inviteStartDate(),
                field.equals("end") ? (Date) value : p.inviteEndDate(),
                field.equals("vendor") ? (String) value : p.inviteVendor(),
                field.equals("inviteCurrency") ? (String) value : p.inviteCurrency(),
                field.equals("option") ? (String) value : p.paymentOptionId(),
                field.equals("optionType") ? (String) value : p.paymentOptionType(),
                field.equals("plan") ? (String) value : p.paymentPlanId(),
                field.equals("planCurrency") ? (String) value : p.planCurrency());
    }

    /** A healthy existing mapping on the catalogue's own bridge row and plan for its session. */
    private static CatalogueSyncPlanner.Row row(String mappingId, int order, String session) {
        return new CatalogueSyncPlanner.Row(mappingId, order, session, "Course " + session, "Hindi",
                "psli-" + session, "ACTIVE", "inv-" + session, "ACTIVE", "RAZORPAY", "INR",
                true, "ACTIVE", "ONE_TIME", "plan-" + session, true, "ACTIVE", "INR");
    }

    private static CatalogueSyncPlanner.Row rowWith(CatalogueSyncPlanner.Row r, String field, Object value) {
        return new CatalogueSyncPlanner.Row(r.mappingId(), r.displayOrder(), r.packageSessionId(), r.packageName(),
                r.levelName(),
                field.equals("bridge") ? (String) value : r.bridgeId(),
                field.equals("bridgeStatus") ? (String) value : r.bridgeStatus(),
                r.inviteId(),
                field.equals("inviteStatus") ? (String) value : r.inviteStatus(),
                field.equals("vendor") ? (String) value : r.inviteVendor(),
                r.inviteCurrency(),
                field.equals("optionFound") ? (Boolean) value : r.paymentOptionFound(),
                field.equals("optionStatus") ? (String) value : r.paymentOptionStatus(),
                r.paymentOptionType(),
                field.equals("plan") ? (String) value : r.planId(),
                field.equals("planFound") ? (Boolean) value : r.planFound(),
                field.equals("planStatus") ? (String) value : r.planStatus(),
                field.equals("planCurrency") ? (String) value : r.planCurrency());
    }

    private static List<String> addedSessions(CatalogueSyncPlanner.Plan plan) {
        return plan.adds().stream().map(a -> a.pick().packageSessionId()).toList();
    }

    private static List<String> deactivatedIds(CatalogueSyncPlanner.Plan plan) {
        return plan.deactivations().stream().map(d -> d.row().mappingId() + ":" + d.reason()).toList();
    }

    private static List<String> skippedReasons(CatalogueSyncPlanner.Plan plan) {
        return plan.skipped().stream().map(s -> s.pick().packageSessionId() + ":" + s.reason()).toList();
    }

    private static boolean warns(CatalogueSyncPlanner.Plan plan, String fragment) {
        return plan.warnings().stream().anyMatch(w -> w.contains(fragment));
    }

    @Test
    @DisplayName("an empty page gets every catalogue session, in catalogue order, from display order 0")
    void fillsAnEmptyPage() {
        CatalogueSyncPlanner.Plan plan = CatalogueSyncPlanner.plan(List.of(),
                List.of(pick("a"), pick("b"), pick("c")), true);

        assertEquals(List.of("a", "b", "c"), addedSessions(plan));
        assertEquals(List.of(0, 1, 2), plan.adds().stream().map(CatalogueSyncPlanner.Add::displayOrder).toList());
        assertEquals("psli-b", plan.adds().get(1).pick().psliId());
        assertEquals("plan-b", plan.adds().get(1).pick().paymentPlanId());
        assertTrue(plan.deactivations().isEmpty());
        assertTrue(plan.warnings().isEmpty(), plan.warnings().toString());
    }

    @Test
    @DisplayName("sessions already sold are left alone; new ones append after the highest display order")
    void appendsOnlyWhatIsMissing() {
        List<CatalogueSyncPlanner.Row> rows = List.of(row("m1", 0, "a"), row("m2", 7, "b"));

        CatalogueSyncPlanner.Plan plan = CatalogueSyncPlanner.plan(rows,
                List.of(pick("a"), pick("b"), pick("c"), pick("d")), true);

        assertEquals(List.of("c", "d"), addedSessions(plan));
        assertEquals(List.of(8, 9), plan.adds().stream().map(CatalogueSyncPlanner.Add::displayOrder).toList());
        assertTrue(plan.deactivations().isEmpty());
    }

    @Test
    @DisplayName("a session is matched by package session, so one sold on another bridge or plan is not added twice")
    void dedupesByPackageSession() {
        CatalogueSyncPlanner.Row onOtherInvite = rowWith(rowWith(row("m1", 0, "a"), "bridge", "psli-other"),
                "plan", "plan-other");

        CatalogueSyncPlanner.Plan plan = CatalogueSyncPlanner.plan(List.of(onOtherInvite),
                List.of(pick("a"), pick("a")), true);

        assertTrue(plan.adds().isEmpty());
        assertTrue(plan.deactivations().isEmpty());
        assertTrue(warns(plan, "different enrollment link or plan"), plan.warnings().toString());
    }

    @Test
    @DisplayName("what a store page cannot sell is skipped with a reason")
    void skipsWhatCannotBeSold() {
        Date tomorrow = new Date(System.currentTimeMillis() + 2 * DAY);
        Date lastWeek = new Date(System.currentTimeMillis() - 7 * DAY);
        List<CatalogueSyncPlanner.Pick> picks = List.of(
                with(pick("nobridge"), "psli", null),
                with(pick("dangling"), "invite", null),
                with(pick("closed"), "inviteStatus", "INACTIVE"),
                with(pick("future"), "start", tomorrow),
                with(pick("over"), "end", lastWeek),
                with(pick("nooption"), "option", null),
                with(pick("cpo"), "optionType", "CPO"),
                with(pick("noplan"), "plan", null),
                pick("ok"));

        CatalogueSyncPlanner.Plan plan = CatalogueSyncPlanner.plan(List.of(), picks, true);

        assertEquals(List.of("ok"), addedSessions(plan));
        assertEquals(List.of(
                "nobridge:" + CatalogueSyncPlanner.NO_ACTIVE_INVITE,
                "dangling:" + CatalogueSyncPlanner.INVITE_INACTIVE,
                "closed:" + CatalogueSyncPlanner.INVITE_INACTIVE,
                "future:" + CatalogueSyncPlanner.INVITE_NOT_STARTED,
                "over:" + CatalogueSyncPlanner.INVITE_EXPIRED,
                "nooption:" + CatalogueSyncPlanner.PAYMENT_OPTION_INACTIVE,
                "cpo:" + CatalogueSyncPlanner.CPO_NOT_SUPPORTED,
                "noplan:" + CatalogueSyncPlanner.NO_ACTIVE_PLAN), skippedReasons(plan));
    }

    @Test
    @DisplayName("an invite with no status set sells, as it does at enrollment")
    void unsetInviteStatusIsOpen() {
        CatalogueSyncPlanner.Plan plan = CatalogueSyncPlanner.plan(List.of(),
                List.of(with(pick("a"), "inviteStatus", null)), true);

        assertEquals(List.of("a"), addedSessions(plan));
    }

    @Test
    @DisplayName("deactivateMissing switches off mappings whose session left the catalogue")
    void deactivatesWhatLeft() {
        List<CatalogueSyncPlanner.Row> rows = List.of(row("m1", 0, "a"), row("m2", 1, "gone"));

        CatalogueSyncPlanner.Plan plan = CatalogueSyncPlanner.plan(rows, List.of(pick("a"), pick("b")), true);

        assertEquals(List.of("m2:" + CatalogueSyncPlanner.LEFT_CATALOGUE), deactivatedIds(plan));
        assertEquals(List.of("b"), addedSessions(plan));
        assertEquals(2, plan.adds().get(0).displayOrder());
    }

    @Test
    @DisplayName("without deactivateMissing nothing is switched off, and the admin is told what is left over")
    void keepsEverythingWhenAsked() {
        List<CatalogueSyncPlanner.Row> rows = List.of(row("m1", 0, "a"), row("m2", 1, "gone"),
                rowWith(row("m3", 2, "c"), "bridgeStatus", "INACTIVE"));

        CatalogueSyncPlanner.Plan plan = CatalogueSyncPlanner.plan(rows, List.of(pick("a"), pick("c")), false);

        assertTrue(plan.deactivations().isEmpty());
        assertTrue(plan.adds().isEmpty());
        assertTrue(warns(plan, "not in the catalogue: Course gone (Hindi)"), plan.warnings().toString());
        assertTrue(warns(plan, "inactive enrollment link, payment option or plan: Course c (Hindi)"),
                plan.warnings().toString());
    }

    @Test
    @DisplayName("a mapping that can no longer be sold is replaced by the catalogue's current row")
    void replacesStaleMappings() {
        List<CatalogueSyncPlanner.Row> rows = List.of(
                rowWith(row("m1", 0, "a"), "bridgeStatus", "DELETED"),
                rowWith(row("m2", 1, "b"), "inviteStatus", "INACTIVE"),
                rowWith(row("m3", 2, "c"), "optionStatus", "INACTIVE"),
                rowWith(row("m4", 3, "d"), "planFound", false),
                rowWith(row("m5", 4, "e"), "planStatus", "DELETED"),
                rowWith(row("m6", 5, "f"), "optionFound", false),
                rowWith(row("m7", 6, "g"), "planStatus", null));

        CatalogueSyncPlanner.Plan plan = CatalogueSyncPlanner.plan(rows,
                List.of(pick("a"), pick("b"), pick("c"), pick("d"), pick("e"), pick("f"), pick("g")), true);

        assertEquals(List.of(
                "m1:" + CatalogueSyncPlanner.BRIDGE_INACTIVE,
                "m2:" + CatalogueSyncPlanner.INVITE_INACTIVE,
                "m3:" + CatalogueSyncPlanner.PAYMENT_OPTION_INACTIVE,
                "m4:" + CatalogueSyncPlanner.PLAN_MISSING,
                "m5:" + CatalogueSyncPlanner.PLAN_INACTIVE,
                "m6:" + CatalogueSyncPlanner.PAYMENT_OPTION_INACTIVE), deactivatedIds(plan));
        // A status that was never set is not "inactive": m7 stays.
        assertEquals(List.of("a", "b", "c", "d", "e", "f"), addedSessions(plan));
        assertEquals(7, plan.adds().get(0).displayOrder());
    }

    @Test
    @DisplayName("a stale mapping whose catalogue row cannot be sold either is switched off and the session skipped")
    void staleAndUnsellable() {
        List<CatalogueSyncPlanner.Row> rows = List.of(row("m1", 0, "a"),
                rowWith(row("m2", 1, "b"), "inviteStatus", "INACTIVE"));

        CatalogueSyncPlanner.Plan plan = CatalogueSyncPlanner.plan(rows,
                List.of(pick("a"), with(pick("b"), "inviteStatus", "INACTIVE")), true);

        assertEquals(List.of("m2:" + CatalogueSyncPlanner.INVITE_INACTIVE), deactivatedIds(plan));
        assertEquals(List.of("b:" + CatalogueSyncPlanner.INVITE_INACTIVE), skippedReasons(plan));
    }

    @Test
    @DisplayName("a sync never empties a page: an empty catalogue deactivates nothing")
    void emptyCatalogueDeactivatesNothing() {
        List<CatalogueSyncPlanner.Row> rows = List.of(row("m1", 0, "a"), row("m2", 1, "b"));

        CatalogueSyncPlanner.Plan plan = CatalogueSyncPlanner.plan(rows, List.of(), true);

        assertTrue(plan.deactivations().isEmpty());
        assertTrue(plan.adds().isEmpty());
        assertTrue(warns(plan, "no published courses"), plan.warnings().toString());
    }

    @Test
    @DisplayName("a sync never empties a page: when every row would go and nothing can be added, all stay")
    void neverLeavesThePageEmpty() {
        List<CatalogueSyncPlanner.Row> rows = List.of(row("m1", 0, "gone1"), row("m2", 1, "gone2"));

        CatalogueSyncPlanner.Plan plan = CatalogueSyncPlanner.plan(rows,
                List.of(with(pick("x"), "optionType", "CPO")), true);

        assertTrue(plan.deactivations().isEmpty());
        assertEquals(List.of("x:" + CatalogueSyncPlanner.CPO_NOT_SUPPORTED), skippedReasons(plan));
        assertTrue(warns(plan, "rather than leave the page empty"), plan.warnings().toString());
    }

    @Test
    @DisplayName("every row may go when the catalogue replaces them")
    void allRowsMayBeReplaced() {
        List<CatalogueSyncPlanner.Row> rows = List.of(row("m1", 0, "gone"));

        CatalogueSyncPlanner.Plan plan = CatalogueSyncPlanner.plan(rows, List.of(pick("new")), true);

        assertEquals(List.of("m1:" + CatalogueSyncPlanner.LEFT_CATALOGUE), deactivatedIds(plan));
        assertEquals(List.of("new"), addedSessions(plan));
        assertEquals(1, plan.adds().get(0).displayOrder());
    }

    @Test
    @DisplayName("mixed gateways and currencies on the resulting page are warned about")
    void warnsOnMixedVendorsAndCurrencies() {
        List<CatalogueSyncPlanner.Row> rows = List.of(row("m1", 0, "a"));
        List<CatalogueSyncPlanner.Pick> picks = List.of(pick("a"),
                with(with(pick("b"), "vendor", "cashfree"), "planCurrency", "USD"));

        CatalogueSyncPlanner.Plan plan = CatalogueSyncPlanner.plan(rows, picks, true);

        assertTrue(warns(plan, "more than one payment gateway (CASHFREE, RAZORPAY)"), plan.warnings().toString());
        assertTrue(warns(plan, "more than one currency (INR, USD)"), plan.warnings().toString());
    }

    @Test
    @DisplayName("switched-off rows do not count towards the mixed-gateway warning")
    void deactivatedRowsDoNotWarn() {
        List<CatalogueSyncPlanner.Row> rows = List.of(row("m1", 0, "a"),
                rowWith(row("m2", 1, "gone"), "vendor", "STRIPE"));

        CatalogueSyncPlanner.Plan plan = CatalogueSyncPlanner.plan(rows, List.of(pick("a")), true);

        assertEquals(List.of("m2:" + CatalogueSyncPlanner.LEFT_CATALOGUE), deactivatedIds(plan));
        assertTrue(plan.warnings().isEmpty(), plan.warnings().toString());
    }

    @Test
    @DisplayName("duplicates, non-default invites and recurring options are reported")
    void reportsOddities() {
        List<CatalogueSyncPlanner.Row> rows = List.of(row("m1", 0, "a"),
                rowWith(row("m2", 1, "a"), "plan", "plan-combo"));
        List<CatalogueSyncPlanner.Pick> picks = List.of(pick("a"),
                with(pick("b"), "inviteTag", null),
                with(pick("c"), "optionType", "SUBSCRIPTION"));

        CatalogueSyncPlanner.Plan plan = CatalogueSyncPlanner.plan(rows, picks, true);

        assertEquals(List.of("b", "c"), addedSessions(plan));
        assertTrue(warns(plan, "1 course is on this page more than once"), plan.warnings().toString());
        assertTrue(warns(plan, "not the course's default one, because that is the link the Courses page prices them"
                + " with: Course b (Hindi)"), plan.warnings().toString());
        assertTrue(warns(plan, "subscription or donation payment option"), plan.warnings().toString());
        // Two rows for one session (plan tiles) are a choice, not price drift.
        assertTrue(plan.warnings().stream().noneMatch(w -> w.contains("different enrollment link")),
                plan.warnings().toString());
    }

    @Test
    @DisplayName("warnings list a handful of names, then a count")
    void longListsAreShortened() {
        List<CatalogueSyncPlanner.Pick> picks = new ArrayList<>();
        for (int i = 0; i < 8; i++) picks.add(with(pick("s" + i), "inviteTag", "OTHER"));

        CatalogueSyncPlanner.Plan plan = CatalogueSyncPlanner.plan(List.of(), picks, true);

        assertTrue(warns(plan, "8 courses were added"), plan.warnings().toString());
        assertTrue(warns(plan, "Course s4 (Hindi) and 3 more"), plan.warnings().toString());
    }

    @Test
    @DisplayName("labels drop a DEFAULT level")
    void labels() {
        assertEquals("Physics", CatalogueSyncPlanner.label("Physics", "DEFAULT"));
        assertEquals("Physics (Hindi)", CatalogueSyncPlanner.label(" Physics ", "Hindi"));
        assertEquals("Untitled course", CatalogueSyncPlanner.label(null, null));
    }
}
