package vacademy.io.admin_core_service.features.hr_payroll.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import vacademy.io.admin_core_service.features.hr_payroll.entity.LoanRepayment;

import java.util.List;

@Repository
public interface LoanRepaymentRepository extends JpaRepository<LoanRepayment, String> {

    List<LoanRepayment> findByLoanIdOrderByYearAscMonthAsc(String loanId);

    List<LoanRepayment> findByPayrollEntryId(String payrollEntryId);

    void deleteByPayrollEntryId(String payrollEntryId);
}
