package vacademy.io.admin_core_service.features.hr_tax.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_tax.entity.TaxComputation;

import java.util.List;

@Repository
public interface TaxComputationRepository extends JpaRepository<TaxComputation, String> {

    List<TaxComputation> findByEmployee_IdAndFinancialYearOrderByMonthAsc(String employeeId, String financialYear);
}
