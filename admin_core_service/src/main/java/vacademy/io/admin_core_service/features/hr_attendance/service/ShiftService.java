package vacademy.io.admin_core_service.features.hr_attendance.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.hr_attendance.dto.ShiftAssignDTO;
import vacademy.io.admin_core_service.features.hr_attendance.dto.ShiftDTO;
import vacademy.io.admin_core_service.features.hr_attendance.entity.EmployeeShiftMapping;
import vacademy.io.admin_core_service.features.hr_attendance.entity.Shift;
import vacademy.io.admin_core_service.features.hr_attendance.repository.EmployeeShiftMappingRepository;
import vacademy.io.admin_core_service.features.hr_attendance.repository.ShiftRepository;
import vacademy.io.admin_core_service.features.hr_employee.entity.EmployeeProfile;
import vacademy.io.admin_core_service.features.hr_employee.repository.EmployeeProfileRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class ShiftService {

    @Autowired
    private ShiftRepository shiftRepository;

    @Autowired
    private EmployeeShiftMappingRepository employeeShiftMappingRepository;

    @Autowired
    private EmployeeProfileRepository employeeProfileRepository;

    @Transactional
    public String createShift(ShiftDTO dto) {
        Shift shift = new Shift();
        shift.setInstituteId(dto.getInstituteId());
        shift.setName(dto.getName());
        shift.setCode(dto.getCode());
        shift.setStartTime(dto.getStartTime());
        shift.setEndTime(dto.getEndTime());
        shift.setBreakDurationMin(dto.getBreakDurationMin());
        shift.setIsNightShift(dto.getIsNightShift());
        shift.setGracePeriodMin(dto.getGracePeriodMin());
        shift.setMinHoursFullDay(dto.getMinHoursFullDay());
        shift.setMinHoursHalfDay(dto.getMinHoursHalfDay());
        shift.setIsDefault(dto.getIsDefault());
        shift.setStatus(dto.getStatus() != null ? dto.getStatus() : "ACTIVE");

        Shift saved = shiftRepository.save(shift);
        return saved.getId();
    }

    @Transactional
    public String updateShift(String id, ShiftDTO dto) {
        Shift shift = shiftRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Shift not found with id: " + id));

        if (dto.getName() != null) shift.setName(dto.getName());
        if (dto.getCode() != null) shift.setCode(dto.getCode());
        if (dto.getStartTime() != null) shift.setStartTime(dto.getStartTime());
        if (dto.getEndTime() != null) shift.setEndTime(dto.getEndTime());
        if (dto.getBreakDurationMin() != null) shift.setBreakDurationMin(dto.getBreakDurationMin());
        if (dto.getIsNightShift() != null) shift.setIsNightShift(dto.getIsNightShift());
        if (dto.getGracePeriodMin() != null) shift.setGracePeriodMin(dto.getGracePeriodMin());
        if (dto.getMinHoursFullDay() != null) shift.setMinHoursFullDay(dto.getMinHoursFullDay());
        if (dto.getMinHoursHalfDay() != null) shift.setMinHoursHalfDay(dto.getMinHoursHalfDay());
        if (dto.getIsDefault() != null) shift.setIsDefault(dto.getIsDefault());
        if (dto.getStatus() != null) shift.setStatus(dto.getStatus());

        shiftRepository.save(shift);
        return "Shift updated successfully";
    }

    @Transactional(readOnly = true)
    public List<ShiftDTO> getShifts(String instituteId) {
        List<Shift> shifts = shiftRepository.findByInstituteIdOrderByNameAsc(instituteId);
        return shifts.stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional
    public String assignShiftToEmployees(ShiftAssignDTO assignDTO) {
        Shift shift = shiftRepository.findById(assignDTO.getShiftId())
                .orElseThrow(() -> new VacademyException("Shift not found with id: " + assignDTO.getShiftId()));

        for (String employeeId : assignDTO.getEmployeeIds()) {
            EmployeeProfile employee = employeeProfileRepository.findById(employeeId)
                    .orElseThrow(() -> new VacademyException("Employee not found with id: " + employeeId));

            EmployeeShiftMapping mapping = new EmployeeShiftMapping();
            mapping.setEmployee(employee);
            mapping.setShift(shift);
            mapping.setEffectiveFrom(assignDTO.getEffectiveFrom());
            mapping.setEffectiveTo(assignDTO.getEffectiveTo());

            employeeShiftMappingRepository.save(mapping);
        }

        return "Shift assigned to " + assignDTO.getEmployeeIds().size() + " employee(s) successfully";
    }

    private ShiftDTO toDTO(Shift shift) {
        ShiftDTO dto = new ShiftDTO();
        dto.setId(shift.getId());
        dto.setInstituteId(shift.getInstituteId());
        dto.setName(shift.getName());
        dto.setCode(shift.getCode());
        dto.setStartTime(shift.getStartTime());
        dto.setEndTime(shift.getEndTime());
        dto.setBreakDurationMin(shift.getBreakDurationMin());
        dto.setIsNightShift(shift.getIsNightShift());
        dto.setGracePeriodMin(shift.getGracePeriodMin());
        dto.setMinHoursFullDay(shift.getMinHoursFullDay());
        dto.setMinHoursHalfDay(shift.getMinHoursHalfDay());
        dto.setIsDefault(shift.getIsDefault());
        dto.setStatus(shift.getStatus());
        return dto;
    }
}
