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
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return;
        save(userId, instituteId, "DEBIT_ACCRUAL", amount, currency,
                dueDate, sourceType, sourceId, invoiceId, null, remarks);
    }

    /** Called when a payment is confirmed (gateway success or manual offline). */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordCreditPayment(String userId, String instituteId,
                                    BigDecimal amount, String currency,
                                    String sourceType, String sourceId,
                                    String paymentLogId, String invoiceId, String remarks) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) return;
        save(userId, instituteId, "CREDIT_PAYMENT", amount, currency,
                null, sourceType, sourceId, invoiceId, paymentLogId, remarks);
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
        BigDecimal overdue      = repository.sumOverdue(userId, instituteId);

        // Supplement with admin invoices that pre-date the ledger integration
        // (invoices with no corresponding DEBIT_ACCRUAL entry yet)
        BigDecimal extraAccruals = invoiceRepository.sumUnledgeredAdminInvoiceAccruals(userId, instituteId);
        BigDecimal extraPayments = invoiceRepository.sumUnledgeredAdminInvoicePayments(userId, instituteId);
        if (extraAccruals != null) totalAccrued = totalAccrued.add(extraAccruals);
        if (extraPayments != null) totalPaid    = totalPaid.add(extraPayments);

        BigDecimal balance      = totalAccrued.subtract(totalPaid).max(BigDecimal.ZERO);

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
                .build();
    }
}
