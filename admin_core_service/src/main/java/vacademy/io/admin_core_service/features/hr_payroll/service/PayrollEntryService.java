package vacademy.io.admin_core_service.features.hr_payroll.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.hr_payroll.dto.HoldReleaseDTO;
import vacademy.io.admin_core_service.features.hr_payroll.dto.PayrollEntryComponentDTO;
import vacademy.io.admin_core_service.features.hr_payroll.dto.PayrollEntryDTO;
import vacademy.io.admin_core_service.features.hr_payroll.entity.PayrollEntry;
import vacademy.io.admin_core_service.features.hr_payroll.entity.PayrollEntryComponent;
import vacademy.io.admin_core_service.features.hr_payroll.enums.PayrollEntryStatus;
import vacademy.io.admin_core_service.features.hr_payroll.repository.PayrollEntryComponentRepository;
import vacademy.io.admin_core_service.features.hr_payroll.repository.PayrollEntryRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class PayrollEntryService {

    @Autowired
    private PayrollEntryRepository payrollEntryRepository;

    @Autowired
    private PayrollEntryComponentRepository payrollEntryComponentRepository;

    @Transactional(readOnly = true)
    public List<PayrollEntryDTO> getEntriesByRun(String payrollRunId) {
        List<PayrollEntry> entries = payrollEntryRepository.findByPayrollRunIdOrderByEmployeeEmployeeCodeAsc(payrollRunId);
        return entries.stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PayrollEntryDTO getEntryById(String id) {
        PayrollEntry entry = payrollEntryRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Payroll entry not found"));
        return toDTO(entry);
    }

    @Transactional
    public String holdEntry(String id, HoldReleaseDTO holdDTO) {
        PayrollEntry entry = payrollEntryRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Payroll entry not found"));

        if (!PayrollEntryStatus.CALCULATED.name().equals(entry.getStatus())) {
            throw new VacademyException("Only CALCULATED entries can be held. Current status: " + entry.getStatus());
        }

        entry.setStatus(PayrollEntryStatus.HELD.name());
        entry.setHoldReason(holdDTO.getHoldReason());
        payrollEntryRepository.save(entry);

        return entry.getId();
    }

    @Transactional
    public String releaseEntry(String id) {
        PayrollEntry entry = payrollEntryRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Payroll entry not found"));

        if (!PayrollEntryStatus.HELD.name().equals(entry.getStatus())) {
            throw new VacademyException("Only HELD entries can be released. Current status: " + entry.getStatus());
        }

        entry.setStatus(PayrollEntryStatus.CALCULATED.name());
        entry.setHoldReason(null);
        payrollEntryRepository.save(entry);

        return entry.getId();
    }

    private PayrollEntryDTO toDTO(PayrollEntry entry) {
        List<PayrollEntryComponent> components = payrollEntryComponentRepository.findByPayrollEntryId(entry.getId());

        List<PayrollEntryComponentDTO> componentDTOs = components.stream()
                .map(c -> PayrollEntryComponentDTO.builder()
                        .componentId(c.getComponent().getId())
                        .componentName(c.getComponent().getName())
                        .componentCode(c.getComponent().getCode())
                        .componentType(c.getComponentType())
                        .amount(c.getAmount())
                        .build())
                .collect(Collectors.toList());

        return PayrollEntryDTO.builder()
                .id(entry.getId())
                .payrollRunId(entry.getPayrollRun().getId())
                .employeeId(entry.getEmployee().getId())
                .employeeCode(entry.getEmployee().getEmployeeCode())
                .grossSalary(entry.getGrossSalary())
                .totalEarnings(entry.getTotalEarnings())
                .totalDeductions(entry.getTotalDeductions())
                .totalEmployerContributions(entry.getTotalEmployerContributions())
                .netPay(entry.getNetPay())
                .totalWorkingDays(entry.getTotalWorkingDays())
                .daysPresent(entry.getDaysPresent())
                .daysAbsent(entry.getDaysAbsent())
                .daysOnLeave(entry.getDaysOnLeave())
                .daysHoliday(entry.getDaysHoliday())
                .overtimeHours(entry.getOvertimeHours())
                .arrears(entry.getArrears())
                .reimbursements(entry.getReimbursements())
                .loanDeduction(entry.getLoanDeduction())
                .status(entry.getStatus())
                .components(componentDTOs)
                .build();
    }
}
