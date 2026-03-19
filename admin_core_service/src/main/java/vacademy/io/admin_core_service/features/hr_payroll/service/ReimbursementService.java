package vacademy.io.admin_core_service.features.hr_payroll.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.hr_employee.entity.EmployeeProfile;
import vacademy.io.admin_core_service.features.hr_employee.repository.EmployeeProfileRepository;
import vacademy.io.admin_core_service.features.hr_payroll.dto.CreateReimbursementDTO;
import vacademy.io.admin_core_service.features.hr_payroll.dto.ReimbursementActionDTO;
import vacademy.io.admin_core_service.features.hr_payroll.dto.ReimbursementDTO;
import vacademy.io.admin_core_service.features.hr_payroll.entity.Reimbursement;
import vacademy.io.admin_core_service.features.hr_payroll.repository.ReimbursementRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.time.LocalDateTime;

@Service
public class ReimbursementService {

    @Autowired
    private ReimbursementRepository reimbursementRepository;

    @Autowired
    private EmployeeProfileRepository employeeProfileRepository;

    @Transactional
    public String submitReimbursement(CreateReimbursementDTO dto, String instituteId) {
        EmployeeProfile employee = employeeProfileRepository.findById(dto.getEmployeeId())
                .orElseThrow(() -> new VacademyException("Employee not found"));

        Reimbursement reimbursement = new Reimbursement();
        reimbursement.setEmployee(employee);
        reimbursement.setInstituteId(instituteId);
        reimbursement.setType(dto.getType());
        reimbursement.setAmount(dto.getAmount());
        reimbursement.setDescription(dto.getDescription());
        reimbursement.setReceiptFileId(dto.getReceiptFileId());
        reimbursement.setExpenseDate(dto.getExpenseDate());
        reimbursement.setStatus("PENDING");

        reimbursement = reimbursementRepository.save(reimbursement);
        return reimbursement.getId();
    }

    @Transactional(readOnly = true)
    public Page<ReimbursementDTO> getReimbursements(String instituteId, String status,
                                                      String employeeId, int pageNo, int pageSize) {
        Pageable pageable = PageRequest.of(pageNo, pageSize);
        Page<Reimbursement> page = reimbursementRepository.findByFilters(instituteId, status, employeeId, pageable);
        return page.map(this::toDTO);
    }

    @Transactional
    public String approveRejectReimbursement(String id, ReimbursementActionDTO actionDTO, String approverUserId) {
        Reimbursement reimbursement = reimbursementRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Reimbursement not found"));

        if (!"PENDING".equals(reimbursement.getStatus())) {
            throw new VacademyException("Only PENDING reimbursements can be actioned. Current status: " + reimbursement.getStatus());
        }

        String action = actionDTO.getAction();
        if ("APPROVED".equalsIgnoreCase(action)) {
            reimbursement.setStatus("APPROVED");
            reimbursement.setApprovedBy(approverUserId);
            reimbursement.setApprovedAt(LocalDateTime.now());
        } else if ("REJECTED".equalsIgnoreCase(action)) {
            reimbursement.setStatus("REJECTED");
            reimbursement.setRejectionReason(actionDTO.getRejectionReason());
        } else {
            throw new VacademyException("Invalid action. Must be APPROVED or REJECTED");
        }

        reimbursementRepository.save(reimbursement);
        return reimbursement.getId();
    }

    private ReimbursementDTO toDTO(Reimbursement r) {
        return ReimbursementDTO.builder()
                .id(r.getId())
                .employeeId(r.getEmployee().getId())
                .employeeCode(r.getEmployee().getEmployeeCode())
                .instituteId(r.getInstituteId())
                .type(r.getType())
                .amount(r.getAmount())
                .description(r.getDescription())
                .receiptFileId(r.getReceiptFileId())
                .expenseDate(r.getExpenseDate())
                .status(r.getStatus())
                .approvedBy(r.getApprovedBy())
                .rejectionReason(r.getRejectionReason())
                .build();
    }
}
