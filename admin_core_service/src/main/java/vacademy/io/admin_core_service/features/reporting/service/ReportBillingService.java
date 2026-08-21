package vacademy.io.admin_core_service.features.reporting.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.credits.client.CreditClient;
import vacademy.io.admin_core_service.features.reporting.entity.ReportRun;
import vacademy.io.admin_core_service.features.reporting.spi.ReportSection;

import java.math.BigDecimal;
import java.util.List;

/**
 * What a report costs, and charging it.
 *
 * <h3>The price</h3>
 * {@link #BASE_CREDITS} per DOCUMENT, plus each included section's
 * {@link ReportSection#creditWeight()}. Two things follow from "per document":
 * recipients are free — one report to twenty admins costs the same as to one,
 * which is what makes naming learners in the body defensible — while SCOPE
 * multiplies, because thirty batch reports are thirty computations and thirty
 * emails. Frequency needs no multiplier: daily simply runs thirty times a month.
 *
 * <h3>Charged after delivery, never before</h3>
 * A run that is skipped, empty, or fails to reach anybody must not cost anything —
 * an institute that bleeds credits to be told "nothing happened" turns reports off
 * and resents them. So the charge happens once the document has actually reached at
 * least one recipient, which makes it post-paid work and is why
 * {@code allow_negative} is the right convention here (the same one transcription
 * and call metering use): the wallet may dip below zero rather than a delivered
 * report going unbilled.
 *
 * <h3>Why a failed charge does not fail the run</h3>
 * By the time the charge is attempted the email is already in the recipient's
 * inbox. Throwing would flip the run to FAILED, and a FAILED row is retried —
 * which would re-send a report that already landed. A charge that cannot be
 * applied is therefore logged loudly and recorded as zero, because sending twice
 * is a worse failure than billing once too little.
 *
 * <h3>Double-charging</h3>
 * Handled by ai_service, not here: {@link CreditClient#deductPrecomputed} carries
 * an idempotency key which is short-circuited against
 * {@code credit_transactions.external_reference_id} (V243 partial unique). The key
 * is the run id, so a replay of the same document charges exactly once no matter
 * how many times this method is reached.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class ReportBillingService {

    /** Charged once per generated document, whatever the recipient count. */
    public static final int BASE_CREDITS = 2;

    /** {@code request_type} on the credit transaction, for attribution. */
    private static final String REQUEST_TYPE = "report";

    /**
     * ai_service validates {@code description} at 500 characters. It embeds the
     * schedule name, which an admin types freely, so an over-long name would fail
     * validation and the charge would be refused for a report already delivered.
     */
    private static final int MAX_DESCRIPTION = 500;

    private final CreditClient creditClient;

    /**
     * Price for one document containing these sections.
     *
     * Takes the sections the RUN computed, not a per-reader subset: two admins with
     * different roles may each see fewer sections than were computed, but the work
     * — and therefore the cost — happened once.
     */
    public BigDecimal costOf(List<ReportSection> sections) {
        int weights = sections == null ? 0
                : sections.stream().mapToInt(ReportSection::creditWeight).sum();
        return BigDecimal.valueOf((long) BASE_CREDITS + weights);
    }

    /**
     * Charge one delivered document, and record what was charged on the run.
     *
     * @return the credits actually charged — zero when the deduction could not be
     *         applied, so the audit never claims money that did not move.
     */
    public BigDecimal chargeForRun(String instituteId, ReportRun run, BigDecimal credits,
                                   String description) {
        if (credits == null || credits.signum() <= 0) return BigDecimal.ZERO;
        try {
            boolean ok = creditClient.deductPrecomputed(
                    instituteId, REQUEST_TYPE, clamp(description), credits,
                    // Stable per document: the run row is created once per
                    // (schedule, window, scope) by the idempotency index.
                    "report:" + run.getId());
            if (!ok) {
                log.error("[reporting] credit deduction REFUSED for institute {} run {} "
                                + "({} credits) — report was already delivered, recording 0",
                        instituteId, run.getId(), credits);
                return BigDecimal.ZERO;
            }
            log.info("[reporting] charged {} credits to institute {} for run {}",
                    credits, instituteId, run.getId());
            return credits;
        } catch (Exception e) {
            // Never rethrow: see the class note on why a billing failure must not
            // turn a delivered run into a retryable one.
            log.error("[reporting] credit deduction FAILED for institute {} run {} ({} credits)",
                    instituteId, run.getId(), credits, e);
            return BigDecimal.ZERO;
        }
    }

    private static String clamp(String description) {
        if (description == null) return "Scheduled report";
        return description.length() <= MAX_DESCRIPTION
                ? description
                : description.substring(0, MAX_DESCRIPTION - 1) + "…";
    }
}
