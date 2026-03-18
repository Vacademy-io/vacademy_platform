package vacademy.io.admin_core_service.features.hr_employee.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import vacademy.io.admin_core_service.features.hr_employee.dto.EmployeeFilterDTO;
import vacademy.io.admin_core_service.features.hr_employee.dto.EmployeeProfileDTO;
import vacademy.io.admin_core_service.features.hr_employee.dto.EmployeeStatusUpdateDTO;
import vacademy.io.admin_core_service.features.hr_employee.entity.Department;
import vacademy.io.admin_core_service.features.hr_employee.entity.Designation;
import vacademy.io.admin_core_service.features.hr_employee.entity.EmployeeProfile;
import vacademy.io.admin_core_service.features.hr_employee.enums.EmploymentStatus;
import vacademy.io.admin_core_service.features.hr_employee.enums.EmploymentType;
import vacademy.io.admin_core_service.features.hr_employee.repository.DepartmentRepository;
import vacademy.io.admin_core_service.features.hr_employee.repository.DesignationRepository;
import vacademy.io.admin_core_service.features.hr_employee.repository.EmployeeProfileRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class EmployeeService {

    @Autowired
    private EmployeeProfileRepository employeeProfileRepository;

    @Autowired
    private DepartmentRepository departmentRepository;

    @Autowired
    private DesignationRepository designationRepository;

    @Transactional
    public String createEmployee(EmployeeProfileDTO dto, String instituteId) {
        if (!StringUtils.hasText(dto.getUserId())) {
            throw new VacademyException("User ID is required");
        }

        if (employeeProfileRepository.existsByUserIdAndInstituteId(dto.getUserId(), instituteId)) {
            throw new VacademyException("Employee profile already exists for this user in this institute");
        }

        if (dto.getEmploymentType() != null) {
            try {
                EmploymentType.valueOf(dto.getEmploymentType());
            } catch (IllegalArgumentException e) {
                throw new VacademyException("Invalid employment type: " + dto.getEmploymentType());
            }
        }
        String employmentStatusValue = StringUtils.hasText(dto.getEmploymentStatus()) ? dto.getEmploymentStatus() : "ACTIVE";
        try {
            EmploymentStatus.valueOf(employmentStatusValue);
        } catch (IllegalArgumentException e) {
            throw new VacademyException("Invalid employment status: " + dto.getEmploymentStatus());
        }

        EmployeeProfile employee = new EmployeeProfile();
        employee.setUserId(dto.getUserId());
        employee.setInstituteId(instituteId);
        employee.setEmployeeCode(dto.getEmployeeCode());
        employee.setEmploymentType(dto.getEmploymentType());
        employee.setEmploymentStatus(employmentStatusValue);
        employee.setJoinDate(dto.getJoinDate());
        employee.setProbationEndDate(dto.getProbationEndDate());
        employee.setConfirmationDate(dto.getConfirmationDate());
        employee.setNoticePeriodDays(dto.getNoticePeriodDays() != null ? dto.getNoticePeriodDays() : 30);
        employee.setResignationDate(dto.getResignationDate());
        employee.setLastWorkingDate(dto.getLastWorkingDate());
        employee.setExitReason(dto.getExitReason());
        employee.setEmergencyContactName(dto.getEmergencyContactName());
        employee.setEmergencyContactPhone(dto.getEmergencyContactPhone());
        employee.setEmergencyContactRelation(dto.getEmergencyContactRelation());
        employee.setNationality(dto.getNationality());
        employee.setBloodGroup(dto.getBloodGroup());
        employee.setMaritalStatus(dto.getMaritalStatus());
        employee.setPanNumber(dto.getPanNumber());
        employee.setTaxIdNumber(dto.getTaxIdNumber());
        employee.setUanNumber(dto.getUanNumber());
        employee.setStatutoryInfo(dto.getStatutoryInfo());
        employee.setCustomFields(dto.getCustomFields());

        if (StringUtils.hasText(dto.getDepartmentId())) {
            Department department = departmentRepository.findById(dto.getDepartmentId())
                    .orElseThrow(() -> new VacademyException("Department not found"));
            employee.setDepartment(department);
        }

        if (StringUtils.hasText(dto.getDesignationId())) {
            Designation designation = designationRepository.findById(dto.getDesignationId())
                    .orElseThrow(() -> new VacademyException("Designation not found"));
            employee.setDesignation(designation);
        }

        if (StringUtils.hasText(dto.getReportingManagerId())) {
            EmployeeProfile manager = employeeProfileRepository.findById(dto.getReportingManagerId())
                    .orElseThrow(() -> new VacademyException("Reporting manager not found"));
            employee.setReportingManager(manager);
        }

        employee = employeeProfileRepository.save(employee);
        return employee.getId();
    }

    @Transactional
    public String updateEmployee(String id, EmployeeProfileDTO dto) {
        EmployeeProfile employee = employeeProfileRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Employee not found"));

        if (dto.getEmployeeCode() != null) {
            employee.setEmployeeCode(dto.getEmployeeCode());
        }
        if (dto.getEmploymentType() != null) {
            try {
                EmploymentType.valueOf(dto.getEmploymentType());
            } catch (IllegalArgumentException e) {
                throw new VacademyException("Invalid employment type: " + dto.getEmploymentType());
            }
            employee.setEmploymentType(dto.getEmploymentType());
        }
        if (dto.getEmploymentStatus() != null) {
            try {
                EmploymentStatus.valueOf(dto.getEmploymentStatus());
            } catch (IllegalArgumentException e) {
                throw new VacademyException("Invalid employment status: " + dto.getEmploymentStatus());
            }
            employee.setEmploymentStatus(dto.getEmploymentStatus());
        }
        if (dto.getJoinDate() != null) {
            employee.setJoinDate(dto.getJoinDate());
        }
        if (dto.getProbationEndDate() != null) {
            employee.setProbationEndDate(dto.getProbationEndDate());
        }
        if (dto.getConfirmationDate() != null) {
            employee.setConfirmationDate(dto.getConfirmationDate());
        }
        if (dto.getNoticePeriodDays() != null) {
            employee.setNoticePeriodDays(dto.getNoticePeriodDays());
        }
        if (dto.getResignationDate() != null) {
            employee.setResignationDate(dto.getResignationDate());
        }
        if (dto.getLastWorkingDate() != null) {
            employee.setLastWorkingDate(dto.getLastWorkingDate());
        }
        if (dto.getExitReason() != null) {
            employee.setExitReason(dto.getExitReason());
        }
        if (dto.getEmergencyContactName() != null) {
            employee.setEmergencyContactName(dto.getEmergencyContactName());
        }
        if (dto.getEmergencyContactPhone() != null) {
            employee.setEmergencyContactPhone(dto.getEmergencyContactPhone());
        }
        if (dto.getEmergencyContactRelation() != null) {
            employee.setEmergencyContactRelation(dto.getEmergencyContactRelation());
        }
        if (dto.getNationality() != null) {
            employee.setNationality(dto.getNationality());
        }
        if (dto.getBloodGroup() != null) {
            employee.setBloodGroup(dto.getBloodGroup());
        }
        if (dto.getMaritalStatus() != null) {
            employee.setMaritalStatus(dto.getMaritalStatus());
        }
        if (dto.getPanNumber() != null) {
            employee.setPanNumber(dto.getPanNumber());
        }
        if (dto.getTaxIdNumber() != null) {
            employee.setTaxIdNumber(dto.getTaxIdNumber());
        }
        if (dto.getUanNumber() != null) {
            employee.setUanNumber(dto.getUanNumber());
        }
        if (dto.getStatutoryInfo() != null) {
            employee.setStatutoryInfo(dto.getStatutoryInfo());
        }
        if (dto.getCustomFields() != null) {
            employee.setCustomFields(dto.getCustomFields());
        }

        if (dto.getDepartmentId() != null) {
            if (dto.getDepartmentId().isEmpty()) {
                employee.setDepartment(null);
            } else {
                Department department = departmentRepository.findById(dto.getDepartmentId())
                        .orElseThrow(() -> new VacademyException("Department not found"));
                employee.setDepartment(department);
            }
        }

        if (dto.getDesignationId() != null) {
            if (dto.getDesignationId().isEmpty()) {
                employee.setDesignation(null);
            } else {
                Designation designation = designationRepository.findById(dto.getDesignationId())
                        .orElseThrow(() -> new VacademyException("Designation not found"));
                employee.setDesignation(designation);
            }
        }

        if (dto.getReportingManagerId() != null) {
            if (dto.getReportingManagerId().isEmpty()) {
                employee.setReportingManager(null);
            } else {
                validateNoReportingCycle(id, dto.getReportingManagerId());
                EmployeeProfile manager = employeeProfileRepository.findById(dto.getReportingManagerId())
                        .orElseThrow(() -> new VacademyException("Reporting manager not found"));
                employee.setReportingManager(manager);
            }
        }

        employeeProfileRepository.save(employee);
        return employee.getId();
    }

    @Transactional(readOnly = true)
    public EmployeeProfileDTO getEmployeeById(String id) {
        EmployeeProfile employee = employeeProfileRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Employee not found"));

        return toDTO(employee);
    }

    @Transactional(readOnly = true)
    public Page<EmployeeProfileDTO> getEmployees(String instituteId, EmployeeFilterDTO filterDTO, int pageNo, int pageSize) {
        String status = (filterDTO != null && StringUtils.hasText(filterDTO.getStatus())) ? filterDTO.getStatus() : null;
        String departmentId = (filterDTO != null && StringUtils.hasText(filterDTO.getDepartmentId())) ? filterDTO.getDepartmentId() : null;
        String designationId = (filterDTO != null && StringUtils.hasText(filterDTO.getDesignationId())) ? filterDTO.getDesignationId() : null;
        String employmentType = (filterDTO != null && StringUtils.hasText(filterDTO.getEmploymentType())) ? filterDTO.getEmploymentType() : null;

        Pageable pageable = PageRequest.of(pageNo, pageSize, Sort.by(Sort.Direction.ASC, "joinDate"));

        Page<EmployeeProfile> employeePage = employeeProfileRepository.findByFilters(
                instituteId, status, departmentId, designationId, employmentType, pageable);

        return employeePage.map(this::toDTO);
    }

    @Transactional
    public String updateEmployeeStatus(String id, EmployeeStatusUpdateDTO statusUpdateDTO) {
        EmployeeProfile employee = employeeProfileRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Employee not found"));

        if (!StringUtils.hasText(statusUpdateDTO.getStatus())) {
            throw new VacademyException("Status is required");
        }
        try {
            EmploymentStatus.valueOf(statusUpdateDTO.getStatus());
        } catch (IllegalArgumentException e) {
            throw new VacademyException("Invalid employment status: " + statusUpdateDTO.getStatus());
        }

        employee.setEmploymentStatus(statusUpdateDTO.getStatus());

        if (statusUpdateDTO.getResignationDate() != null) {
            employee.setResignationDate(statusUpdateDTO.getResignationDate());
        }
        if (statusUpdateDTO.getLastWorkingDate() != null) {
            employee.setLastWorkingDate(statusUpdateDTO.getLastWorkingDate());
        }
        if (StringUtils.hasText(statusUpdateDTO.getExitReason())) {
            employee.setExitReason(statusUpdateDTO.getExitReason());
        }

        employeeProfileRepository.save(employee);
        return employee.getId();
    }

    @Transactional(readOnly = true)
    public List<EmployeeProfileDTO> getOrgChart(String employeeId) {
        // Get direct reports for the given employee
        List<EmployeeProfile> directReports = employeeProfileRepository.findByReportingManagerId(employeeId);

        return directReports.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
    }

    private void validateNoReportingCycle(String employeeId, String newManagerId) {
        Set<String> visited = new HashSet<>();
        visited.add(employeeId);
        String currentId = newManagerId;
        while (currentId != null) {
            if (visited.contains(currentId)) {
                throw new VacademyException("Circular reporting hierarchy detected");
            }
            visited.add(currentId);
            Optional<EmployeeProfile> manager = employeeProfileRepository.findById(currentId);
            currentId = manager.map(m -> m.getReportingManager() != null ? m.getReportingManager().getId() : null).orElse(null);
        }
    }

    private String maskSensitive(String value) {
        if (value == null || value.length() <= 4) return "****";
        return "****" + value.substring(value.length() - 4);
    }

    private EmployeeProfileDTO toDTO(EmployeeProfile employee) {
        EmployeeProfileDTO dto = EmployeeProfileDTO.builder()
                .id(employee.getId())
                .userId(employee.getUserId())
                .instituteId(employee.getInstituteId())
                .employeeCode(employee.getEmployeeCode())
                .employmentType(employee.getEmploymentType())
                .employmentStatus(employee.getEmploymentStatus())
                .joinDate(employee.getJoinDate())
                .probationEndDate(employee.getProbationEndDate())
                .confirmationDate(employee.getConfirmationDate())
                .noticePeriodDays(employee.getNoticePeriodDays())
                .resignationDate(employee.getResignationDate())
                .lastWorkingDate(employee.getLastWorkingDate())
                .exitReason(employee.getExitReason())
                .emergencyContactName(employee.getEmergencyContactName())
                .emergencyContactPhone(employee.getEmergencyContactPhone())
                .emergencyContactRelation(employee.getEmergencyContactRelation())
                .nationality(employee.getNationality())
                .bloodGroup(employee.getBloodGroup())
                .maritalStatus(employee.getMaritalStatus())
                .panNumber(maskSensitive(employee.getPanNumber()))
                .taxIdNumber(maskSensitive(employee.getTaxIdNumber()))
                .uanNumber(maskSensitive(employee.getUanNumber()))
                .statutoryInfo(employee.getStatutoryInfo())
                .customFields(employee.getCustomFields())
                .build();

        // Populate department name
        if (employee.getDepartment() != null) {
            dto.setDepartmentId(employee.getDepartment().getId());
            dto.setDepartmentName(employee.getDepartment().getName());
        }

        // Populate designation name
        if (employee.getDesignation() != null) {
            dto.setDesignationId(employee.getDesignation().getId());
            dto.setDesignationName(employee.getDesignation().getName());
        }

        // Populate reporting manager name
        if (employee.getReportingManager() != null) {
            dto.setReportingManagerId(employee.getReportingManager().getId());
            // Use employee code as manager name identifier; user name would require auth service call
            dto.setReportingManagerName(employee.getReportingManager().getEmployeeCode());
        }

        return dto;
    }
}
