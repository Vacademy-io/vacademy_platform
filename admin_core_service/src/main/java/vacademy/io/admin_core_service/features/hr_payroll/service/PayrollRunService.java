package vacademy.io.admin_core_service.features.hr_payroll.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.hr_payroll.dto.CreatePayrollRunDTO;
import vacademy.io.admin_core_service.features.hr_payroll.dto.PayrollRunDTO;
import vacademy.io.admin_core_service.features.hr_payroll.entity.PayrollRun;
import vacademy.io.admin_core_service.features.hr_payroll.enums.PayrollStatus;
import vacademy.io.admin_core_service.features.hr_payroll.repository.PayrollRunRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class PayrollRunService {

    @Autowired
    private PayrollRunRepository payrollRunRepository;

    @Transactional
    public String createPayrollRun(CreatePayrollRunDTO dto) {
        // Check if a payroll run already exists for this month/year
        payrollRunRepository.findByInstituteIdAndMonthAndYear(dto.getInstituteId(), dto.getMonth(), dto.getYear())
                .ifPresent(existing -> {
                    throw new VacademyException("Payroll run already exists for " + dto.getMonth() + "/" + dto.getYear());
                });

        PayrollRun run = new PayrollRun();
        run.setInstituteId(dto.getInstituteId());
        run.setMonth(dto.getMonth());
        run.setYear(dto.getYear());
        run.setRunDate(LocalDate.now());
        run.setStatus(PayrollStatus.DRAFT.name());
        run.setTotalEmployees(0);
        run.setTotalGross(BigDecimal.ZERO);
        run.setTotalDeductions(BigDecimal.ZERO);
        run.setTotalNetPay(BigDecimal.ZERO);
        run.setTotalEmployerCost(BigDecimal.ZERO);
        run.setNotes(dto.getNotes());

        run = payrollRunRepository.save(run);
        return run.getId();
    }

    @Transactional(readOnly = true)
    public List<PayrollRunDTO> getPayrollRuns(String instituteId, Integer year) {
        List<PayrollRun> runs;
        if (year != null) {
            runs = payrollRunRepository.findByInstituteIdAndYearOrderByMonthDesc(instituteId, year);
        } else {
            runs = payrollRunRepository.findByInstituteIdOrderByYearDescMonthDesc(instituteId);
        }
        return runs.stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public PayrollRunDTO getPayrollRunById(String id) {
        PayrollRun run = payrollRunRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Payroll run not found"));
        return toDTO(run);
    }

    @Transactional
    public String approvePayroll(String id, String approverUserId) {
        PayrollRun run = payrollRunRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Payroll run not found"));

        if (!PayrollStatus.PROCESSED.name().equals(run.getStatus())) {
            throw new VacademyException("Payroll run must be in PROCESSED status to approve. Current status: " + run.getStatus());
        }

        run.setStatus(PayrollStatus.APPROVED.name());
        run.setApprovedBy(approverUserId);
        run.setApprovedAt(LocalDateTime.now());
        payrollRunRepository.save(run);

        return run.getId();
    }

    @Transactional
    public String markPaid(String id) {
        PayrollRun run = payrollRunRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Payroll run not found"));

        if (!PayrollStatus.APPROVED.name().equals(run.getStatus())) {
            throw new VacademyException("Payroll run must be APPROVED before marking as PAID. Current status: " + run.getStatus());
        }

        run.setStatus(PayrollStatus.PAID.name());
        run.setPaidAt(LocalDateTime.now());
        payrollRunRepository.save(run);

        return run.getId();
    }

    @Transactional
    public String cancelPayroll(String id) {
        PayrollRun run = payrollRunRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Payroll run not found"));

        if (PayrollStatus.PAID.name().equals(run.getStatus())) {
            throw new VacademyException("Cannot cancel a PAID payroll run");
        }

        run.setStatus(PayrollStatus.CANCELLED.name());
        payrollRunRepository.save(run);

        return run.getId();
    }

    private PayrollRunDTO toDTO(PayrollRun run) {
        return PayrollRunDTO.builder()
                .id(run.getId())
                .instituteId(run.getInstituteId())
                .month(run.getMonth())
                .year(run.getYear())
                .runDate(run.getRunDate())
                .status(run.getStatus())
                .totalEmployees(run.getTotalEmployees())
                .totalGross(run.getTotalGross())
                .totalDeductions(run.getTotalDeductions())
                .totalNetPay(run.getTotalNetPay())
                .totalEmployerCost(run.getTotalEmployerCost())
                .processedBy(run.getProcessedBy())
                .processedAt(run.getProcessedAt())
                .approvedBy(run.getApprovedBy())
                .approvedAt(run.getApprovedAt())
                .notes(run.getNotes())
                .build();
    }
}
