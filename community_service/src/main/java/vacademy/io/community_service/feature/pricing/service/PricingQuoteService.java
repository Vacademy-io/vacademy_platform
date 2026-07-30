package vacademy.io.community_service.feature.pricing.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.community_service.feature.onboarding.entity.OnboardingSubmission;
import vacademy.io.community_service.feature.onboarding.repository.OnboardingSubmissionRepository;
import vacademy.io.community_service.feature.onboarding.service.OnboardingJson;
import vacademy.io.community_service.feature.onboarding.service.OnboardingRecipientService;
import vacademy.io.community_service.feature.pricing.dto.QuoteRequestDto;
import vacademy.io.community_service.feature.pricing.dto.QuoteResponseDto;
import vacademy.io.community_service.feature.pricing.entity.PricingQuote;
import vacademy.io.community_service.feature.pricing.repository.PricingQuoteRepository;

import java.util.Date;
import java.util.List;
import java.util.Optional;

/** Prices, persists and looks up quotes, and keeps them attached to the lead they belong to. */
@Service
@Slf4j
public class PricingQuoteService {

    @Autowired
    private PricingQuoteRepository repository;
    @Autowired
    private QuoteCalculator calculator;
    @Autowired
    private OnboardingSubmissionRepository submissionRepository;
    @Autowired
    private PricingAlertService alertService;
    @Autowired
    private OnboardingRecipientService recipientService;
    @Autowired
    private OnboardingJson json;

    /** Stateless pricing — what the builder calls on every keystroke. Nothing is written. */
    public QuoteResponseDto preview(QuoteRequestDto req) {
        return calculator.price(req);
    }

    /**
     * Prices and saves. When the request carries a submissionId the quote is attached to that lead
     * and any contact details it is missing are backfilled from the submission, so a quote built
     * straight after the form never has to re-ask for a name or a phone number.
     */
    public QuoteResponseDto save(QuoteRequestDto req, String userId, boolean internal) {
        QuoteResponseDto priced = calculator.price(req);

        String name = req.getContactName();
        String email = req.getContactEmail();
        String phone = req.getContactPhone();
        String org = req.getOrganizationName();

        if (StringUtils.hasText(req.getSubmissionId())) {
            Optional<OnboardingSubmission> lead = submissionRepository.findById(req.getSubmissionId());
            if (lead.isPresent()) {
                OnboardingSubmission s = lead.get();
                name = firstNonBlank(name, s.getContactName());
                email = firstNonBlank(email, s.getContactEmail());
                phone = firstNonBlank(phone, s.getContactPhone());
                org = firstNonBlank(org, s.getOrganizationName());
            } else {
                log.warn("Quote references unknown submission {}", req.getSubmissionId());
            }
        }

        // A cold quote is still a lead — we ask for name/email/phone before the builder opens.
        if (!internal && !StringUtils.hasText(email) && !StringUtils.hasText(phone)) {
            throw new VacademyException(HttpStatus.BAD_REQUEST,
                    "We need an email or phone number to save this plan");
        }

        PricingQuote quote = PricingQuote.builder()
                .submissionId(emptyToNull(req.getSubmissionId()))
                .source(internal ? "INTERNAL"
                        : StringUtils.hasText(req.getSubmissionId()) ? "ONBOARDING" : "STANDALONE")
                .status("DRAFT")
                .contactName(name)
                .contactEmail(email)
                .contactPhone(phone)
                .organizationName(org)
                .currency(priced.getCurrency())
                // The plan mix lives in `selections`; these two only carry the LMS tier, when there is one.
                .bracketCode(lmsPlanCode(req))
                .studentCount(0)
                .billingCycle(priced.getBillingCycle())
                .selections(json.write(req))
                .breakdown(json.write(priced))
                .recurringAnnual(priced.getRecurringAnnual())
                .cycleAdjustment(priced.getCycleAdjustment())
                .oneTimeTotal(priced.getOneTimeTotal())
                .subtotal(priced.getSubtotal())
                .taxAmount(priced.getTaxAmount())
                .total(priced.getTotal())
                .rateCardVersion(priced.getRateCardVersion())
                .createdByUserId(userId)
                .build();

        quote = repository.save(quote);
        priced.setQuoteId(quote.getId());

        // Tell the team. Best-effort: a mail failure must never cost us the quote we just saved.
        try {
            alertService.onQuoteSaved(quote, priced, recipientService.activeEmails());
        } catch (Exception e) {
            log.error("Pricing alert failed for quote {}: {}", quote.getId(), e.getMessage());
        }
        return priced;
    }

    public List<PricingQuote> forSubmission(String submissionId) {
        return repository.findBySubmissionIdOrderByCreatedAtDesc(submissionId);
    }

    public Page<PricingQuote> search(String status, String source, int page, int size) {
        return repository.search(emptyToNull(status), emptyToNull(source),
                PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 100)));
    }

    /**
     * Records the demo workspace this quote produced. Also nudges the quote out of DRAFT — a lead
     * you've built a workspace for has clearly been engaged with.
     */
    public PricingQuote markProvisioned(String id, String instituteId, Date demoExpiresAt) {
        PricingQuote q = repository.findById(id)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Quote not found"));
        q.setProvisionedInstituteId(instituteId);
        q.setProvisionedAt(new Date());
        q.setDemoExpiresAt(demoExpiresAt);
        if ("DRAFT".equals(q.getStatus())) {
            q.setStatus("SENT");
        }
        return repository.save(q);
    }

    public PricingQuote updateStatus(String id, String status) {
        PricingQuote q = repository.findById(id)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Quote not found"));
        q.setStatus(status == null ? "DRAFT" : status.toUpperCase());
        return repository.save(q);
    }

    /** The LMS tier, promoted onto its own column so the sales list can sort and filter on size. */
    private static String lmsPlanCode(QuoteRequestDto req) {
        if (req.getSelections() == null) {
            return null;
        }
        return req.getSelections().stream()
                .filter(s -> "LMS".equalsIgnoreCase(s.getProductCode()))
                .map(QuoteRequestDto.SelectionDto::getPlanCode)
                .filter(StringUtils::hasText)
                .findFirst()
                .orElse(null);
    }

    private static String firstNonBlank(String a, String b) {
        return StringUtils.hasText(a) ? a : b;
    }

    private static String emptyToNull(String v) {
        return StringUtils.hasText(v) ? v : null;
    }
}
