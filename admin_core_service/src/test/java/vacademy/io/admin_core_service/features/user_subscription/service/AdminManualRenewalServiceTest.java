package vacademy.io.admin_core_service.features.user_subscription.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import vacademy.io.admin_core_service.features.enroll_invite.entity.EnrollInvite;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.invoice.service.InvoiceService;
import vacademy.io.admin_core_service.features.learner_access.enums.LearnerAccessSourceEnum;
import vacademy.io.admin_core_service.features.learner_access.service.LearnerAccessService;
import vacademy.io.admin_core_service.features.offline_payment.service.OfflinePaymentDetailsService;
import vacademy.io.admin_core_service.features.timeline.dto.TimelineEventRequestDTO;
import vacademy.io.admin_core_service.features.timeline.service.TimelineEventService;
import vacademy.io.admin_core_service.features.user_account.service.UserAccountLedgerService;
import vacademy.io.admin_core_service.features.user_subscription.dto.ManualRenewalRequestDTO;
import vacademy.io.admin_core_service.features.user_subscription.dto.ManualRenewalResultDTO;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentPlan;
import vacademy.io.admin_core_service.features.user_subscription.entity.UserPlan;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.admin_core_service.features.user_subscription.repository.UserPlanRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Admin-recorded renewal: brings an EXPIRED member back with access, books the payment,
 * leaves a remark — and never arms autopay or contacts the member unless asked.
 */
class AdminManualRenewalServiceTest {

    private static final String INST = "inst-1";
    private static final long DAY = 24L * 60 * 60 * 1000;

    private UserPlanRepository planRepo;
    private StudentSessionInstituteGroupMappingRepository mappingRepo;
    private PaymentLogService paymentLogService;
    private PaymentLogRepository paymentLogRepo;
    private OfflinePaymentDetailsService offline;
    private UserAccountLedgerService ledger;
    private LearnerAccessService access;
    private TimelineEventService timeline;
    private InvoiceService invoices;
    private AdminManualRenewalService service;
    private UserPlan plan;
    private StudentSessionInstituteGroupMapping lapsed;
    private CustomUserDetails admin;

    @BeforeEach
    void setUp() {
        planRepo = mock(UserPlanRepository.class);
        mappingRepo = mock(StudentSessionInstituteGroupMappingRepository.class);
        paymentLogService = mock(PaymentLogService.class);
        paymentLogRepo = mock(PaymentLogRepository.class);
        offline = mock(OfflinePaymentDetailsService.class);
        ledger = mock(UserAccountLedgerService.class);
        access = mock(LearnerAccessService.class);
        timeline = mock(TimelineEventService.class);
        invoices = mock(InvoiceService.class);
        service = new AdminManualRenewalService(planRepo, mappingRepo, paymentLogService, paymentLogRepo,
                offline, ledger, access, timeline, invoices);

        EnrollInvite invite = new EnrollInvite();
        invite.setInstituteId(INST);
        PaymentPlan paymentPlan = new PaymentPlan();
        paymentPlan.setValidityInDays(365);
        paymentPlan.setActualPrice(431.0);
        paymentPlan.setCurrency("AUD");

        plan = new UserPlan();
        plan.setId("up-1");
        plan.setUserId("u-1");
        plan.setStatus("EXPIRED");
        plan.setEndDate(new Date(System.currentTimeMillis() - 30 * DAY));
        plan.setAutoRenewalEnabled(false);
        plan.setEnrollInvite(invite);
        plan.setPaymentPlan(paymentPlan);
        when(planRepo.findById("up-1")).thenReturn(Optional.of(plan));

        lapsed = new StudentSessionInstituteGroupMapping();
        lapsed.setId("m-1");
        lapsed.setUserId("u-1");
        lapsed.setStatus("INACTIVE");
        lapsed.setExpiryDate(plan.getEndDate());
        when(mappingRepo.findByUserPlanIdAndStatus(eq("up-1"), anyString())).thenReturn(List.of());
        when(mappingRepo.findByUserPlanIdAndStatus("up-1", "INACTIVE")).thenReturn(List.of(lapsed));

        when(paymentLogService.createPaymentLog(any(), anyDouble(), any(), any(), any(), any(), any(), any()))
                .thenReturn("pl-1");
        admin = mock(CustomUserDetails.class);
        when(admin.getUserId()).thenReturn("admin-1");
        when(admin.getUsername()).thenReturn("finance");
    }

    @AfterEach
    void tearDown() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    private static ManualRenewalRequestDTO req(double amount) {
        ManualRenewalRequestDTO r = new ManualRenewalRequestDTO();
        r.setAmount(amount);
        r.setRemarks("Paid by bank transfer, ref 7781");
        return r;
    }

    @Test
    @DisplayName("an EXPIRED member is reactivated for a full year from today, access back on, autopay still off")
    void reactivatesExpired() {
        ManualRenewalResultDTO result = service.renew("up-1", INST, req(431), admin);

        assertEquals("EXPIRED", result.getPreviousStatus());
        assertEquals("ACTIVE", plan.getStatus());
        long daysAhead = (plan.getEndDate().getTime() - System.currentTimeMillis()) / DAY;
        assertTrue(daysAhead >= 364 && daysAhead <= 365, "~365 days from today, was " + daysAhead);
        assertFalse(plan.getAutoRenewalEnabled());
        assertNull(plan.getNextChargeAt(), "no automatic charge may be scheduled");
        assertEquals("ACTIVE", lapsed.getStatus());
        assertEquals(plan.getEndDate(), lapsed.getExpiryDate());
        assertEquals(1, result.getMappingsUpdated());
        verify(access).recordGrant(eq(LearnerAccessSourceEnum.RENEWAL), eq(INST), eq(lapsed), any(),
                any(), eq("up-1"), any(), any(), any(), eq("admin-1"), eq("finance"));
    }

    @Test
    @DisplayName("the payment is booked as MANUAL + PAID without the side-effecting update, and on the ledger")
    void booksPayment() {
        service.renew("up-1", INST, req(431), admin);

        verify(paymentLogService).createPaymentLog(eq("u-1"), eq(431.0), eq("MANUAL"), eq("MANUAL"),
                eq("AUD"), eq(plan), isNull(), any());
        verify(paymentLogService).updatePaymentLogOnly(eq("pl-1"), eq("SUCCESS"), eq("PAID"), any());
        verify(paymentLogService, never()).updatePaymentLog(any(), any(), any(), any());
        verify(offline).apply(eq("pl-1"), any(), eq("admin-1"));
        verify(ledger).recordSettledCharge(eq("u-1"), eq(INST), any(), eq("AUD"), isNull(),
                eq("USER_PLAN"), eq("up-1"), eq("pl-1"), any());
    }

    @Test
    @DisplayName("the remark is stored on the plan's timeline with the payment details")
    void writesRemark() {
        service.renew("up-1", INST, req(431), admin);

        ArgumentCaptor<TimelineEventRequestDTO> ev = ArgumentCaptor.forClass(TimelineEventRequestDTO.class);
        verify(timeline).createManualEvent(ev.capture(), eq(admin));
        assertEquals("USER_PLAN", ev.getValue().getType());
        assertEquals("up-1", ev.getValue().getTypeId());
        assertEquals("MANUAL_RENEWAL", ev.getValue().getActionType());
        assertEquals("u-1", ev.getValue().getStudentUserId());
        assertEquals("Paid by bank transfer, ref 7781", ev.getValue().getDescription());
    }

    @Test
    @DisplayName("by default nothing is invoiced or emailed")
    void silentByDefault() {
        service.renew("up-1", INST, req(431), admin);
        verifyNoInteractions(invoices);
        verify(paymentLogService, never()).scheduleSyncInvoiceAfterCommit(any(), any());
    }

    @Test
    @DisplayName("an invoice without email waits for the commit and is generated with sendEmail=false")
    void silentInvoiceAfterCommit() {
        TransactionSynchronizationManager.initSynchronization();
        ManualRenewalRequestDTO r = req(431);
        r.setGenerateInvoice(true);
        service.renew("up-1", INST, r, admin);
        verifyNoInteractions(invoices);

        for (TransactionSynchronization s : TransactionSynchronizationManager.getSynchronizations()) {
            s.afterCommit();
        }
        verify(invoices).generateInvoiceWithResultForCommittedPayment("pl-1", INST, false);
    }

    @Test
    @DisplayName("invoice + email goes through the normal offline-payment confirmation path")
    void invoiceWithEmail() {
        PaymentLog log = new PaymentLog();
        log.setId("pl-1");
        when(paymentLogRepo.findById("pl-1")).thenReturn(Optional.of(log));
        ManualRenewalRequestDTO r = req(431);
        r.setGenerateInvoice(true);
        r.setSendEmail(true);
        service.renew("up-1", INST, r, admin);
        verify(paymentLogService).scheduleSyncInvoiceAfterCommit(log, INST);
    }

    @Test
    @DisplayName("an ACTIVE member renewing early keeps the days left: extended from the current end date")
    void earlyRenewalExtendsFromEndDate() {
        Date end = new Date(System.currentTimeMillis() + 20 * DAY);
        plan.setStatus("ACTIVE");
        plan.setEndDate(end);
        service.renew("up-1", INST, req(431), admin);
        Calendar c = Calendar.getInstance();
        c.setTime(end);
        c.add(Calendar.DAY_OF_MONTH, 365);
        assertEquals(c.getTime(), plan.getEndDate());
    }

    @Test
    @DisplayName("an explicit end date from the admin wins")
    void explicitEndDate() {
        Date chosen = new Date(System.currentTimeMillis() + 100 * DAY);
        ManualRenewalRequestDTO r = req(431);
        r.setNewEndDate(chosen);
        service.renew("up-1", INST, r, admin);
        assertEquals(chosen, plan.getEndDate());
    }

    @Test
    @DisplayName("a zero amount extends access without inventing a payment")
    void zeroAmount() {
        service.renew("up-1", INST, req(0), admin);
        verify(paymentLogService, never()).createPaymentLog(any(), anyDouble(), any(), any(), any(), any(), any(), any());
        verifyNoInteractions(ledger);
        assertEquals("ACTIVE", plan.getStatus());
    }

    @Test
    @DisplayName("autopay that the member already had on is left on and re-armed for the new end date")
    void keepsExistingAutopay() {
        plan.setAutoRenewalEnabled(true);
        service.renew("up-1", INST, req(431), admin);
        assertTrue(plan.getAutoRenewalEnabled());
        assertEquals(plan.getEndDate(), plan.getNextChargeAt());
    }

    @Test
    @DisplayName("refused: terminated plan, past end date, no access rows, other institute — nothing written")
    void refusals() {
        plan.setStatus("TERMINATED");
        assertThrows(VacademyException.class, () -> service.renew("up-1", INST, req(431), admin));
        plan.setStatus("EXPIRED");

        ManualRenewalRequestDTO past = req(431);
        past.setNewEndDate(new Date(System.currentTimeMillis() - DAY));
        assertThrows(VacademyException.class, () -> service.renew("up-1", INST, past, admin));

        assertThrows(VacademyException.class, () -> service.renew("up-1", "other-inst", req(431), admin));

        when(mappingRepo.findByUserPlanIdAndStatus("up-1", "INACTIVE")).thenReturn(List.of());
        assertThrows(VacademyException.class, () -> service.renew("up-1", INST, req(431), admin));

        ManualRenewalRequestDTO negative = req(-1);
        assertThrows(VacademyException.class, () -> service.renew("up-1", INST, negative, admin));

        verify(paymentLogService, never()).createPaymentLog(any(), anyDouble(), any(), any(), any(), any(), any(), any());
        verify(planRepo, never()).save(any());
    }

    @Test
    @DisplayName("an empty remark is refused; a real one is stored on the plan")
    void addRemark() {
        assertThrows(VacademyException.class, () -> service.addRemark("up-1", INST, "  ", admin));
        service.addRemark("up-1", INST, " Called, will pay Friday ", admin);
        ArgumentCaptor<TimelineEventRequestDTO> ev = ArgumentCaptor.forClass(TimelineEventRequestDTO.class);
        verify(timeline).createManualEvent(ev.capture(), eq(admin));
        assertEquals("PLAN_REMARK", ev.getValue().getActionType());
        assertEquals("Called, will pay Friday", ev.getValue().getDescription());
    }
}
