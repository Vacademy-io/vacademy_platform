package vacademy.io.admin_core_service.features.user_subscription.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import jakarta.servlet.http.HttpServletRequest;
import vacademy.io.admin_core_service.features.admin_activity_logs.async.AsyncAuditDispatcher;
import vacademy.io.admin_core_service.features.admin_activity_logs.entity.AdminActivityLog;
import vacademy.io.admin_core_service.features.admin_activity_logs.repository.AdminActivityLogRepository;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.admin_core_service.features.institute.service.setting.InstituteSettingService;
import vacademy.io.admin_core_service.features.invoice.entity.Invoice;
import vacademy.io.admin_core_service.features.invoice.entity.InvoicePaymentLogMapping;
import vacademy.io.admin_core_service.features.invoice.repository.InvoicePaymentLogMappingRepository;
import vacademy.io.admin_core_service.features.invoice.repository.InvoiceRepository;
import vacademy.io.admin_core_service.features.user_subscription.entity.PaymentLog;
import vacademy.io.admin_core_service.features.user_subscription.repository.PaymentLogRepository;
import vacademy.io.common.auth.repository.UserRoleRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Permanently deletes a payment or an invoice — the hard delete some institutes want on top of
 * Void. OFF by default: a role may use it only when an admin has switched on
 * {@code learnerManagement.allowDeletePayments} for it under Settings → Display Settings, and
 * that is checked HERE, not just by hiding the buttons.
 *
 * <p>A delete never leaves the books wrong. A payment that still counts is voided first (see
 * {@link PaymentVoidService}: installments get their money back, invoices are unwound, the credit
 * is reversed), and only then are its rows removed. What the removal takes with it:
 * <ul>
 *   <li>its allocation rows, line items, invoice links and ledger credit/reversal pair (the pair
 *       nets to zero, so the learner's totals do not move);</li>
 *   <li>any invoice generated FROM it that no other payment shares. A bill the payment had settled
 *       is not deleted — voiding already reopened it as unpaid, because it is still owed.</li>
 * </ul>
 *
 * <p>What is refused, because a delete could not be undone cleanly:
 * <ul>
 *   <li>gateway payments (Razorpay, Stripe, …) — real money moved; refund it in the gateway;</li>
 *   <li>anything a live-class registration or a plan-change request still points at;</li>
 *   <li>an invoice with a live (PAID) payment against it — delete or void that payment first.</li>
 * </ul>
 *
 * <p>The deleted record survives in the admin activity log: a DELETE row carrying a snapshot of it
 * is written in the same transaction as the delete (not by the {@code @Auditable} aspect, whose
 * write is best-effort), and every refused attempt leaves a DELETE_BLOCKED row.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentDeletionService {

    /** The Display Settings flag, under {@code learnerManagement}. Absent means OFF. */
    public static final String ALLOW_DELETE_FLAG = "allowDeletePayments";

    private static final String ADMIN_SETTINGS_KEY = "ADMIN_DISPLAY_SETTINGS";
    private static final String TEACHER_SETTINGS_KEY = "TEACHER_DISPLAY_SETTINGS";
    private static final String ROLE_SETTINGS_KEY = "ROLE_DISPLAY_SETTINGS";
    private static final String LEARNER_MANAGEMENT = "learnerManagement";

    private static final Set<String> DELETABLE_VENDORS = Set.of("MANUAL", "OFFLINE");
    private static final Set<String> BILL_SOURCES = Set.of("ADMIN_MANUAL", "LIVE_SESSION");

    private final PaymentLogRepository paymentLogRepository;
    private final InvoiceRepository invoiceRepository;
    private final InvoicePaymentLogMappingRepository invoicePaymentLogMappingRepository;
    private final PaymentVoidService paymentVoidService;
    private final UserRoleRepository userRoleRepository;
    private final InstituteSettingService instituteSettingService;
    private final AsyncAuditDispatcher auditDispatcher;
    private final AdminActivityLogRepository adminActivityLogRepository;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    @PersistenceContext
    private EntityManager entityManager;

    // ------------------------------------------------------------------ permission

    /**
     * Whether this caller may hard-delete in this institute, resolved the way the admin app picks a
     * user's Display Settings card (getActiveRoleDisplaySettingsKey): an ADMIN reads only the admin
     * card; anyone whose roles have a custom-role card reads only those cards; everyone else reads
     * the teacher card. So the server allows exactly what the screen offers — a teacher-card grant
     * never reaches someone the app shows a custom-role card, and vice versa. Fails CLOSED — no
     * setting, a malformed blob or a lookup error all mean no.
     */
    public boolean canDelete(String userId, String instituteId) {
        if (!StringUtils.hasText(userId) || !StringUtils.hasText(instituteId)) return false;
        try {
            if (userRoleRepository.existsByUserIdAndInstituteIdAndRoleName(userId, instituteId, "ADMIN")) {
                return flagOn(instituteSettingService.getSettingByInstituteIdAndKey(instituteId, ADMIN_SETTINGS_KEY));
            }
            List<String> roleIds = userRoleRepository.findActiveRoleIdsByUserIdAndInstituteId(userId, instituteId);
            Object byRole = instituteSettingService.getSettingByInstituteIdAndKey(instituteId, ROLE_SETTINGS_KEY);
            if (roleIds != null && byRole instanceof Map<?, ?> roles) {
                List<Object> cards = roleIds.stream().filter(id -> id != null && roles.containsKey(id))
                        .map(roles::get).map(Object.class::cast).toList();
                if (!cards.isEmpty()) {
                    return cards.stream().anyMatch(PaymentDeletionService::flagOn);
                }
            }
            return flagOn(instituteSettingService.getSettingByInstituteIdAndKey(instituteId, TEACHER_SETTINGS_KEY));
        } catch (Exception e) {
            log.warn("canDelete({}, {}) failed, treating as not allowed: {}", userId, instituteId, e.getMessage());
            return false;
        }
    }

    private static boolean flagOn(Object settings) {
        if (!(settings instanceof Map<?, ?> map)) return false;
        Object section = map.get(LEARNER_MANAGEMENT);
        return section instanceof Map<?, ?> lm && Boolean.TRUE.equals(lm.get(ALLOW_DELETE_FLAG));
    }

    private static final String TURNED_OFF_MESSAGE = "Deleting payments and invoices is turned off for your role. "
            + "An admin can turn it on under Settings → Display Settings → Learner Management.";

    // ------------------------------------------------------------------ blocked attempts

    /**
     * A refused permanent delete leaves its own row in the admin activity log. The
     * {@code @Auditable} aspect records only successful calls, and for a destructive action the
     * attempt matters too: who tried, on what, and why it was refused. Written through the async
     * dispatcher, which commits in its own transaction, so the row survives the rollback of the
     * refused request. Action {@code DELETE_BLOCKED} — never {@code DELETE} — so the log can never
     * read as if the record had gone.
     */
    private void recordBlocked(String entityType, String entityId, String instituteId,
                               String userId, String reason, int httpStatus) {
        if (!StringUtils.hasText(instituteId)) return; // admin_activity_log.institute_id is NOT NULL
        try {
            auditDispatcher.dispatch(auditRow(entityType, entityId, instituteId, userId, "DELETE_BLOCKED",
                    "tried to permanently delete " + entityType.toLowerCase() + " " + entityId
                            + " — blocked: " + reason,
                    httpStatus, null));
        } catch (Exception e) {
            log.warn("Could not record blocked delete of {} {}: {}", entityType, entityId, e.getMessage());
        }
    }

    /**
     * The activity-log row for a delete that went through. Saved in the SAME transaction as the
     * delete, so the two stand or fall together: a permanent delete that could not be recorded does
     * not happen. The before-payload is the only surviving copy of what was deleted.
     */
    private void recordDeleted(String entityType, String entityId, String instituteId, String userId,
                               String description, Map<String, Object> snapshot) {
        String before;
        try {
            before = objectMapper.writeValueAsString(snapshot);
        } catch (Exception e) {
            before = String.valueOf(snapshot);
        }
        adminActivityLogRepository.save(auditRow(entityType, entityId, instituteId, userId, "DELETE",
                description, 200, before));
    }

    private static AdminActivityLog auditRow(String entityType, String entityId, String instituteId,
                                             String userId, String action, String description,
                                             int httpStatus, String beforePayload) {
        HttpServletRequest request = currentRequest();
        Object attr = request != null ? request.getAttribute("user") : null;
        CustomUserDetails user = attr instanceof CustomUserDetails u ? u : null;
        String forwarded = request != null ? request.getHeader("X-Forwarded-For") : null;
        return AdminActivityLog.builder()
                .instituteId(instituteId)
                .actorId(user != null ? user.getUserId() : userId)
                .actorName(cap(user != null ? user.getFullName() : null))
                .actorEmail(cap(user != null ? user.getUsername() : null))
                .entityType(entityType)
                .entityId(entityId)
                .action(action)
                .httpMethod(request != null ? request.getMethod() : "DELETE")
                .endpoint(cap(request != null ? request.getRequestURI() : null))
                .description(description)
                .beforePayload(beforePayload)
                .ipAddress(cap(StringUtils.hasText(forwarded) ? forwarded.split(",")[0].trim()
                        : request != null ? request.getRemoteAddr() : null))
                .userAgent(cap(request != null ? request.getHeader("User-Agent") : null))
                .responseStatus(httpStatus)
                .build();
    }

    /** The string columns are VARCHAR(512); a long user agent must not lose the row. */
    private static String cap(String value) {
        return value != null && value.length() > 500 ? value.substring(0, 500) : value;
    }

    private static HttpServletRequest currentRequest() {
        RequestAttributes attrs = RequestContextHolder.getRequestAttributes();
        return attrs instanceof ServletRequestAttributes servlet ? servlet.getRequest() : null;
    }

    // ------------------------------------------------------------------ payment

    @Transactional
    public Map<String, Object> deletePayment(String paymentLogId, String instituteId, String userId) {
        if (!StringUtils.hasText(instituteId)) throw new VacademyException("instituteId is required");
        if (!canDelete(userId, instituteId)) {
            recordBlocked("PAYMENT", paymentLogId, instituteId, userId, TURNED_OFF_MESSAGE, 403);
            throw new VacademyException(TURNED_OFF_MESSAGE);
        }
        try {
            return removePayment(paymentLogId, instituteId, userId);
        } catch (VacademyException e) {
            recordBlocked("PAYMENT", paymentLogId, instituteId, userId, e.getMessage(), 400);
            throw e;
        }
    }

    private Map<String, Object> removePayment(String paymentLogId, String instituteId, String userId) {
        paymentVoidService.assertNotSubOrgAdmin(userId);
        Map<String, Object> snapshot = paymentAuditSnapshot(paymentLogId);

        PaymentLog paymentLog = paymentLogRepository.findById(paymentLogId)
                .orElseThrow(() -> new VacademyException("Payment not found: " + paymentLogId));
        String vendor = paymentLog.getVendor() != null ? paymentLog.getVendor().trim().toUpperCase() : "";
        if (!DELETABLE_VENDORS.contains(vendor)) {
            throw new VacademyException("Only offline or manually recorded payments can be deleted. "
                    + "An online payment has to be refunded through the payment gateway.");
        }
        String status = paymentLog.getPaymentStatus() != null ? paymentLog.getPaymentStatus().toUpperCase() : "";
        if (!"PAID".equals(status) && !PaymentVoidService.VOIDED.equals(status)) {
            throw new VacademyException("Only a paid or voided payment can be deleted (status: "
                    + paymentLog.getPaymentStatus() + ")");
        }
        if (countReferences("session_guest_registrations", "payment_log_id", paymentLogId) > 0
                || countReferences("user_plan_change_request", "payment_log_id", paymentLogId) > 0) {
            throw new VacademyException("This payment is linked to a live-class registration or a plan "
                    + "change and cannot be deleted. Void it instead.");
        }

        // 1. A payment that still counts is voided first — this also checks the institute and puts
        //    the installments, invoices and ledger right. A voided one is checked here instead.
        if ("PAID".equals(status)) {
            paymentVoidService.voidPayment(paymentLogId, instituteId, "Deleted permanently", userId);
        } else {
            paymentVoidService.assertBelongsToInstitute(paymentLog, instituteId);
        }

        // 2. Work out which invoices go with it: one generated FROM this payment that no other
        //    payment shares. A bill it had settled stays — the void already reopened it.
        entityManager.flush();
        List<String> invoicesToDelete = new ArrayList<>();
        List<String> deletedInvoices = new ArrayList<>();
        for (InvoicePaymentLogMapping mapping : invoicePaymentLogMappingRepository.findAllByPaymentLogId(paymentLogId)) {
            Invoice invoice = mapping.getInvoice();
            if (invoice == null || BILL_SOURCES.contains(invoice.getSource())) continue;
            boolean shared = invoicePaymentLogMappingRepository.findByInvoiceId(invoice.getId()).stream()
                    .anyMatch(m -> m.getPaymentLog() != null && !paymentLogId.equals(m.getPaymentLog().getId()));
            if (!shared) {
                invoicesToDelete.add(invoice.getId());
                deletedInvoices.add(invoice.getInvoiceNumber() != null ? invoice.getInvoiceNumber() : invoice.getId());
            }
        }
        Object amount = paymentLog.getPaymentAmount();
        String currency = paymentLog.getCurrency();

        // 3. Remove the rows with plain SQL, children before parents. Deleting through JPA would
        //    trip UserPlan.paymentLogs (CascadeType.ALL): a loaded plan re-saves the payment.
        //    Everything the void changed was flushed above, so nothing pending is lost.
        //    The ledger credit and the reversal the void posted net to zero; both go.
        execute("DELETE FROM user_account_ledger WHERE reference_id = ?1 "
                + "AND event_type IN ('CREDIT_PAYMENT', 'CREDIT_REVERSAL')", paymentLogId);
        execute("DELETE FROM student_fee_allocation_ledger WHERE payment_log_id = ?1", paymentLogId);
        execute("DELETE FROM payment_log_line_item WHERE payment_log_id = ?1", paymentLogId);
        execute("DELETE FROM invoice_payment_log_mapping WHERE payment_log_id = ?1", paymentLogId);
        for (String invoiceId : invoicesToDelete) {
            removeInvoiceRows(invoiceId);
        }
        int removed = execute("DELETE FROM payment_log WHERE id = ?1", paymentLogId);
        if (removed != 1) {
            throw new VacademyException("Payment could not be deleted, nothing was changed");
        }
        // Drop the managed copies of rows that no longer exist.
        entityManager.clear();

        snapshot.put("invoices_deleted", deletedInvoices);
        recordDeleted("PAYMENT", paymentLogId, instituteId, userId,
                "permanently deleted payment of " + amount + " " + (currency != null ? currency : "")
                        + (deletedInvoices.isEmpty() ? "" : " and invoice(s) " + String.join(", ", deletedInvoices)),
                snapshot);
        log.info("[PaymentDelete] paymentLog={} amount={} institute={} deletedBy={} invoicesDeleted={}",
                paymentLogId, amount, instituteId, userId, deletedInvoices);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("payment_log_id", paymentLogId);
        result.put("amount", amount);
        result.put("currency", currency);
        result.put("invoices_deleted", deletedInvoices);
        return result;
    }

    // ------------------------------------------------------------------ invoice

    @Transactional
    public Map<String, Object> deleteInvoice(String invoiceId, String instituteId, String userId) {
        if (!StringUtils.hasText(instituteId)) throw new VacademyException("instituteId is required");
        if (!canDelete(userId, instituteId)) {
            recordBlocked("INVOICE", invoiceId, instituteId, userId, TURNED_OFF_MESSAGE, 403);
            throw new VacademyException(TURNED_OFF_MESSAGE);
        }
        try {
            return removeInvoice(invoiceId, instituteId, userId);
        } catch (VacademyException e) {
            recordBlocked("INVOICE", invoiceId, instituteId, userId, e.getMessage(), 400);
            throw e;
        }
    }

    private Map<String, Object> removeInvoice(String invoiceId, String instituteId, String userId) {
        paymentVoidService.assertNotSubOrgAdmin(userId);

        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new VacademyException("Invoice not found: " + invoiceId));
        if (!instituteId.equals(invoice.getInstituteId())) {
            throw new VacademyException("Invoice does not belong to this institute");
        }
        if ("LIVE_SESSION".equals(invoice.getSource())
                || countReferences("session_guest_registrations", "invoice_id", invoiceId) > 0) {
            throw new VacademyException("A live-class invoice is tied to a registration and cannot be deleted. "
                    + "Cancel it instead.");
        }
        // Any linked payment that is not finished-and-dead (FAILED / VOIDED) blocks the delete: a
        // PAID one is money received, and a pending gateway checkout could still complete — its
        // webhook would then find no invoice and book the money as a donation.
        boolean hasLivePayment = invoicePaymentLogMappingRepository.findByInvoiceId(invoiceId).stream()
                .map(InvoicePaymentLogMapping::getPaymentLog)
                .anyMatch(pl -> pl != null && !Set.of("FAILED", PaymentVoidService.VOIDED)
                        .contains(pl.getPaymentStatus() != null ? pl.getPaymentStatus().toUpperCase() : ""));
        if (hasLivePayment || "PAID".equalsIgnoreCase(invoice.getStatus())) {
            throw new VacademyException("This invoice has a payment recorded or in progress against it. "
                    + "Delete or void that payment first, then delete the invoice.");
        }
        Map<String, Object> snapshot = invoiceAuditSnapshot(invoiceId);

        String number = invoice.getInvoiceNumber() != null ? invoice.getInvoiceNumber() : invoiceId;
        String source = invoice.getSource();

        // A bill carries its own obligation in the ledger (raised, and reversed if it was
        // cancelled); it goes with the bill. Credits belong to their payments and stay.
        entityManager.flush();
        if (BILL_SOURCES.contains(source)) {
            execute("DELETE FROM user_account_ledger WHERE source_type = 'ADMIN_INVOICE' AND source_id = ?1 "
                    + "AND event_type IN ('DEBIT_ACCRUAL', 'DEBIT_REVERSAL')", invoiceId);
        }
        if (removeInvoiceRows(invoiceId) != 1) {
            throw new VacademyException("Invoice could not be deleted, nothing was changed");
        }
        entityManager.clear();

        recordDeleted("INVOICE", invoiceId, instituteId, userId, "permanently deleted invoice " + number, snapshot);
        log.info("[InvoiceDelete] invoice={} ({}) source={} institute={} deletedBy={}",
                invoiceId, number, source, instituteId, userId);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("invoice_id", invoiceId);
        result.put("invoice_number", number);
        return result;
    }

    /**
     * An invoice and the rows hanging off it. Returns how many invoice rows were deleted.
     *
     * <p>Its number is recorded as released first (V531 {@code invoice_released_number}), so the
     * next invoice in the same series re-issues it instead of leaving a hole in the sequence.
     * Legacy invoices with no sequence position (pre-V432) have nothing to release.
     */
    private int removeInvoiceRows(String invoiceId) {
        execute("INSERT INTO invoice_released_number (institute_id, seq_scope_key, seq_no, invoice_number) "
                + "SELECT institute_id, seq_scope_key, seq_no, invoice_number FROM invoice "
                + "WHERE id = ?1 AND seq_no IS NOT NULL AND seq_scope_key IS NOT NULL "
                + "ON CONFLICT (institute_id, seq_scope_key, seq_no) DO NOTHING", invoiceId);
        execute("DELETE FROM invoice_line_item WHERE invoice_id = ?1", invoiceId);
        execute("DELETE FROM invoice_payment_log_mapping WHERE invoice_id = ?1", invoiceId);
        return execute("DELETE FROM invoice WHERE id = ?1", invoiceId);
    }

    private int execute(String sql, String id) {
        return entityManager.createNativeQuery(sql).setParameter(1, id).executeUpdate();
    }

    /** Rows in a table with no foreign key onto payments/invoices that still point at this id. */
    private long countReferences(String table, String column, String id) {
        Object n = entityManager
                .createNativeQuery("SELECT COUNT(*) FROM " + table + " WHERE " + column + " = ?1")
                .setParameter(1, id)
                .getSingleResult();
        return n instanceof Number num ? num.longValue() : 0L;
    }

    // ------------------------------------------------------------------ audit

    /** What is about to be deleted — stored as the activity log's before-payload. */
    public Map<String, Object> paymentAuditSnapshot(String paymentLogId) {
        Map<String, Object> snap = new LinkedHashMap<>();
        paymentLogRepository.findById(paymentLogId).ifPresent(pl -> {
            snap.put("id", pl.getId());
            snap.put("user_id", pl.getUserId());
            snap.put("amount", pl.getPaymentAmount());
            snap.put("currency", pl.getCurrency());
            snap.put("vendor", pl.getVendor());
            snap.put("payment_status", pl.getPaymentStatus());
            snap.put("date", pl.getDate());
            snap.put("user_plan_id", pl.getUserPlan() != null ? pl.getUserPlan().getId() : null);
            snap.put("payment_specific_data", pl.getPaymentSpecificData());
        });
        return snap;
    }

    public Map<String, Object> invoiceAuditSnapshot(String invoiceId) {
        Map<String, Object> snap = new LinkedHashMap<>();
        invoiceRepository.findById(invoiceId).ifPresent(inv -> {
            snap.put("id", inv.getId());
            snap.put("invoice_number", inv.getInvoiceNumber());
            snap.put("user_id", inv.getUserId());
            snap.put("status", inv.getStatus());
            snap.put("source", inv.getSource());
            snap.put("total_amount", inv.getTotalAmount());
            snap.put("currency", inv.getCurrency());
            snap.put("invoice_date", inv.getInvoiceDate());
        });
        return snap;
    }
}
