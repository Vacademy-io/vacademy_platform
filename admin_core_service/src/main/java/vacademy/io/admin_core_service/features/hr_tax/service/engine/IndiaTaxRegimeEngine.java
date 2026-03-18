package vacademy.io.admin_core_service.features.hr_tax.service.engine;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.HashMap;
import java.util.Map;

@Component
public class IndiaTaxRegimeEngine implements TaxRegimeEngine {

    // Indian New Regime Tax Slabs (FY 2024-25 onwards)
    private static final BigDecimal SLAB_1_LIMIT = new BigDecimal("300000");   // 0-3L: 0%
    private static final BigDecimal SLAB_2_LIMIT = new BigDecimal("700000");   // 3-7L: 5%
    private static final BigDecimal SLAB_3_LIMIT = new BigDecimal("1000000");  // 7-10L: 10%
    private static final BigDecimal SLAB_4_LIMIT = new BigDecimal("1200000");  // 10-12L: 15%
    private static final BigDecimal SLAB_5_LIMIT = new BigDecimal("1500000");  // 12-15L: 20%
    // 15L+: 30%

    private static final BigDecimal STANDARD_DEDUCTION = new BigDecimal("75000");

    // EPF statutory limits
    private static final BigDecimal EPF_RATE = new BigDecimal("0.12");             // 12%
    private static final BigDecimal EPF_MAX_BASE = new BigDecimal("15000");        // Max basic for EPF

    // ESI limits
    private static final BigDecimal ESI_EMPLOYEE_RATE = new BigDecimal("0.0075");  // 0.75%
    private static final BigDecimal ESI_EMPLOYER_RATE = new BigDecimal("0.0325");  // 3.25%
    private static final BigDecimal ESI_GROSS_LIMIT = new BigDecimal("21000");     // ESI applicable if gross <= 21000

    // Professional Tax (typical monthly amount)
    private static final BigDecimal PROFESSIONAL_TAX = new BigDecimal("200");

    private static final BigDecimal TWELVE = new BigDecimal("12");

    // Section 80C maximum deduction limit
    private static final BigDecimal SECTION_80C_LIMIT = new BigDecimal("150000");

    // Keys in the declarations map that qualify under Section 80C
    private static final String[] SECTION_80C_KEYS = {
        "section_80c", "80c", "ppf", "elss", "life_insurance", "nsc",
        "tuition_fees", "fixed_deposit_5yr", "sukanya_samriddhi",
        "employee_pf_contribution"
    };

    // Other declaration keys for deductions beyond 80C
    private static final String KEY_80D = "section_80d";           // Medical insurance
    private static final String KEY_80E = "section_80e";           // Education loan interest
    private static final String KEY_80CCD_1B = "section_80ccd_1b"; // NPS additional
    private static final String KEY_HRA = "hra_exemption";         // HRA exemption

    private static final BigDecimal SECTION_80D_LIMIT = new BigDecimal("50000");
    private static final BigDecimal SECTION_80CCD_1B_LIMIT = new BigDecimal("50000");

    @Override
    public BigDecimal calculateMonthlyTax(BigDecimal annualTaxableIncome,
                                            Map<String, Object> declarations,
                                            Map<String, Object> taxRules) {
        if (annualTaxableIncome == null || annualTaxableIncome.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }

        // Apply standard deduction
        BigDecimal taxableIncome = annualTaxableIncome.subtract(STANDARD_DEDUCTION);
        if (taxableIncome.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }

        // Apply declaration-based deductions (Section 80C, 80D, 80E, 80CCD(1B), HRA)
        if (declarations != null && !declarations.isEmpty()) {
            // Section 80C: aggregate qualifying items, capped at 1.5L
            BigDecimal total80C = BigDecimal.ZERO;
            for (String key : SECTION_80C_KEYS) {
                Object val = declarations.get(key);
                if (val instanceof Number) {
                    total80C = total80C.add(new BigDecimal(val.toString()));
                }
            }
            total80C = total80C.min(SECTION_80C_LIMIT);
            taxableIncome = taxableIncome.subtract(total80C);

            // Section 80D: Medical insurance premium, capped at 50K
            taxableIncome = applyDeclarationDeduction(taxableIncome, declarations, KEY_80D, SECTION_80D_LIMIT);

            // Section 80CCD(1B): NPS additional contribution, capped at 50K
            taxableIncome = applyDeclarationDeduction(taxableIncome, declarations, KEY_80CCD_1B, SECTION_80CCD_1B_LIMIT);

            // Section 80E: Education loan interest (no upper limit)
            taxableIncome = applyDeclarationDeduction(taxableIncome, declarations, KEY_80E, null);

            // HRA exemption
            taxableIncome = applyDeclarationDeduction(taxableIncome, declarations, KEY_HRA, null);
        }

        if (taxableIncome.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }

        // Calculate annual tax using New Regime slabs
        BigDecimal annualTax = calculateSlabTax(taxableIncome);

        // Add 4% health and education cess
        BigDecimal cess = annualTax.multiply(new BigDecimal("0.04")).setScale(2, RoundingMode.HALF_UP);
        annualTax = annualTax.add(cess);

        // Divide by 12 for monthly tax
        BigDecimal monthlyTax = annualTax.divide(TWELVE, 2, RoundingMode.HALF_UP);

        return monthlyTax;
    }

    /**
     * Apply a single declaration-based deduction to taxable income.
     * If limit is null, no cap is applied.
     */
    private BigDecimal applyDeclarationDeduction(BigDecimal taxableIncome,
                                                   Map<String, Object> declarations,
                                                   String key, BigDecimal limit) {
        Object val = declarations.get(key);
        if (val instanceof Number) {
            BigDecimal amount = new BigDecimal(val.toString());
            if (limit != null) {
                amount = amount.min(limit);
            }
            taxableIncome = taxableIncome.subtract(amount);
        }
        return taxableIncome;
    }

    /**
     * Calculate tax based on Indian New Regime slabs:
     * 0-3L: 0%, 3-7L: 5%, 7-10L: 10%, 10-12L: 15%, 12-15L: 20%, 15L+: 30%
     */
    private BigDecimal calculateSlabTax(BigDecimal taxableIncome) {
        BigDecimal tax = BigDecimal.ZERO;
        BigDecimal remaining = taxableIncome;

        // Slab 1: 0-3L at 0%
        if (remaining.compareTo(SLAB_1_LIMIT) <= 0) {
            return tax;
        }
        remaining = remaining.subtract(SLAB_1_LIMIT);

        // Slab 2: 3L-7L at 5%
        BigDecimal slab2Width = SLAB_2_LIMIT.subtract(SLAB_1_LIMIT); // 4L
        if (remaining.compareTo(slab2Width) <= 0) {
            tax = tax.add(remaining.multiply(new BigDecimal("0.05")));
            return tax.setScale(2, RoundingMode.HALF_UP);
        }
        tax = tax.add(slab2Width.multiply(new BigDecimal("0.05")));
        remaining = remaining.subtract(slab2Width);

        // Slab 3: 7L-10L at 10%
        BigDecimal slab3Width = SLAB_3_LIMIT.subtract(SLAB_2_LIMIT); // 3L
        if (remaining.compareTo(slab3Width) <= 0) {
            tax = tax.add(remaining.multiply(new BigDecimal("0.10")));
            return tax.setScale(2, RoundingMode.HALF_UP);
        }
        tax = tax.add(slab3Width.multiply(new BigDecimal("0.10")));
        remaining = remaining.subtract(slab3Width);

        // Slab 4: 10L-12L at 15%
        BigDecimal slab4Width = SLAB_4_LIMIT.subtract(SLAB_3_LIMIT); // 2L
        if (remaining.compareTo(slab4Width) <= 0) {
            tax = tax.add(remaining.multiply(new BigDecimal("0.15")));
            return tax.setScale(2, RoundingMode.HALF_UP);
        }
        tax = tax.add(slab4Width.multiply(new BigDecimal("0.15")));
        remaining = remaining.subtract(slab4Width);

        // Slab 5: 12L-15L at 20%
        BigDecimal slab5Width = SLAB_5_LIMIT.subtract(SLAB_4_LIMIT); // 3L
        if (remaining.compareTo(slab5Width) <= 0) {
            tax = tax.add(remaining.multiply(new BigDecimal("0.20")));
            return tax.setScale(2, RoundingMode.HALF_UP);
        }
        tax = tax.add(slab5Width.multiply(new BigDecimal("0.20")));
        remaining = remaining.subtract(slab5Width);

        // Slab 6: Above 15L at 30%
        tax = tax.add(remaining.multiply(new BigDecimal("0.30")));

        return tax.setScale(2, RoundingMode.HALF_UP);
    }

    @Override
    public Map<String, BigDecimal> getStatutoryDeductions(BigDecimal grossMonthly,
                                                            Map<String, Object> statutorySettings) {
        Map<String, BigDecimal> deductions = new HashMap<>();

        if (grossMonthly == null || grossMonthly.compareTo(BigDecimal.ZERO) <= 0) {
            return deductions;
        }

        // EPF Employee contribution: 12% of basic (capped at basic of 15000)
        // For simplicity, assume basic is ~40-50% of gross; use min(basic, 15000)
        BigDecimal basicForEpf = grossMonthly.multiply(new BigDecimal("0.5")).setScale(2, RoundingMode.HALF_UP);
        BigDecimal epfBase = basicForEpf.min(EPF_MAX_BASE);
        BigDecimal epfEmployee = epfBase.multiply(EPF_RATE).setScale(2, RoundingMode.HALF_UP);
        deductions.put("EPF_EMPLOYEE", epfEmployee);

        // ESI Employee contribution: 0.75% if gross <= 21000
        if (grossMonthly.compareTo(ESI_GROSS_LIMIT) <= 0) {
            BigDecimal esiEmployee = grossMonthly.multiply(ESI_EMPLOYEE_RATE).setScale(2, RoundingMode.HALF_UP);
            deductions.put("ESI_EMPLOYEE", esiEmployee);
        }

        // Professional Tax: 200/month (typical for most Indian states)
        deductions.put("PROFESSIONAL_TAX", PROFESSIONAL_TAX);

        return deductions;
    }

    @Override
    public Map<String, BigDecimal> getEmployerContributions(BigDecimal grossMonthly,
                                                              Map<String, Object> contributionSettings) {
        Map<String, BigDecimal> contributions = new HashMap<>();

        if (grossMonthly == null || grossMonthly.compareTo(BigDecimal.ZERO) <= 0) {
            return contributions;
        }

        // EPF Employer contribution: 12% of basic (capped at basic of 15000)
        BigDecimal basicForEpf = grossMonthly.multiply(new BigDecimal("0.5")).setScale(2, RoundingMode.HALF_UP);
        BigDecimal epfBase = basicForEpf.min(EPF_MAX_BASE);
        BigDecimal epfEmployer = epfBase.multiply(EPF_RATE).setScale(2, RoundingMode.HALF_UP);
        contributions.put("EPF_EMPLOYER", epfEmployer);

        // ESI Employer contribution: 3.25% if gross <= 21000
        if (grossMonthly.compareTo(ESI_GROSS_LIMIT) <= 0) {
            BigDecimal esiEmployer = grossMonthly.multiply(ESI_EMPLOYER_RATE).setScale(2, RoundingMode.HALF_UP);
            contributions.put("ESI_EMPLOYER", esiEmployer);
        }

        return contributions;
    }

    @Override
    public String getCountryCode() {
        return "IND";
    }
}
