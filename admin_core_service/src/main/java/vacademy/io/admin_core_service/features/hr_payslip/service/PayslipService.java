package vacademy.io.admin_core_service.features.hr_payslip.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.hr_payroll.entity.PayrollEntry;
import vacademy.io.admin_core_service.features.hr_payroll.entity.PayrollEntryComponent;
import vacademy.io.admin_core_service.features.hr_payroll.entity.PayrollRun;
import vacademy.io.admin_core_service.features.hr_payroll.enums.PayrollEntryStatus;
import vacademy.io.admin_core_service.features.hr_payroll.enums.PayrollStatus;
import vacademy.io.admin_core_service.features.hr_payroll.repository.PayrollEntryRepository;
import vacademy.io.admin_core_service.features.hr_payroll.repository.PayrollRunRepository;
import vacademy.io.admin_core_service.features.hr_payslip.dto.PayslipDTO;
import vacademy.io.admin_core_service.features.hr_payslip.entity.Payslip;
import vacademy.io.admin_core_service.features.hr_payslip.repository.PayslipRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class PayslipService {

    @Autowired
    private PayslipRepository payslipRepository;

    @Autowired
    private PayrollRunRepository payrollRunRepository;

    @Autowired
    private PayrollEntryRepository payrollEntryRepository;

    @Transactional
    public String generatePayslips(String payrollRunId) {
        PayrollRun run = payrollRunRepository.findById(payrollRunId)
                .orElseThrow(() -> new VacademyException("Payroll run not found"));

        // Payroll must be at least PROCESSED to generate payslips
        String status = run.getStatus();
        if (PayrollStatus.DRAFT.name().equals(status) || PayrollStatus.PROCESSING.name().equals(status)) {
            throw new VacademyException("Payroll run must be PROCESSED or later to generate payslips. Current status: " + status);
        }

        // Get all payroll entries for this run
        List<PayrollEntry> entries = payrollEntryRepository.findByPayrollRunIdOrderByEmployeeEmployeeCodeAsc(payrollRunId);

        if (entries.isEmpty()) {
            throw new VacademyException("No payroll entries found for this run");
        }

        int generated = 0;
        for (PayrollEntry entry : entries) {
            // BUG 1 FIX: Skip entries with HELD status
            if (PayrollEntryStatus.HELD.name().equals(entry.getStatus())) {
                continue;
            }

            // Skip if payslip already exists for this entry
            Optional<Payslip> existingPayslip = payslipRepository.findByPayrollEntryId(entry.getId());
            if (existingPayslip.isPresent()) {
                continue;
            }

            // BUG 2 FIX: Generate payslip HTML content
            String payslipHtml = buildPayslipHtml(entry, run);

            Payslip payslip = new Payslip();
            payslip.setPayrollEntry(entry);
            payslip.setEmployee(entry.getEmployee());
            payslip.setInstituteId(run.getInstituteId());
            payslip.setMonth(run.getMonth());
            payslip.setYear(run.getYear());
            payslip.setGeneratedAt(LocalDateTime.now());
            payslip.setFileId(UUID.randomUUID().toString());
            payslip.setFileUrl(payslipHtml);
            payslip.setEmailStatus("NOT_SENT");

            payslipRepository.save(payslip);
            generated++;
        }

        return "Generated " + generated + " payslips for payroll run " + payrollRunId;
    }

    @Transactional(readOnly = true)
    public List<PayslipDTO> getPayslips(String employeeId, Integer year) {
        List<Payslip> payslips;
        if (year != null) {
            payslips = payslipRepository.findByEmployeeIdAndYear(employeeId, year);
        } else {
            payslips = payslipRepository.findByEmployeeIdOrderByYearDescMonthDesc(employeeId);
        }

        return payslips.stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PayslipDTO getPayslipById(String id) {
        Payslip payslip = payslipRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Payslip not found"));
        return toDTO(payslip);
    }

    private String buildPayslipHtml(PayrollEntry entry, PayrollRun run) {
        String employeeCode = entry.getEmployee().getEmployeeCode() != null
                ? entry.getEmployee().getEmployeeCode() : "N/A";
        String monthYear = run.getMonth() + "/" + run.getYear();

        StringBuilder html = new StringBuilder();
        html.append("<html><head><style>");
        html.append("body{font-family:Arial,sans-serif;margin:20px}");
        html.append("h2{text-align:center}");
        html.append("table{width:100%;border-collapse:collapse;margin-top:10px}");
        html.append("th,td{border:1px solid #ccc;padding:8px;text-align:left}");
        html.append("th{background:#f5f5f5}");
        html.append(".total{font-weight:bold;background:#e8f5e9}");
        html.append("</style></head><body>");
        html.append("<h2>Payslip - ").append(monthYear).append("</h2>");
        html.append("<p><strong>Employee Code:</strong> ").append(employeeCode).append("</p>");
        html.append("<p><strong>Period:</strong> ").append(monthYear).append("</p>");
        html.append("<hr/>");

        // Earnings and deductions table
        html.append("<table><thead><tr><th>Component</th><th>Type</th><th>Amount</th></tr></thead><tbody>");

        List<PayrollEntryComponent> components = entry.getEntryComponents();
        if (components != null) {
            for (PayrollEntryComponent comp : components) {
                String compName = comp.getComponent() != null && comp.getComponent().getName() != null
                        ? comp.getComponent().getName() : "Unknown";
                String compType = comp.getComponentType() != null ? comp.getComponentType() : "";
                html.append("<tr><td>").append(compName).append("</td>")
                        .append("<td>").append(compType).append("</td>")
                        .append("<td>").append(comp.getAmount()).append("</td></tr>");
            }
        }

        html.append("</tbody></table>");

        // Summary
        html.append("<table style='margin-top:20px'>");
        html.append("<tr><td><strong>Gross Salary</strong></td><td>").append(entry.getGrossSalary()).append("</td></tr>");
        if (entry.getTotalEarnings() != null) {
            html.append("<tr><td><strong>Total Earnings</strong></td><td>").append(entry.getTotalEarnings()).append("</td></tr>");
        }
        if (entry.getTotalDeductions() != null) {
            html.append("<tr><td><strong>Total Deductions</strong></td><td>").append(entry.getTotalDeductions()).append("</td></tr>");
        }
        html.append("<tr class='total'><td><strong>Net Pay</strong></td><td>").append(entry.getNetPay()).append("</td></tr>");
        html.append("</table>");

        html.append("</body></html>");
        return html.toString();
    }

    private PayslipDTO toDTO(Payslip p) {
        return PayslipDTO.builder()
                .id(p.getId())
                .payrollEntryId(p.getPayrollEntry().getId())
                .employeeId(p.getEmployee().getId())
                .employeeCode(p.getEmployee().getEmployeeCode())
                .instituteId(p.getInstituteId())
                .month(p.getMonth())
                .year(p.getYear())
                .fileId(p.getFileId())
                .fileUrl(p.getFileUrl())
                .generatedAt(p.getGeneratedAt())
                .emailedAt(p.getEmailedAt())
                .emailStatus(p.getEmailStatus())
                .build();
    }
}
