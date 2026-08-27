package vacademy.io.admin_core_service.features.hr_payroll.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.hr_payroll.dto.CreatePayrollRunDTO;
import vacademy.io.admin_core_service.features.hr_payroll.dto.PayrollRunDTO;
import vacademy.io.admin_core_service.features.hr_payroll.entity.PayrollEntry;
import vacademy.io.admin_core_service.features.hr_payroll.entity.PayrollRun;
import vacademy.io.admin_core_service.features.hr_payroll.enums.PayrollEntryStatus;
import vacademy.io.admin_core_service.features.hr_payroll.enums.PayrollStatus;
import vacademy.io.admin_core_service.features.hr_payroll.repository.PayrollEntryRepository;
import vacademy.io.admin_core_service.features.hr_payroll.repository.PayrollRunRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class PayrollRunService {

    private static final String RUN_TYPE_REGULAR = "REGULAR";

    @Autowired
    private PayrollRunRepository payrollRunRepository;

    @Autowired
    private PayrollEntryRepository payrollEntryRepository;

    @Autowired
    private PayrollCalculationService payrollCalculationService;

    /**
     * Creates a run for the VALIDATED institute — the caller-supplied
     * instituteId inside the DTO is deliberately ignored (body-vs-param
     * cross-tenant spoof fix). CANCELLED runs no longer block the month.
     */
    @Transactional
    public String createPayrollRun(CreatePayrollRunDTO dto, String instituteId) {
        if (dto.getMonth() == null || dto.getMonth() < 1 || dto.getMonth() > 12) {
            throw new VacademyException("Month must be between 1 and 12");
        }
        if (dto.getYear() == null || dto.getYear() < 2000 || dto.getYear() > 2100) {
            throw new VacademyException("Invalid year");
        }

        String runType = dto.getRunType() == null || dto.getRunType().isBlank()
                ? RUN_TYPE_REGULAR : dto.getRunType().toUpperCase();
        if (!List.of("REGULAR", "OFF_CYCLE", "FNF", "BONUS").contains(runType)) {
            throw new VacademyException("run_type must be REGULAR, OFF_CYCLE, FNF or BONUS");
        }

        // Only REGULAR runs are one-per-month; off-cycle/FNF/bonus runs coexist.
        if (RUN_TYPE_REGULAR.equals(runType)) {
            boolean exists = payrollRunRepository.existsByInstituteIdAndMonthAndYearAndRunTypeAndStatusNot(
                    instituteId, dto.getMonth(), dto.getYear(), RUN_TYPE_REGULAR, PayrollStatus.CANCELLED.name());
            if (exists) {
                throw new VacademyException("Payroll run already exists for " + dto.getMonth() + "/" + dto.getYear());
            }
        }

        PayrollRun run = new PayrollRun();
        run.setInstituteId(instituteId);
        run.setMonth(dto.getMonth());
        run.setYear(dto.getYear());
        run.setRunDate(LocalDate.now());
        run.setStatus(PayrollStatus.DRAFT.name());
        run.setRunType(runType);
        run.setTotalEmployees(0);
        run.setTotalGross(BigDecimal.ZERO);
        run.setTotalDeductions(BigDecimal.ZERO);
        run.setTotalNetPay(BigDecimal.ZERO);
        run.setTotalEmployerCost(BigDecimal.ZERO);
        run.setNotes(dto.getNotes());

        try {
            run = payrollRunRepository.save(run);
        } catch (DataIntegrityViolationException e) {
            // V480 partial unique index: concurrent create for the same month
            throw new VacademyException("Payroll run already exists for " + dto.getMonth() + "/" + dto.getYear());
        }
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
    public PayrollRunDTO getPayrollRunById(String id, String instituteId) {
        return toDTO(loadScoped(id, instituteId));
    }

    @Transactional
    public String approvePayroll(String id, String instituteId, String approverUserId) {
        PayrollRun run = loadScoped(id, instituteId);

        if (!PayrollStatus.PROCESSED.name().equals(run.getStatus())) {
            throw new VacademyException("Payroll run must be in PROCESSED status to approve. Current status: " + run.getStatus());
        }

        recomputeTotals(run);
        run.setStatus(PayrollStatus.APPROVED.name());
        run.setApprovedBy(approverUserId);
        run.setApprovedAt(LocalDateTime.now());
        payrollRunRepository.save(run);

        return run.getId();
    }

    /**
     * PROCESSED -> DRAFT: reverses every financial side effect (loan EMIs,
     * reimbursement links, tax computations) and deletes the entries so the
     * run can be corrected and reprocessed. The path the review found missing —
     * a wrong run was previously unfixable.
     */
    @Transactional
    public String rejectPayroll(String id, String instituteId) {
        PayrollRun run = loadScoped(id, instituteId);

        if (!PayrollStatus.PROCESSED.name().equals(run.getStatus())
                && !PayrollStatus.APPROVED.name().equals(run.getStatus())) {
            throw new VacademyException("Only PROCESSED or APPROVED payroll runs can be rejected. Current status: " + run.getStatus());
        }

        payrollCalculationService.reverseAndDeleteEntries(run.getId());

        run.setStatus(PayrollStatus.DRAFT.name());
        run.setProcessedBy(null);
        run.setProcessedAt(null);
        run.setApprovedBy(null);
        run.setApprovedAt(null);
        run.setTotalEmployees(0);
        run.setTotalGross(BigDecimal.ZERO);
        run.setTotalDeductions(BigDecimal.ZERO);
        run.setTotalNetPay(BigDecimal.ZERO);
        run.setTotalEmployerCost(BigDecimal.ZERO);
        payrollRunRepository.save(run);

        return run.getId();
    }

    @Transactional
    public String markPaid(String id, String instituteId) {
        PayrollRun run = loadScoped(id, instituteId);

        if (!PayrollStatus.APPROVED.name().equals(run.getStatus())) {
            throw new VacademyException("Payroll run must be APPROVED before marking as PAID. Current status: " + run.getStatus());
        }

        // Entry-level PAID (was never set anywhere); HELD entries stay held and
        // are excluded from the paid totals.
        List<PayrollEntry> entries = payrollEntryRepository.findByPayrollRunIdOrderByEmployeeEmployeeCodeAsc(id);
        for (PayrollEntry entry : entries) {
            if (PayrollEntryStatus.CALCULATED.name().equals(entry.getStatus())) {
                entry.setStatus(PayrollEntryStatus.PAID.name());
                payrollEntryRepository.save(entry);
            }
        }

        recomputeTotals(run);
        run.setStatus(PayrollStatus.PAID.name());
        run.setPaidAt(LocalDateTime.now());
        payrollRunRepository.save(run);

        return run.getId();
    }

    /**
     * Cancels a run AND reverses its financial side effects (previously the
     * entries kept their loan deductions and consumed reimbursements forever).
     * The V480 partial unique index lets a new run be created for the month.
     */
    @Transactional
    public String cancelPayroll(String id, String instituteId) {
        PayrollRun run = loadScoped(id, instituteId);

        if (PayrollStatus.PAID.name().equals(run.getStatus())) {
            throw new VacademyException("Cannot cancel a PAID payroll run");
        }

        payrollCalculationService.reverseAndDeleteEntries(run.getId());

        run.setStatus(PayrollStatus.CANCELLED.name());
        payrollRunRepository.save(run);

        return run.getId();
    }

    /** Run totals derived from live entries, excluding HELD (fixes totals ≠ bank total after a hold). */
    void recomputeTotals(PayrollRun run) {
        List<PayrollEntry> entries = payrollEntryRepository
                .findByPayrollRunIdOrderByEmployeeEmployeeCodeAsc(run.getId());

        BigDecimal totalGross = BigDecimal.ZERO;
        BigDecimal totalDeductions = BigDecimal.ZERO;
        BigDecimal totalNetPay = BigDecimal.ZERO;
        BigDecimal totalEmployerCost = BigDecimal.ZERO;
        int count = 0;

        for (PayrollEntry entry : entries) {
            if (PayrollEntryStatus.HELD.name().equals(entry.getStatus())) {
                continue;
            }
            totalGross = totalGross.add(nvl(entry.getGrossSalary()));
            totalDeductions = totalDeductions.add(nvl(entry.getTotalDeductions()));
            totalNetPay = totalNetPay.add(nvl(entry.getNetPay()));
            totalEmployerCost = totalEmployerCost.add(
                    nvl(entry.getGrossSalary()).add(nvl(entry.getTotalEmployerContributions())));
            count++;
        }

        run.setTotalEmployees(count);
        run.setTotalGross(totalGross);
        run.setTotalDeductions(totalDeductions);
        run.setTotalNetPay(totalNetPay);
        run.setTotalEmployerCost(totalEmployerCost);
        payrollRunRepository.save(run);
    }

    PayrollRun loadScoped(String id, String instituteId) {
        return payrollRunRepository.findByIdAndInstituteId(id, instituteId)
                .orElseThrow(() -> new VacademyException("Payroll run not found"));
    }

    private BigDecimal nvl(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private PayrollRunDTO toDTO(PayrollRun run) {
        return PayrollRunDTO.builder()
                .id(run.getId())
                .instituteId(run.getInstituteId())
                .month(run.getMonth())
                .year(run.getYear())
                .runDate(run.getRunDate())
                .status(run.getStatus())
                .runType(run.getRunType() != null ? run.getRunType() : "REGULAR")
                .totalEmployees(run.getTotalEmployees())
                .totalGross(run.getTotalGross())
                .totalDeductions(run.getTotalDeductions())
                .totalNetPay(run.getTotalNetPay())
                .totalEmployerCost(run.getTotalEmployerCost())
                .currency(run.getCurrency() != null ? run.getCurrency() : "INR")
                .processedBy(run.getProcessedBy())
                .processedAt(run.getProcessedAt())
                .approvedBy(run.getApprovedBy())
                .approvedAt(run.getApprovedAt())
                .notes(run.getNotes())
                .build();
    }
}
