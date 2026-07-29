package vacademy.io.community_service.feature.pricing.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.community_service.feature.pricing.dto.BracketDto;
import vacademy.io.community_service.feature.pricing.dto.QuoteRequestDto;
import vacademy.io.community_service.feature.pricing.dto.QuoteResponseDto;
import vacademy.io.community_service.feature.pricing.dto.QuoteResponseDto.LineItemDto;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * Turns a plan configuration into a priced quote.
 *
 * Order of operations: price every recurring line at list → apply the billing-cycle adjustment to
 * that subtotal only → add one-time fees (never discounted) → add GST on the lot (INR only).
 */
@Service
public class QuoteCalculator {

    @Autowired
    private RateCard rateCard;

    public QuoteResponseDto price(QuoteRequestDto req) {
        BracketDto bracket = resolveBracket(req);
        int students = bracket.getMaxStudents();

        // Internal mode can override the per-student rate; everything derived follows the override.
        BigDecimal perStudent = req.getPerStudentOverride() != null
                && req.getPerStudentOverride().signum() > 0
                ? req.getPerStudentOverride()
                : bracket.getPerStudentPerYear();

        boolean inr = !"USD".equalsIgnoreCase(req.getCurrency());
        List<LineItemDto> recurring = new ArrayList<>();
        List<LineItemDto> oneTime = new ArrayList<>();

        // ---- LMS -----------------------------------------------------------------
        if (req.isLms()) {
            recurring.add(line("LMS", "LMS — courses, batches, exams & live classes",
                    students + " learners × " + money(perStudent, inr),
                    perStudent.multiply(BigDecimal.valueOf(students)), false, false));
        }

        // ---- Parent app: a fifth of the per-student rate, across the same learners --
        if (req.isParentApp()) {
            BigDecimal rate = perStudent.divide(BigDecimal.valueOf(RateCard.PARENT_APP_DIVISOR),
                    2, RoundingMode.HALF_UP);
            recurring.add(line("PARENT_APP", "Parent app",
                    students + " learners × " + money(rate, inr),
                    rate.multiply(BigDecimal.valueOf(students)), false, false));
        }

        // ---- Mobile apps: one-time, waived once the bracket covers them -------------
        if (req.isAndroid()) {
            boolean free = bracket.isAndroidIncluded();
            oneTime.add(line("ANDROID", "Android app", free ? "Included in " + bracket.getName() : "One-time",
                    free ? BigDecimal.ZERO : RateCard.ANDROID_ONE_TIME, true, free));
        }
        if (req.isIos()) {
            boolean free = bracket.isIosIncluded();
            oneTime.add(line("IOS", "iOS app", free ? "Included in " + bracket.getName() : "One-time",
                    free ? BigDecimal.ZERO : RateCard.IOS_ONE_TIME, true, free));
        }

        // ---- Website builder + course catalogue ------------------------------------
        // Free from the Scale bracket up; below that it is a yearly development-and-maintenance fee.
        if (req.isWebsite()) {
            boolean free = bracket.isWebsiteIncluded();
            recurring.add(line("WEBSITE", "Website builder & course catalogue",
                    free ? "Included in " + bracket.getName() : "Development & maintenance, per year",
                    free ? BigDecimal.ZERO : RateCard.WEBSITE_ANNUAL, false, free));
        }

        // ---- WhatsApp + payments: one combined line, free from Pro up ---------------
        if (req.isWhatsapp() || req.isPayments()) {
            boolean free = bracket.isCommsIncluded();
            String label = req.isWhatsapp() && req.isPayments()
                    ? "WhatsApp & payment integration"
                    : req.isWhatsapp() ? "WhatsApp integration" : "Payment integration";
            recurring.add(line("COMMS", label,
                    free ? "Included in " + bracket.getName() : "Per year",
                    free ? BigDecimal.ZERO : RateCard.WHATSAPP_AND_PAYMENTS, false, free));
        }

        // ---- CRM: flat base with 10 seats, then per extra seat ----------------------
        if (req.isCrm()) {
            recurring.add(line("CRM", "CRM",
                    "Includes " + RateCard.CRM_INCLUDED_SEATS + " team members",
                    RateCard.CRM_BASE, false, false));
            int seats = req.getCrmSeats() == null ? RateCard.CRM_INCLUDED_SEATS : req.getCrmSeats();
            int extra = Math.max(0, seats - RateCard.CRM_INCLUDED_SEATS);
            if (extra > 0) {
                recurring.add(line("CRM_SEATS", "Additional CRM team members",
                        extra + " × " + money(RateCard.CRM_EXTRA_SEAT, inr),
                        RateCard.CRM_EXTRA_SEAT.multiply(BigDecimal.valueOf(extra)), false, false));
            }
        }

        // ---- Sub-organizations: bracket allowance, then per extra ------------------
        if (req.isSubOrgs()) {
            int wanted = req.getSubOrgCount() == null ? bracket.getIncludedSubOrgs() : req.getSubOrgCount();
            int included = Math.min(wanted, bracket.getIncludedSubOrgs());
            int extra = Math.max(0, wanted - bracket.getIncludedSubOrgs());
            if (included > 0) {
                recurring.add(line("SUB_ORGS_INCLUDED", "Sub-organizations",
                        included + " included in " + bracket.getName(), BigDecimal.ZERO, false, true));
            }
            if (extra > 0) {
                recurring.add(line("SUB_ORGS_EXTRA", "Additional sub-organizations",
                        extra + " × " + money(RateCard.EXTRA_SUB_ORG, inr),
                        RateCard.EXTRA_SUB_ORG.multiply(BigDecimal.valueOf(extra)), false, false));
            }
        }

        // ---- Vacademy Meet: usage-based, own Zoom/Meet costs nothing ---------------
        if (req.isVacademyMeet()) {
            int perMonth = req.getMeetSessionsPerMonth() == null ? 0 : Math.max(0, req.getMeetSessionsPerMonth());
            BigDecimal annual = RateCard.MEET_PER_SESSION_HOUR
                    .multiply(BigDecimal.valueOf((long) perMonth * 12));
            recurring.add(line("MEET", "Vacademy Meet (live classes)",
                    perMonth + " session-hours/month × " + money(RateCard.MEET_PER_SESSION_HOUR, inr),
                    annual, false, false));
        }

        // ---- Support --------------------------------------------------------------
        String tier = StringUtils.hasText(req.getSupportTier()) ? req.getSupportTier().toUpperCase() : "BASIC";
        if ("DEDICATED".equals(tier)) {
            // Dedicated replaces premium rather than stacking on top of it.
            recurring.add(line("SUPPORT_DEDICATED", "Dedicated support",
                    money(RateCard.DEDICATED_SUPPORT_MONTHLY, inr) + " × 12 months",
                    RateCard.DEDICATED_SUPPORT_MONTHLY.multiply(BigDecimal.valueOf(12)), false, false));
        } else if ("PREMIUM".equals(tier)) {
            boolean free = bracket.isPremiumSupportIncluded();
            recurring.add(line("SUPPORT_PREMIUM", "Premium support",
                    free ? "Included in " + bracket.getName() : "Upgrade from basic",
                    free ? BigDecimal.ZERO : RateCard.PREMIUM_SUPPORT_UPGRADE, false, free));
        } else {
            recurring.add(line("SUPPORT_BASIC", "Basic support", "Included", BigDecimal.ZERO, false, true));
        }

        // ---- Custom development (internal mode) ------------------------------------
        if (req.getCustomFeatureAmount() != null && req.getCustomFeatureAmount().signum() > 0) {
            oneTime.add(line("CUSTOM", StringUtils.hasText(req.getCustomFeatureLabel())
                            ? req.getCustomFeatureLabel() : "Custom feature development",
                    "One-time", req.getCustomFeatureAmount(), true, false));
        }

        // ---- Totals ---------------------------------------------------------------
        BigDecimal recurringAnnual = sum(recurring);
        BigDecimal oneTimeTotal = sum(oneTime);

        String cycle = StringUtils.hasText(req.getBillingCycle()) ? req.getBillingCycle().toUpperCase() : "ANNUAL";
        BigDecimal multiplier = switch (cycle) {
            case "MONTHLY" -> RateCard.MONTHLY_UPLIFT;
            case "HALF_YEARLY" -> RateCard.HALF_YEARLY;
            default -> RateCard.ANNUAL_DISCOUNT;
        };
        BigDecimal adjustedRecurring = scale(recurringAnnual.multiply(multiplier));
        BigDecimal cycleAdjustment = scale(adjustedRecurring.subtract(recurringAnnual));

        BigDecimal subtotal = scale(adjustedRecurring.add(oneTimeTotal));
        BigDecimal taxRate = inr ? RateCard.GST_RATE : BigDecimal.ZERO;
        BigDecimal taxAmount = scale(subtotal.multiply(taxRate));
        BigDecimal total = scale(subtotal.add(taxAmount));

        // Everything above is in INR; convert once, at the end, so rounding happens in one place.
        if (!inr) {
            recurring.forEach(l -> l.setAmount(toUsd(l.getAmount())));
            oneTime.forEach(l -> l.setAmount(toUsd(l.getAmount())));
            recurringAnnual = toUsd(recurringAnnual);
            adjustedRecurring = toUsd(adjustedRecurring);
            cycleAdjustment = toUsd(cycleAdjustment);
            oneTimeTotal = toUsd(oneTimeTotal);
            subtotal = toUsd(subtotal);
            taxAmount = toUsd(taxAmount);
            total = toUsd(total);
        }

        int payments = switch (cycle) {
            case "MONTHLY" -> 12;
            case "HALF_YEARLY" -> 2;
            default -> 1;
        };
        BigDecimal perPayment = scale(adjustedRecurring.divide(BigDecimal.valueOf(payments), 2, RoundingMode.HALF_UP));

        return QuoteResponseDto.builder()
                .rateCardVersion(RateCard.VERSION)
                .currency(inr ? "INR" : "USD")
                .currencySymbol(inr ? "₹" : "$")
                .billingCycle(cycle)
                .bracketCode(bracket.getCode())
                .bracketName(bracket.getName())
                .studentCount(students)
                .recurringLines(recurring)
                .oneTimeLines(oneTime)
                .recurringAnnual(recurringAnnual)
                .cycleAdjustment(cycleAdjustment)
                .cycleAdjustmentLabel(switch (cycle) {
                    case "MONTHLY" -> "Monthly billing (+20%)";
                    case "HALF_YEARLY" -> "Half-yearly billing";
                    default -> "Paid annually upfront (−15%)";
                })
                .oneTimeTotal(oneTimeTotal)
                .subtotal(subtotal)
                .taxRate(taxRate)
                .taxAmount(taxAmount)
                .taxLabel(inr ? "GST (18%)" : "No GST (export)")
                .total(total)
                .perPaymentAmount(perPayment)
                .perPaymentLabel(switch (cycle) {
                    case "MONTHLY" -> "per month";
                    case "HALF_YEARLY" -> "every 6 months";
                    default -> "once a year";
                })
                .included(bracket.getIncludes())
                .build();
    }

    private BracketDto resolveBracket(QuoteRequestDto req) {
        if (StringUtils.hasText(req.getBracketCode())) {
            BracketDto b = rateCard.bracket(req.getBracketCode());
            if (b != null) return b;
        }
        return rateCard.bracketFor(req.getStudentCount() == null ? 0 : req.getStudentCount());
    }

    private static LineItemDto line(String code, String label, String detail, BigDecimal amount,
                                    boolean oneTime, boolean includedFree) {
        return LineItemDto.builder()
                .code(code).label(label).detail(detail)
                .amount(scale(amount)).oneTime(oneTime).includedFree(includedFree)
                .build();
    }

    private static BigDecimal sum(List<LineItemDto> lines) {
        return scale(lines.stream().map(LineItemDto::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    private static BigDecimal toUsd(BigDecimal inr) {
        return scale(inr.multiply(RateCard.USD_PER_INR));
    }

    private static BigDecimal scale(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    private static String money(BigDecimal v, boolean inr) {
        BigDecimal shown = inr ? v : toUsd(v);
        return (inr ? "₹" : "$") + shown.stripTrailingZeros().toPlainString();
    }
}
