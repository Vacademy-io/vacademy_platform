package vacademy.io.admin_core_service.features.hr_tax.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.hr_tax.dto.TaxComputationDTO;
import vacademy.io.admin_core_service.features.hr_tax.entity.TaxComputation;
import vacademy.io.admin_core_service.features.hr_tax.repository.TaxComputationRepository;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class TaxComputationService {

    @Autowired
    private TaxComputationRepository taxComputationRepository;

    @Transactional(readOnly = true)
    public List<TaxComputationDTO> getComputation(String employeeId, String financialYear) {
        List<TaxComputation> computations = taxComputationRepository
                .findByEmployee_IdAndFinancialYearOrderByMonthAsc(employeeId, financialYear);

        return computations.stream().map(this::toDTO).collect(Collectors.toList());
    }

    private TaxComputationDTO toDTO(TaxComputation c) {
        return TaxComputationDTO.builder()
                .id(c.getId())
                .employeeId(c.getEmployee().getId())
                .financialYear(c.getFinancialYear())
                .month(c.getMonth())
                .year(c.getYear())
                .projectedAnnualIncome(c.getProjectedAnnualIncome())
                .projectedAnnualTax(c.getProjectedAnnualTax())
                .projectedMonthlyTax(c.getProjectedMonthlyTax())
                .actualIncomeTillDate(c.getActualIncomeTillDate())
                .actualTaxDeducted(c.getActualTaxDeducted())
                .totalExemptions(c.getTotalExemptions())
                .totalDeductions80c(c.getTotalDeductions80c())
                .computationDetails(c.getComputationDetails())
                .build();
    }
}
