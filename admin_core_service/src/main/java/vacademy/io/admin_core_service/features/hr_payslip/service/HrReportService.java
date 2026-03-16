package vacademy.io.admin_core_service.features.hr_payslip.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.hr_payroll.entity.PayrollEntry;
import vacademy.io.admin_core_service.features.hr_payroll.entity.PayrollRun;
import vacademy.io.admin_core_service.features.hr_payroll.repository.PayrollEntryRepository;
import vacademy.io.admin_core_service.features.hr_payroll.repository.PayrollRunRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.util.*;

@Service
public class HrReportService {

    @Autowired
    private PayrollRunRepository payrollRunRepository;

    @Autowired
    private PayrollEntryRepository payrollEntryRepository;

    @Transactional(readOnly = true)
    public Map<String, Object> getPayrollSummary(String instituteId, Integer month, Integer year) {
        PayrollRun run = payrollRunRepository.findByInstituteIdAndMonthAndYear(instituteId, month, year)
                .orElseThrow(() -> new VacademyException("No payroll run found for " + month + "/" + year));

        List<PayrollEntry> entries = payrollEntryRepository
                .findByPayrollRunIdOrderByEmployeeEmployeeCodeAsc(run.getId());

        BigDecimal totalGross = BigDecimal.ZERO;
        BigDecimal totalDeductions = BigDecimal.ZERO;
        BigDecimal totalNetPay = BigDecimal.ZERO;

        // Department-wise aggregation
        Map<String, Map<String, Object>> departmentMap = new LinkedHashMap<>();

        for (PayrollEntry entry : entries) {
            totalGross = totalGross.add(entry.getGrossSalary() != null ? entry.getGrossSalary() : BigDecimal.ZERO);
            totalDeductions = totalDeductions.add(entry.getTotalDeductions() != null ? entry.getTotalDeductions() : BigDecimal.ZERO);
            totalNetPay = totalNetPay.add(entry.getNetPay() != null ? entry.getNetPay() : BigDecimal.ZERO);

            // Get department name
            String deptName = "Unassigned";
            if (entry.getEmployee() != null && entry.getEmployee().getDepartment() != null) {
                deptName = entry.getEmployee().getDepartment().getName();
            }

            Map<String, Object> deptData = departmentMap.computeIfAbsent(deptName, k -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("department", k);
                m.put("employee_count", 0);
                m.put("total_gross", BigDecimal.ZERO);
                m.put("total_net_pay", BigDecimal.ZERO);
                return m;
            });

            deptData.put("employee_count", (int) deptData.get("employee_count") + 1);
            deptData.put("total_gross", ((BigDecimal) deptData.get("total_gross"))
                    .add(entry.getGrossSalary() != null ? entry.getGrossSalary() : BigDecimal.ZERO));
            deptData.put("total_net_pay", ((BigDecimal) deptData.get("total_net_pay"))
                    .add(entry.getNetPay() != null ? entry.getNetPay() : BigDecimal.ZERO));
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("total_employees", entries.size());
        summary.put("total_gross", totalGross);
        summary.put("total_deductions", totalDeductions);
        summary.put("total_net_pay", totalNetPay);
        summary.put("department_wise", new ArrayList<>(departmentMap.values()));

        return summary;
    }
}
