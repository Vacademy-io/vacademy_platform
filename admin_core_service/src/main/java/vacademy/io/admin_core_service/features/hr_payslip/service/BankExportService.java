package vacademy.io.admin_core_service.features.hr_payslip.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.hr_employee.entity.EmployeeBankDetail;
import vacademy.io.admin_core_service.features.hr_payroll.entity.PayrollEntry;
import vacademy.io.admin_core_service.features.hr_payroll.entity.PayrollRun;
import vacademy.io.admin_core_service.features.hr_payroll.enums.PayrollEntryStatus;
import vacademy.io.admin_core_service.features.hr_payroll.repository.PayrollEntryRepository;
import vacademy.io.admin_core_service.features.hr_payroll.repository.PayrollRunRepository;
import vacademy.io.admin_core_service.features.hr_payslip.dto.BankExportDTO;
import vacademy.io.admin_core_service.features.hr_payslip.dto.BankExportRequestDTO;
import vacademy.io.admin_core_service.features.hr_payslip.entity.BankExportLog;
import vacademy.io.admin_core_service.features.hr_payslip.repository.BankExportLogRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class BankExportService {

    @Autowired
    private BankExportLogRepository bankExportLogRepository;

    @Autowired
    private PayrollRunRepository payrollRunRepository;

    @Autowired
    private PayrollEntryRepository payrollEntryRepository;

    @Transactional
    public String generateBankExport(BankExportRequestDTO requestDTO, String userId) {
        PayrollRun run = payrollRunRepository.findById(requestDTO.getPayrollRunId())
                .orElseThrow(() -> new VacademyException("Payroll run not found"));

        // BUG 4 FIX: Validate payroll run status before generating bank export
        String runStatus = run.getStatus();
        if (!"APPROVED".equals(runStatus) && !"PAID".equals(runStatus)) {
            throw new VacademyException("Bank export can only be generated for APPROVED or PAID payroll runs. Current status: " + runStatus);
        }

        // Get all CALCULATED (not HELD) payroll entries for the run
        List<PayrollEntry> entries = payrollEntryRepository
                .findByPayrollRunIdOrderByEmployeeEmployeeCodeAsc(requestDTO.getPayrollRunId());

        List<PayrollEntry> eligibleEntries = entries.stream()
                .filter(e -> PayrollEntryStatus.CALCULATED.name().equals(e.getStatus())
                        || PayrollEntryStatus.PAID.name().equals(e.getStatus()))
                .collect(Collectors.toList());

        if (eligibleEntries.isEmpty()) {
            throw new VacademyException("No eligible payroll entries found for bank export");
        }

        // Build CSV content
        StringBuilder csvContent = new StringBuilder();
        csvContent.append("Sr.No,Employee Code,Employee Name,Account No,IFSC,Bank Name,Net Pay,Email\n");

        BigDecimal totalAmount = BigDecimal.ZERO;
        int recordCount = 0;

        for (int i = 0; i < eligibleEntries.size(); i++) {
            PayrollEntry entry = eligibleEntries.get(i);
            EmployeeBankDetail bank = entry.getBankAccount();

            String accountNo = "";
            String ifsc = "";
            String bankName = "";

            if (bank != null) {
                accountNo = bank.getAccountNumber() != null ? bank.getAccountNumber() : "";
                ifsc = bank.getIfscCode() != null ? bank.getIfscCode() : "";
                bankName = bank.getBankName() != null ? bank.getBankName() : "";
            }

            String employeeCode = entry.getEmployee().getEmployeeCode() != null
                    ? entry.getEmployee().getEmployeeCode() : "";

            csvContent.append(i + 1).append(",")
                    .append(escapeCSV(employeeCode)).append(",")
                    .append(escapeCSV(employeeCode)).append(",") // Employee Name column — using code as placeholder
                    .append(escapeCSV(accountNo)).append(",")
                    .append(escapeCSV(ifsc)).append(",")
                    .append(escapeCSV(bankName)).append(",")
                    .append(entry.getNetPay()).append(",")
                    .append("") // Email placeholder
                    .append("\n");

            totalAmount = totalAmount.add(entry.getNetPay());
            recordCount++;
        }

        // Create BankExportLog record
        String format = requestDTO.getFormat() != null ? requestDTO.getFormat().toUpperCase() : "CSV";
        String fileName = "bank_export_" + run.getMonth() + "_" + run.getYear() + "." + format.toLowerCase();

        BankExportLog log = new BankExportLog();
        log.setPayrollRun(run);
        log.setInstituteId(run.getInstituteId());
        log.setFileName(fileName);
        log.setFormat(format);
        log.setTotalRecords(recordCount);
        log.setTotalAmount(totalAmount);
        log.setGeneratedBy(userId);
        log.setGeneratedAt(LocalDateTime.now());
        // fileId would be set after uploading to S3 -- for now null
        log.setFileId(null);

        log = bankExportLogRepository.save(log);

        // BUG 3 FIX: Return CSV content so the controller can serve it as a downloadable file
        return csvContent.toString();
    }

    @Transactional(readOnly = true)
    public List<BankExportDTO> getBankExports(String payrollRunId) {
        List<BankExportLog> logs = bankExportLogRepository.findByPayrollRunIdOrderByCreatedAtDesc(payrollRunId);
        return logs.stream().map(this::toDTO).collect(Collectors.toList());
    }

    private String escapeCSV(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private BankExportDTO toDTO(BankExportLog log) {
        return BankExportDTO.builder()
                .id(log.getId())
                .payrollRunId(log.getPayrollRun().getId())
                .instituteId(log.getInstituteId())
                .fileId(log.getFileId())
                .fileName(log.getFileName())
                .format(log.getFormat())
                .totalRecords(log.getTotalRecords())
                .totalAmount(log.getTotalAmount())
                .generatedBy(log.getGeneratedBy())
                .generatedAt(log.getGeneratedAt())
                .build();
    }
}
