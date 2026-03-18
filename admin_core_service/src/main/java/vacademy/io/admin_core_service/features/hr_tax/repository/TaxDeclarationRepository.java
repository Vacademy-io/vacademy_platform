package vacademy.io.admin_core_service.features.hr_tax.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_tax.entity.TaxDeclaration;

import java.util.Optional;

@Repository
public interface TaxDeclarationRepository extends JpaRepository<TaxDeclaration, String> {

    Optional<TaxDeclaration> findByEmployee_IdAndFinancialYear(String employeeId, String financialYear);
}
