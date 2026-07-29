package vacademy.io.community_service.feature.pricing.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.community_service.feature.pricing.dto.QuoteRequestDto;
import vacademy.io.community_service.feature.pricing.dto.QuoteRequestDto.SelectionDto;
import vacademy.io.community_service.feature.pricing.dto.QuoteResponseDto;
import vacademy.io.community_service.feature.pricing.dto.QuoteResponseDto.LineItemDto;
import vacademy.io.community_service.feature.pricing.entity.PricingPlan;
import vacademy.io.community_service.feature.pricing.entity.PricingPlanInclusion;
import vacademy.io.community_service.feature.pricing.entity.PricingProduct;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static vacademy.io.community_service.feature.pricing.service.PricingCatalogService.*;

/**
 * Prices a selection of products against the database catalogue.
 *
 * Products are standalone: nothing is waived because of what was bought elsewhere. The only
 * cross-product rule is a declared dependency — a product with requires_product_code is dropped
 * unless its parent is also selected, and one with mirrors_product_code follows the parent's tier.
 *
 * Order of operations: price every recurring line at list → apply the billing-cycle multiplier to
 * that subtotal only → add one-time fees (never discounted) → add GST on the lot (INR only).
 */
@Service
@Slf4j
public class QuoteCalculator {

    @Autowired
    private PricingCatalogService catalog;

    public QuoteResponseDto price(QuoteRequestDto req) {
        boolean inr = !"USD".equalsIgnoreCase(req.getCurrency());
        BigDecimal gstRate = inr ? catalog.setting("gst_rate", "0.18") : BigDecimal.ZERO;
        BigDecimal usdPerInr = catalog.setting("usd_per_inr", "0.01");

        List<LineItemDto> recurring = new ArrayList<>();
        List<LineItemDto> oneTime = new ArrayList<>();
        List<String> included = new ArrayList<>();

        Map<String, SelectionDto> byProduct = new LinkedHashMap<>();
        for (SelectionDto s : safe(req.getSelections())) {
            if (StringUtils.hasText(s.getProductCode())) {
                byProduct.put(s.getProductCode().toUpperCase(), s);
            }
        }

        // First pass: work out what the chosen plans bundle in for free, so a later product can be
        // zeroed regardless of the order it appears in the basket.
        Map<String, PricingPlanInclusion> inclusions = new LinkedHashMap<>();
        Map<String, String> inclusionSource = new LinkedHashMap<>();
        for (SelectionDto sel : byProduct.values()) {
            PricingProduct product = catalog.product(sel.getProductCode()).orElse(null);
            if (product == null || !product.isActive()) continue;
            PricingPlan plan = resolvePlan(product, sel, byProduct);
            if (plan == null) continue;
            catalog.inclusionsFor(plan.getId()).forEach((code, inc) -> {
                inclusions.put(code, inc);
                inclusionSource.put(code, plan.getName());
            });
        }

        for (SelectionDto sel : byProduct.values()) {
            PricingProduct product = catalog.product(sel.getProductCode()).orElse(null);
            if (product == null || !product.isActive()) {
                log.warn("Quote referenced unknown product {}", sel.getProductCode());
                continue;
            }
            // A dependent product is silently dropped when its parent isn't in the basket.
            if (StringUtils.hasText(product.getRequiresProductCode())
                    && !byProduct.containsKey(product.getRequiresProductCode())) {
                continue;
            }

            PricingPlan plan = resolvePlan(product, sel, byProduct);
            if (plan == null) {
                continue;
            }

            BigDecimal unit = sel.getPriceOverride() != null && sel.getPriceOverride().signum() >= 0
                    ? sel.getPriceOverride()
                    : plan.getPrice();

            // A plan elsewhere in the basket may bundle this product in — either wholly, or up to
            // a free allowance with the extras still chargeable.
            PricingPlanInclusion inc = inclusions.get(product.getCode());
            boolean planMatches = inc != null && (inc.getIncludedPlanCode() == null
                    || inc.getIncludedPlanCode().equalsIgnoreCase(plan.getCode()));
            if (inc != null && planMatches && inc.getIncludedQuantity() == null) {
                recurring.add(freeLine(product, plan, inclusionSource.get(product.getCode())));
                continue;
            }

            LineItemDto item = priceOne(product, plan, unit, sel, inr, usdPerInr,
                    inc != null && planMatches ? inc.getIncludedQuantity() : null,
                    inclusionSource.get(product.getCode()));
            if (item == null) {
                continue;
            }
            (item.isOneTime() ? oneTime : recurring).add(item);
            catalog.includedFeatures(plan.getId()).forEach(included::add);
        }

        if (req.getCustomFeatureAmount() != null && req.getCustomFeatureAmount().signum() > 0) {
            oneTime.add(line("CUSTOM", StringUtils.hasText(req.getCustomFeatureLabel())
                    ? req.getCustomFeatureLabel() : "Custom feature development",
                    "One-time", req.getCustomFeatureAmount(), true));
        }

        // ---- totals ---------------------------------------------------------------
        BigDecimal recurringAnnual = sum(recurring);
        BigDecimal oneTimeTotal = sum(oneTime);

        String cycle = StringUtils.hasText(req.getBillingCycle())
                ? req.getBillingCycle().toUpperCase() : "ANNUAL";
        BigDecimal multiplier = switch (cycle) {
            case "MONTHLY" -> catalog.setting("cycle_monthly", "1.20");
            case "HALF_YEARLY" -> catalog.setting("cycle_half_yearly", "1.00");
            default -> catalog.setting("cycle_annual", "0.85");
        };
        BigDecimal adjustedRecurring = scale(recurringAnnual.multiply(multiplier));
        BigDecimal cycleAdjustment = scale(adjustedRecurring.subtract(recurringAnnual));

        BigDecimal subtotal = scale(adjustedRecurring.add(oneTimeTotal));
        BigDecimal taxAmount = scale(subtotal.multiply(gstRate));
        BigDecimal total = scale(subtotal.add(taxAmount));

        int payments = switch (cycle) {
            case "MONTHLY" -> 12;
            case "HALF_YEARLY" -> 2;
            default -> 1;
        };
        // One payment's recurring cost, inc-tax. One-time fees fall due once, so they stay out.
        BigDecimal perPayment = scale(adjustedRecurring
                .divide(BigDecimal.valueOf(payments), 2, RoundingMode.HALF_UP)
                .multiply(BigDecimal.ONE.add(gstRate)));
        BigDecimal oneTimeWithTax = scale(oneTimeTotal.multiply(BigDecimal.ONE.add(gstRate)));

        // Everything above is in INR; convert once, at the end, so rounding happens in one place.
        if (!inr) {
            recurring.forEach(l -> l.setAmount(toUsd(l.getAmount(), usdPerInr)));
            oneTime.forEach(l -> l.setAmount(toUsd(l.getAmount(), usdPerInr)));
            recurringAnnual = toUsd(recurringAnnual, usdPerInr);
            adjustedRecurring = toUsd(adjustedRecurring, usdPerInr);
            cycleAdjustment = toUsd(cycleAdjustment, usdPerInr);
            oneTimeTotal = toUsd(oneTimeTotal, usdPerInr);
            subtotal = toUsd(subtotal, usdPerInr);
            taxAmount = toUsd(taxAmount, usdPerInr);
            total = toUsd(total, usdPerInr);
            perPayment = toUsd(perPayment, usdPerInr);
            oneTimeWithTax = toUsd(oneTimeWithTax, usdPerInr);
        }

        return QuoteResponseDto.builder()
                .rateCardVersion(catalog.settingText("rate_card_version", "unversioned"))
                .currency(inr ? "INR" : "USD")
                .currencySymbol(inr ? "₹" : "$")
                .billingCycle(cycle)
                .recurringLines(recurring)
                .oneTimeLines(oneTime)
                .recurringAnnual(recurringAnnual)
                .recurringAnnualAdjusted(adjustedRecurring)
                .cycleAdjustment(cycleAdjustment)
                .cycleAdjustmentLabel(switch (cycle) {
                    case "MONTHLY" -> "Monthly billing (+20%)";
                    case "HALF_YEARLY" -> "Half-yearly billing";
                    default -> "Paid annually upfront (−15%)";
                })
                .oneTimeTotal(oneTimeTotal)
                .subtotal(subtotal)
                .taxRate(gstRate)
                .taxAmount(taxAmount)
                .taxLabel(inr ? "GST (18%)" : "No GST (export)")
                .total(total)
                .perPaymentAmount(perPayment)
                .perPaymentLabel(switch (cycle) {
                    case "MONTHLY" -> "per month";
                    case "HALF_YEARLY" -> "every 6 months";
                    default -> "per year";
                })
                .paymentsPerYear(payments)
                .oneTimeTotalWithTax(oneTimeWithTax)
                .included(included)
                .build();
    }

    /**
     * The plan a selection resolves to: an explicit choice, the tier mirrored from a parent
     * product, or the product's first active plan for single-plan products.
     */
    private PricingPlan resolvePlan(PricingProduct product, SelectionDto sel,
                                    Map<String, SelectionDto> basket) {
        if (StringUtils.hasText(product.getMirrorsProductCode())) {
            SelectionDto parent = basket.get(product.getMirrorsProductCode());
            if (parent != null && StringUtils.hasText(parent.getPlanCode())) {
                Optional<PricingPlan> mirrored = catalog.plan(product.getCode(), parent.getPlanCode());
                if (mirrored.isPresent()) {
                    return mirrored.get();
                }
            }
        }
        if (StringUtils.hasText(sel.getPlanCode())) {
            return catalog.plan(product.getCode(), sel.getPlanCode())
                    .orElseThrow(() -> new VacademyException(HttpStatus.BAD_REQUEST,
                            "Unknown plan " + sel.getPlanCode() + " for " + product.getCode()));
        }
        return catalog.defaultPlan(product.getCode()).orElse(null);
    }

    /** A product a chosen plan bundles in wholly — shown at zero rather than hidden. */
    private static LineItemDto freeLine(PricingProduct product, PricingPlan plan, String source) {
        return LineItemDto.builder()
                .code(product.getCode())
                .label(product.getName())
                .detail("Included in " + (source == null ? plan.getName() : source))
                .amount(BigDecimal.ZERO)
                .oneTime(false)
                .includedFree(true)
                .build();
    }

    /**
     * Applies the product's pricing model to produce one line. {@code freeUnits} is the allowance
     * a bundling plan grants (sub-orgs), with anything beyond it still charged.
     */
    private LineItemDto priceOne(PricingProduct product, PricingPlan plan, BigDecimal unit,
                                 SelectionDto sel, boolean inr, BigDecimal usdPerInr,
                                 Integer freeUnits, String inclusionSource) {
        String model = product.getPricingModel();
        String symbol = inr ? "₹" : "$";
        int qty = sel.getQuantity() == null
                ? Math.max(1, product.getMinQuantity())
                : Math.max(0, sel.getQuantity());

        switch (model == null ? "" : model) {
            case PER_LEARNER_TIER -> {
                int learners = plan.getUnitCount() == null ? 0 : plan.getUnitCount();
                return line(product.getCode(), product.getName() + " — " + plan.getName(),
                        learners + " learners × " + money(unit, inr, usdPerInr, symbol),
                        unit.multiply(BigDecimal.valueOf(learners)), false);
            }
            case FLAT_ANNUAL -> {
                if (unit.signum() == 0) {
                    return line(product.getCode(), product.getName() + " — " + plan.getName(),
                            "Included", BigDecimal.ZERO, false);
                }
                return line(product.getCode(), product.getName() + " — " + plan.getName(),
                        "Per year", unit, false);
            }
            case ONE_TIME -> {
                return line(product.getCode(), product.getName(), "One-time", unit, true);
            }
            case SEAT_BASED -> {
                BigDecimal base = product.getBasePrice() == null ? unit : product.getBasePrice();
                int included = product.getIncludedUnits() == null ? 0 : product.getIncludedUnits();
                int seats = Math.max(included, qty);
                int extra = Math.max(0, seats - included);
                BigDecimal extraPrice = product.getUnitPrice() == null ? BigDecimal.ZERO : product.getUnitPrice();
                BigDecimal amount = base.add(extraPrice.multiply(BigDecimal.valueOf(extra)));
                String detail = extra > 0
                        ? seats + " " + label(product) + " (" + included + " included, " + extra
                            + " × " + money(extraPrice, inr, usdPerInr, symbol) + ")"
                        : included + " " + label(product) + " included";
                return line(product.getCode(), product.getName(), detail, amount, false);
            }
            case COUNT_BASED -> {
                if (qty <= 0) return null;
                BigDecimal each = product.getUnitPrice() == null ? unit : product.getUnitPrice();
                int free = freeUnits == null ? 0 : Math.min(freeUnits, qty);
                int billable = qty - free;
                String detail = free > 0
                        ? free + " included in " + inclusionSource
                            + (billable > 0 ? ", " + billable + " × " + money(each, inr, usdPerInr, symbol) : "")
                        : qty + " × " + money(each, inr, usdPerInr, symbol) + " per year";
                return line(product.getCode(), product.getName(), detail,
                        each.multiply(BigDecimal.valueOf(billable)), false);
            }
            case USAGE -> {
                BigDecimal each = product.getUnitPrice() == null ? unit : product.getUnitPrice();
                BigDecimal annual = each.multiply(BigDecimal.valueOf((long) qty * 12));
                return line(product.getCode(), product.getName(),
                        qty + " " + label(product) + " × " + money(each, inr, usdPerInr, symbol),
                        annual, false);
            }
            default -> {
                log.warn("Unknown pricing model {} on product {}", model, product.getCode());
                return null;
            }
        }
    }

    private static String label(PricingProduct p) {
        return StringUtils.hasText(p.getUnitLabel()) ? p.getUnitLabel() : "units";
    }

    private static List<SelectionDto> safe(List<SelectionDto> in) {
        return in == null ? List.of() : in;
    }

    private static LineItemDto line(String code, String label, String detail, BigDecimal amount,
                                    boolean oneTime) {
        return LineItemDto.builder()
                .code(code).label(label).detail(detail)
                .amount(scale(amount)).oneTime(oneTime)
                .includedFree(amount.signum() == 0)
                .build();
    }

    private static BigDecimal sum(List<LineItemDto> lines) {
        return scale(lines.stream().map(LineItemDto::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add));
    }

    private static BigDecimal toUsd(BigDecimal inr, BigDecimal rate) {
        return scale(inr.multiply(rate));
    }

    private static BigDecimal scale(BigDecimal v) {
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    private static String money(BigDecimal v, boolean inr, BigDecimal usdPerInr, String symbol) {
        BigDecimal shown = inr ? v : scale(v.multiply(usdPerInr));
        return symbol + shown.stripTrailingZeros().toPlainString();
    }
}
