package vacademy.io.admin_core_service.features.fee_management.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import vacademy.io.admin_core_service.features.fee_management.entity.StudentFeePayment;
import vacademy.io.admin_core_service.features.fee_management.repository.StudentFeePaymentRepository;
import vacademy.io.admin_core_service.features.user_account.repository.UserAccountLedgerRepository;
import vacademy.io.admin_core_service.features.user_account.service.UserAccountLedgerService;
import vacademy.io.admin_core_service.features.user_subscription.dto.UserPlanDiscountJson;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.admin_core_service.features.user_subscription.util.PaymentOptionJsonDiscountAccessor;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.sql.Date;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * The CPO recompute keeps two books: student_fee_payment.amount_expected (what the Fee Plan block
 * shows) and user_account_ledger (what the Account Summary shows). These tests hold them to the
 * same figure, row by row, on the two shapes Vasco Maritime actually has in production:
 * <ul>
 *   <li>MD ARSELAN — template 5,000 / 21,668 / 21,666 / 21,666 re-cut at enrollment to
 *       5,000 / 20,000 / 40,000 / 5,000 with a flat 5,000 off. The raise on the third row never
 *       reached the ledger, so the Account Summary said 49,523.14 accrued against a 65,000 plan.</li>
 *   <li>ANURAG KUMAR — a one-time 70,000 plan, flat 5,000 off, 25,000 paid, and no way to put a
 *       date on the remaining 40,000.</li>
 * </ul>
 */
class CpoDiscountServiceLedgerAndSplitTest {

    private static final String INSTITUTE = "inst-vasco";
    private static final String USER = "learner-1";
    private static final String PLAN = "plan-1";

    /** One ledger row, reduced to what the sync reads. */
    private record Row(String eventType, String sourceType, String sourceId, BigDecimal amount, String remark) {}

    private final Map<String, StudentFeePayment> sfps = new LinkedHashMap<>();
    private final List<Row> ledger = new ArrayList<>();
    private UserPlan plan;
    private CpoDiscountService service;

    @BeforeEach
    void setUp() {
        UserPlanRepository userPlanRepository = mock(UserPlanRepository.class);
        StudentFeePaymentRepository sfpRepository = mock(StudentFeePaymentRepository.class);
        UserAccountLedgerService ledgerService = mock(UserAccountLedgerService.class);
        UserAccountLedgerRepository ledgerRepository = mock(UserAccountLedgerRepository.class);

        plan = new UserPlan();
        plan.setId(PLAN);
        plan.setUserId(USER);
        when(userPlanRepository.findById(PLAN)).thenAnswer(inv -> Optional.of(plan));
        when(userPlanRepository.save(any(UserPlan.class))).thenAnswer(inv -> inv.getArgument(0));

        when(sfpRepository.findById(anyString())).thenAnswer(inv -> Optional.ofNullable(sfps.get(inv.getArgument(0))));
        when(sfpRepository.findByUserPlanId(PLAN)).thenAnswer(inv -> new ArrayList<>(sfps.values()));
        when(sfpRepository.save(any(StudentFeePayment.class))).thenAnswer(inv -> {
            StudentFeePayment sfp = inv.getArgument(0);
            if (sfp.getId() == null) sfp.setId(UUID.randomUUID().toString());
            sfps.put(sfp.getId(), sfp);
            return sfp;
        });

        doAnswer(inv -> {
            ledger.add(new Row("DEBIT_ACCRUAL", inv.getArgument(5), inv.getArgument(6), inv.getArgument(2), inv.getArgument(8)));
            return null;
        }).when(ledgerService).recordDebitAccrual(anyString(), anyString(), any(), anyString(), any(),
                anyString(), anyString(), any(), anyString());
        doAnswer(inv -> {
            ledger.add(new Row("DEBIT_REVERSAL", inv.getArgument(5), inv.getArgument(6), inv.getArgument(2), inv.getArgument(8)));
            return null;
        }).when(ledgerService).recordDebitReversal(anyString(), anyString(), any(), anyString(), any(),
                anyString(), anyString(), any(), anyString());
        when(ledgerRepository.sumBySourceAndEventType(anyString(), anyString(), anyString())).thenAnswer(inv ->
                ledger.stream()
                        .filter(r -> r.sourceType().equals(inv.getArgument(0))
                                && r.sourceId().equals(inv.getArgument(1))
                                && r.eventType().equals(inv.getArgument(2)))
                        .map(Row::amount)
                        .reduce(BigDecimal.ZERO, BigDecimal::add));

        service = new CpoDiscountService(userPlanRepository, sfpRepository, ledgerService, ledgerRepository);
    }

    // ------------------------------------------------------------------ fixtures

    /** A row as StudentFeePaymentGenerationService writes it, plus its template accrual. */
    private StudentFeePayment installment(String id, String original, String paid, LocalDate due) {
        StudentFeePayment sfp = new StudentFeePayment();
        sfp.setId(id);
        sfp.setUserId(USER);
        sfp.setUserPlanId(PLAN);
        sfp.setCpoId("cpo-1");
        sfp.setAsvId("asv-1");
        sfp.setInstituteId(INSTITUTE);
        sfp.setOriginalAmount(new BigDecimal(original));
        sfp.setAmountExpected(new BigDecimal(original));
        sfp.setAmountPaid(new BigDecimal(paid));
        sfp.setDueDate(Date.valueOf(due));
        sfp.setStatus("PENDING");
        sfps.put(id, sfp);
        ledger.add(new Row("DEBIT_ACCRUAL", "STUDENT_FEE_PAYMENT", id, new BigDecimal(original), "Fee installment generated"));
        return sfp;
    }

    private void snapshot(UserPlanDiscountJson snapshot) {
        plan.setPaymentOptionJson(PaymentOptionJsonDiscountAccessor.write(null, snapshot));
    }

    private static UserPlanDiscountJson.DiscountEntry flatOff(double value) {
        return UserPlanDiscountJson.DiscountEntry.builder().type("FLAT").value(value).build();
    }

    private static UserPlanDiscountJson.ManualAmountOverrideEntry override(String amount) {
        return UserPlanDiscountJson.ManualAmountOverrideEntry.builder().newAmount(new BigDecimal(amount)).build();
    }

    /** What the Account Summary sees for one row: accruals minus reversals, every source. */
    private BigDecimal ledgerNet(String sfpId) {
        return ledger.stream()
                .filter(r -> r.sourceId().equals(sfpId))
                .map(r -> r.eventType().equals("DEBIT_REVERSAL") ? r.amount().negate() : r.amount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal ledgerTotal() {
        return ledger.stream()
                .map(r -> r.eventType().equals("DEBIT_REVERSAL") ? r.amount().negate() : r.amount())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private BigDecimal sum(java.util.function.Function<StudentFeePayment, BigDecimal> field) {
        return sfps.values().stream().map(field).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual), "expected " + expected + " but was " + actual);
    }

    /** Every row's ledger net must equal the amount the Fee Plan block shows for it. */
    private void assertBooksAgree() {
        for (StudentFeePayment sfp : sfps.values()) {
            assertMoney(sfp.getAmountExpected().toPlainString(), ledgerNet(sfp.getId()));
        }
        assertMoney(sum(StudentFeePayment::getAmountExpected).toPlainString(), ledgerTotal());
    }

    /** MD ARSELAN's plan exactly as enrollment left it. */
    private void arselanPlan() {
        installment("fee", "5000.00", "0", LocalDate.of(2026, 8, 20));
        installment("i1", "21668.00", "0", LocalDate.of(2026, 11, 6));
        installment("i2", "21666.00", "0", LocalDate.of(2027, 2, 6));
        installment("i3", "21666.00", "0", LocalDate.of(2027, 5, 6));
        UserPlanDiscountJson s = UserPlanDiscountJson.builder().build();
        s.setCpoDiscount(flatOff(5000));
        s.getManualAmountOverrides().put("i1", override("20000.00"));
        s.getManualAmountOverrides().put("i2", override("40000.00"));
        s.getManualAmountOverrides().put("i3", override("5000.00"));
        snapshot(s);
        service.recomputeUserPlan(PLAN);
    }

    // --------------------------------------------------------------------- #1

    @Test
    @DisplayName("an installment raised above its template amount reaches the ledger (MD ARSELAN)")
    void raiseAboveTemplateIsAccrued() {
        arselanPlan();

        assertMoney("4642.86", sfps.get("fee").getAmountExpected());
        assertMoney("18571.43", sfps.get("i1").getAmountExpected());
        assertMoney("37142.86", sfps.get("i2").getAmountExpected());
        assertMoney("4642.85", sfps.get("i3").getAmountExpected());
        // The Account Summary used to say 49,523.14 here.
        assertMoney("65000.00", ledgerTotal());
        assertBooksAgree();
        assertTrue(ledger.stream().anyMatch(r -> r.sourceId().equals("i2")
                && r.eventType().equals("DEBIT_ACCRUAL")
                && r.amount().compareTo(new BigDecimal("15476.86")) == 0));
    }

    @Test
    @DisplayName("re-running the recompute books nothing twice")
    void recomputeIsIdempotent() {
        arselanPlan();
        int rows = ledger.size();
        service.recomputeUserPlan(PLAN);
        service.recomputeUserPlan(PLAN);
        assertEquals(rows, ledger.size());
        assertBooksAgree();
    }

    @Test
    @DisplayName("an installment lowered again after a raise gives the raise back")
    void loweringAfterRaiseReverses() {
        arselanPlan();
        service.setInstallmentAmount("i2", new BigDecimal("30000"), "renegotiated", "admin");
        service.clearInstallmentAmountOverride("i3", "admin");
        assertBooksAgree();
        // Bringing a raise back down is labelled as such, not as a discount.
        assertTrue(ledger.stream().anyMatch(r -> r.sourceId().equals("i2")
                && r.eventType().equals("DEBIT_REVERSAL")
                && r.remark().equals("Installment amount reduced")));
    }

    // --------------------------------------------------------------------- #3

    @Test
    @DisplayName("ANURAG: 25,000 of 65,000 paid, the other 40,000 moved to its own date")
    void splitOneTimePlan() {
        StudentFeePayment only = installment("one", "70000.00", "25000.00", LocalDate.of(2027, 8, 6));
        UserPlanDiscountJson s = UserPlanDiscountJson.builder().build();
        s.setCpoDiscount(flatOff(5000));
        snapshot(s);
        service.recomputeUserPlan(PLAN);
        assertMoney("65000.00", only.getAmountExpected());
        assertEquals("PARTIAL_PAID", only.getStatus());

        StudentFeePayment added = service.splitInstallment("one", new BigDecimal("40000"),
                LocalDate.of(2026, 9, 25), LocalDate.of(2026, 10, 10), "admin");

        assertMoney("25000.00", only.getAmountExpected());
        assertEquals("PAID", only.getStatus());
        assertMoney("40000.00", added.getAmountExpected());
        assertEquals("PENDING", added.getStatus());
        assertEquals(Date.valueOf(LocalDate.of(2026, 10, 10)), added.getDueDate());
        assertEquals(Date.valueOf(LocalDate.of(2026, 9, 25)), added.getStartDate());
        assertNull(added.getIId());

        // Plan total, gross and the CPO discount are all where they were.
        assertMoney("65000.00", sum(StudentFeePayment::getAmountExpected));
        assertMoney("70000.00", sum(StudentFeePayment::getOriginalAmount));
        assertMoney("25000.00", sum(StudentFeePayment::getAmountPaid));
        assertBooksAgree();
        assertMoney("65000.00", ledgerTotal());
    }

    @Test
    @DisplayName("splitting a re-cut installment keeps every total and both books in step")
    void splitRecutInstallment() {
        arselanPlan();
        BigDecimal before = sfps.get("i2").getAmountExpected();

        StudentFeePayment added = service.splitInstallment("i2", new BigDecimal("10000"),
                null, LocalDate.of(2026, 12, 15), "admin");

        assertMoney(before.subtract(new BigDecimal("10000")).toPlainString(), sfps.get("i2").getAmountExpected());
        assertMoney("10000.00", added.getAmountExpected());
        assertNull(added.getStartDate());
        assertMoney("65000.00", sum(StudentFeePayment::getAmountExpected));
        assertMoney("70000.00", sum(StudentFeePayment::getOriginalAmount));
        assertBooksAgree();
    }

    @Test
    @DisplayName("the odd paisa lands on the latest-due installment whatever order the rows load in")
    void roundingRemainderDoesNotDependOnRowOrder() {
        arselanPlan();
        Map<String, BigDecimal> first = new LinkedHashMap<>();
        sfps.values().forEach(s -> first.put(s.getId(), s.getAmountExpected()));

        // Reload the rows in a different order, as heap order can after an UPDATE.
        List<StudentFeePayment> reversed = new ArrayList<>(sfps.values());
        java.util.Collections.reverse(reversed);
        sfps.clear();
        reversed.forEach(s -> sfps.put(s.getId(), s));
        int rows = ledger.size();
        service.recomputeUserPlan(PLAN);

        sfps.values().forEach(s -> assertMoney(first.get(s.getId()).toPlainString(), s.getAmountExpected()));
        assertEquals(rows, ledger.size(), "a reorder must not post paisa corrections");
    }

    @Test
    @DisplayName("a split whose new installment falls due last still keeps the totals and books")
    void splitToLatestDate() {
        arselanPlan();

        StudentFeePayment added = service.splitInstallment("i3", new BigDecimal("2000"),
                null, LocalDate.of(2027, 9, 1), "admin");

        assertMoney("2642.85", sfps.get("i3").getAmountExpected());
        assertTrue(added.getAmountExpected().subtract(new BigDecimal("2000")).abs()
                .compareTo(new BigDecimal("0.01")) <= 0, "new row within a paisa: " + added.getAmountExpected());
        assertMoney("65000.00", sum(StudentFeePayment::getAmountExpected));
        assertMoney("70000.00", sum(StudentFeePayment::getOriginalAmount));
        assertBooksAgree();
    }

    @Test
    @DisplayName("a split with no plan discount moves the exact amount")
    void splitWithoutDiscount() {
        installment("a", "30000.00", "10000.00", LocalDate.of(2026, 11, 1));
        snapshot(UserPlanDiscountJson.builder().build());
        service.recomputeUserPlan(PLAN);

        StudentFeePayment added = service.splitInstallment("a", new BigDecimal("12500.50"),
                null, LocalDate.of(2027, 1, 1), "admin");

        assertMoney("17499.50", sfps.get("a").getAmountExpected());
        assertEquals("PARTIAL_PAID", sfps.get("a").getStatus());
        assertMoney("12500.50", added.getAmountExpected());
        assertMoney("30000.00", sum(StudentFeePayment::getOriginalAmount));
        assertBooksAgree();
    }

    @Test
    @DisplayName("cannot move more than is unpaid, or without a due date")
    void splitGuards() {
        installment("a", "30000.00", "10000.00", LocalDate.of(2026, 11, 1));
        snapshot(UserPlanDiscountJson.builder().build());
        service.recomputeUserPlan(PLAN);

        assertThrows(VacademyException.class, () -> service.splitInstallment("a", new BigDecimal("20000.01"),
                null, LocalDate.of(2027, 1, 1), "admin"));
        assertThrows(VacademyException.class, () -> service.splitInstallment("a", new BigDecimal("100"),
                null, null, "admin"));
        assertThrows(VacademyException.class, () -> service.splitInstallment("a", BigDecimal.ZERO,
                null, LocalDate.of(2027, 1, 1), "admin"));
        assertThrows(VacademyException.class, () -> service.splitInstallment("a", new BigDecimal("100"),
                LocalDate.of(2027, 2, 1), LocalDate.of(2027, 1, 1), "admin"));
        assertEquals(1, sfps.size());
    }
}
