package vacademy.io.admin_core_service.features.user_account.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.user_account.dto.UserAccountLedgerEntryDTO;
import vacademy.io.admin_core_service.features.user_account.dto.UserAccountSummaryDTO;
import vacademy.io.admin_core_service.features.user_account.entity.UserAccountLedger;
import vacademy.io.admin_core_service.features.invoice.repository.InvoiceRepository;
import vacademy.io.admin_core_service.features.user_account.repository.UserAccountLedgerRepository;

import java.math.BigDecimal;
import java.time.LocalDate;

@Slf4j
@Service
@RequiredArgsConstructor
public class UserAccountLedgerService {

    private final UserAccountLedgerRepository repository;
    private final InvoiceRepository invoiceRepository;

    // ── public event-recording API ────────────────────────────────────────────

    /** Called when a new payment obligation is created. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordDebitAccrual(String userId, String instituteId,
                                   BigDecimal amount, String currency,
                                   LocalDate dueDate,
                                   String sourceType, String sourceId,
                                   String invoiceId, String remarks) {
        recordDebitAccrual(userId, instituteId, amount, currency, dueDate,
                sourceType, sourceId, invoiceId, remarks, null, null);
    }

    /**
     * Discounted-obligation variant: {@code amount} is the NET the learner owes;
     * {@code grossAmount}/{@code discountAmount} carry the list price and the
     * coupon/discount so the transaction line can render the breakdown
     * (gross struck through → net). Pass nulls when no discount applies.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordDebitAccrual(String userId, String instituteId,
                                   BigDecimal amount, String currency,
                                   LocalDate dueDate,
                                   String sourceType, String sourceId,
                                   String invoiceId, String remarks,
                                   BigDecimal grossAmount, BigDecimal discountAmount) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return;
        save(userId, instituteId, "DEBIT_ACCRUAL", amount, currency,
                dueDate, sourceType, sourceId, invoiceId, null, remarks,
                grossAmount, discountAmount);
    }

    /**
     * Reverses an obligation that was voided before any money moved — a cancelled admin
     * invoice, a duplicated accrual. Nets out of "total accrued" rather than counting as a
     * credit: the learner never owed it and never paid it, so booking it as a CREDIT_*
     * (which is what the invoice-reject path did) both left the accrual standing at its
     * full amount and reported the void as money received.
     *
     * @param dueDate the ORIGINAL obligation's due date, so the reversal cancels it out of
     *                the past-due bucket as well as the total
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordDebitReversal(String userId, String instituteId,
                                    BigDecimal amount, String currency,
                                    LocalDate dueDate,
                                    String sourceType, String sourceId,
                                    String invoiceId, String remarks) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return;
        save(userId, instituteId, "DEBIT_REVERSAL", amount, currency,
                dueDate, sourceType, sourceId, invoiceId, null, remarks);
    }

    /**
     * Called when a payment is confirmed (gateway success or manual offline).
     *
     * <p>Idempotent on {@code paymentLogId}: the same payment can reach us from more than
     * one place (the SCHOOL webhook and the enrollment-confirmation path both observe the
     * same PaymentLog), and crediting it twice halves the learner's reported balance.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordCreditPayment(String userId, String instituteId,
                                    BigDecimal amount, String currency,
                                    String sourceType, String sourceId,
                                    String paymentLogId, String invoiceId, String remarks) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return;
        if (paymentLogId != null
                && repository.existsByReferenceIdAndEventType(paymentLogId, "CREDIT_PAYMENT")) {
            log.debug("Skipping duplicate CREDIT_PAYMENT for paymentLog={} (user={})", paymentLogId, userId);
            return;
        }
        save(userId, instituteId, "CREDIT_PAYMENT", amount, currency,
                null, sourceType, sourceId, invoiceId, paymentLogId, remarks);
    }

    /**
     * An obligation raised and settled in the same instant — a subscription renewal, where
     * the learner is charged for the next period with no prior pending bill to match against.
     *
     * <p>Posts BOTH halves: the {@code DEBIT_ACCRUAL} for what was billed and the
     * {@code CREDIT_PAYMENT} for what was collected. Crediting alone would inflate Total Paid
     * against an accrual that was never raised (renewals reuse the same UserPlan, so
     * {@code createUserPlan}'s accrual does not fire again) and drive the balance negative;
     * skipping both — which is what renewals did — kept the balance right by accident while
     * leaving every renewal invisible in the Transaction History and understating the
     * learner's lifetime billing.
     *
     * <p>Both rows carry the PaymentLog in {@code reference_id} and are idempotent on it, so
     * a retried webhook re-posts neither. Accrual and payment land together or not at all.
     *
     * @param dueDate when the charge fell due, or null for an immediate charge
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordSettledCharge(String userId, String instituteId,
                                    BigDecimal amount, String currency,
                                    LocalDate dueDate,
                                    String sourceType, String sourceId,
                                    String paymentLogId, String remarks) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return;
        if (paymentLogId != null
                && repository.existsByReferenceIdAndEventType(paymentLogId, "DEBIT_ACCRUAL")) {
            log.debug("Skipping duplicate settled charge for paymentLog={} (user={})", paymentLogId, userId);
            return;
        }
        // reference_id normally carries the PaymentLog on CREDIT rows only; putting it on the
        // accrual too is what makes this pair replay-safe.
        save(userId, instituteId, "DEBIT_ACCRUAL", amount, currency,
                dueDate, sourceType, sourceId, null, paymentLogId, remarks);
        save(userId, instituteId, "CREDIT_PAYMENT", amount, currency,
                null, sourceType, sourceId, null, paymentLogId, remarks);
    }

    /** Called when a full fee waiver is granted. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordCreditWaiver(String userId, String instituteId,
                                   BigDecimal amount, String currency,
                                   String sourceType, String sourceId,
                                   String adjustmentHistoryId, String remarks) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return;
        save(userId, instituteId, "CREDIT_WAIVER", amount, currency,
                null, sourceType, sourceId, null, adjustmentHistoryId, remarks);
    }

    /** Called when a partial concession is applied. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordCreditAdjustment(String userId, String instituteId,
                                       BigDecimal amount, String currency,
                                       String sourceType, String sourceId,
                                       String adjustmentHistoryId, String remarks) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return;
        save(userId, instituteId, "CREDIT_ADJUSTMENT", amount, currency,
                null, sourceType, sourceId, null, adjustmentHistoryId, remarks);
    }

    /** Called when a penalty is added to a fee bill. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordDebitPenalty(String userId, String instituteId,
                                   BigDecimal amount, String currency,
                                   String sourceType, String sourceId,
                                   String adjustmentHistoryId, String remarks) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return;
        save(userId, instituteId, "DEBIT_PENALTY", amount, currency,
                null, sourceType, sourceId, null, adjustmentHistoryId, remarks);
    }

    // ── read API ──────────────────────────────────────────────────────────────

    public UserAccountSummaryDTO getSummary(String userId, String instituteId) {
        BigDecimal totalAccrued = repository.sumDebits(userId, instituteId);
        BigDecimal totalPaid    = repository.sumCredits(userId, instituteId);
        BigDecimal pastDue      = repository.sumPastDueDebits(userId, instituteId);

        // Supplement with admin invoices that pre-date the ledger integration
        // (invoices with no corresponding DEBIT_ACCRUAL entry yet)
        BigDecimal extraAccruals = invoiceRepository.sumUnledgeredAdminInvoiceAccruals(userId, instituteId);
        BigDecimal extraPayments = invoiceRepository.sumUnledgeredAdminInvoicePayments(userId, instituteId);
        if (extraAccruals != null) totalAccrued = totalAccrued.add(extraAccruals);
        if (extraPayments != null) totalPaid    = totalPaid.add(extraPayments);

        // Reversals can push a net figure below zero when an obligation was voided after
        // the money had already been recognised elsewhere — never report a negative total.
        totalAccrued = totalAccrued.max(BigDecimal.ZERO);
        BigDecimal balance = totalAccrued.subtract(totalPaid).max(BigDecimal.ZERO);

        // Past Due = the still-unsettled slice of what was already due. Allocation is
        // oldest-first everywhere in the product, so collected money retires past-due
        // obligations before upcoming ones; and it can never exceed the whole balance.
        BigDecimal overdue = pastDue.subtract(totalPaid).max(BigDecimal.ZERO).min(balance);

        return UserAccountSummaryDTO.builder()
                .userId(userId)
                .instituteId(instituteId)
                .totalAccrued(totalAccrued)
                .totalPaid(totalPaid)
                .balance(balance)
                .overdue(overdue)
                .currency("INR")
                .build();
    }

    public Page<UserAccountLedgerEntryDTO> getLedger(String userId, String instituteId, Pageable pageable) {
        return repository
                .findByUserIdAndInstituteIdOrderByCreatedAtDesc(userId, instituteId, pageable)
                .map(this::toDTO);
    }

    // ── private ───────────────────────────────────────────────────────────────

    private void save(String userId, String instituteId, String eventType,
                      BigDecimal amount, String currency, LocalDate dueDate,
                      String sourceType, String sourceId,
                      String invoiceId, String referenceId, String remarks) {
        save(userId, instituteId, eventType, amount, currency, dueDate,
                sourceType, sourceId, invoiceId, referenceId, remarks, null, null);
    }

    private void save(String userId, String instituteId, String eventType,
                      BigDecimal amount, String currency, LocalDate dueDate,
                      String sourceType, String sourceId,
                      String invoiceId, String referenceId, String remarks,
                      BigDecimal grossAmount, BigDecimal discountAmount) {
        try {
            UserAccountLedger entry = UserAccountLedger.builder()
                    .userId(userId)
                    .instituteId(instituteId)
                    .eventType(eventType)
                    .amount(amount)
                    .currency(currency != null ? currency : "INR")
                    .dueDate(dueDate)
                    .sourceType(sourceType)
                    .sourceId(sourceId)
                    .invoiceId(invoiceId)
                    .referenceId(referenceId)
                    .remarks(remarks)
                    .grossAmount(grossAmount)
                    .discountAmount(discountAmount)
                    .build();
            repository.save(entry);
        } catch (Exception e) {
            // Never let ledger writes fail the calling transaction
            log.error("Failed to write user_account_ledger entry [{}] for user={} institute={}: {}",
                    eventType, userId, instituteId, e.getMessage(), e);
        }
    }

    private UserAccountLedgerEntryDTO toDTO(UserAccountLedger e) {
        return UserAccountLedgerEntryDTO.builder()
                .id(e.getId())
                .eventType(e.getEventType())
                .amount(e.getAmount())
                .currency(e.getCurrency())
                .dueDate(e.getDueDate())
                .sourceType(e.getSourceType())
                .sourceId(e.getSourceId())
                .invoiceId(e.getInvoiceId())
                .referenceId(e.getReferenceId())
                .remarks(e.getRemarks())
                .createdAt(e.getCreatedAt())
                .grossAmount(e.getGrossAmount())
                .discountAmount(e.getDiscountAmount())
                .build();
    }
}
