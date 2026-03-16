package vacademy.io.admin_core_service.features.hr_tax.service.engine;

import java.math.BigDecimal;
import java.util.Map;

public interface TaxRegimeEngine {

    /**
     * Calculate monthly tax based on annual taxable income, employee declarations, and tax rules.
     *
     * @param annualTaxableIncome the projected annual taxable income
     * @param declarations        the employee's tax declarations (80C, HRA, etc.)
     * @param taxRules            the institute's tax rules configuration
     * @return monthly tax amount to be deducted
     */
    BigDecimal calculateMonthlyTax(BigDecimal annualTaxableIncome,
                                     Map<String, Object> declarations,
                                     Map<String, Object> taxRules);

    /**
     * Calculate statutory deductions for the employee (EPF employee share, ESI, Professional Tax, etc.)
     *
     * @param grossMonthly      the employee's gross monthly salary
     * @param statutorySettings the institute's statutory settings
     * @return map of deduction name to amount
     */
    Map<String, BigDecimal> getStatutoryDeductions(BigDecimal grossMonthly,
                                                     Map<String, Object> statutorySettings);

    /**
     * Calculate employer contributions (EPF employer share, ESI employer share, etc.)
     *
     * @param grossMonthly         the employee's gross monthly salary
     * @param contributionSettings the institute's employer contribution settings
     * @return map of contribution name to amount
     */
    Map<String, BigDecimal> getEmployerContributions(BigDecimal grossMonthly,
                                                       Map<String, Object> contributionSettings);

    /**
     * Return the country code this engine handles.
     *
     * @return the country code (e.g. "IND", "USA")
     */
    String getCountryCode();
}
