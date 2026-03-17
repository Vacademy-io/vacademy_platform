package vacademy.io.admin_core_service.features.hr_attendance.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.hr_attendance.dto.HolidayDTO;
import vacademy.io.admin_core_service.features.hr_attendance.entity.Holiday;
import vacademy.io.admin_core_service.features.hr_attendance.repository.HolidayRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class HolidayService {

    @Autowired
    private HolidayRepository holidayRepository;

    @Transactional
    public String createHoliday(HolidayDTO dto) {
        Holiday holiday = new Holiday();
        holiday.setInstituteId(dto.getInstituteId());
        holiday.setName(dto.getName());
        holiday.setDate(dto.getDate());
        holiday.setType(dto.getType());
        holiday.setIsOptional(dto.getIsOptional());
        holiday.setMaxOptionalAllowed(dto.getMaxOptionalAllowed());
        holiday.setYear(dto.getYear() != null ? dto.getYear() : dto.getDate().getYear());
        holiday.setDescription(dto.getDescription());

        Holiday saved = holidayRepository.save(holiday);
        return saved.getId();
    }

    @Transactional
    public String updateHoliday(String id, HolidayDTO dto) {
        Holiday holiday = holidayRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Holiday not found with id: " + id));

        if (dto.getName() != null) holiday.setName(dto.getName());
        if (dto.getDate() != null) {
            holiday.setDate(dto.getDate());
            holiday.setYear(dto.getDate().getYear());
        }
        if (dto.getType() != null) holiday.setType(dto.getType());
        if (dto.getIsOptional() != null) holiday.setIsOptional(dto.getIsOptional());
        if (dto.getMaxOptionalAllowed() != null) holiday.setMaxOptionalAllowed(dto.getMaxOptionalAllowed());
        if (dto.getYear() != null) holiday.setYear(dto.getYear());
        if (dto.getDescription() != null) holiday.setDescription(dto.getDescription());

        holidayRepository.save(holiday);
        return "Holiday updated successfully";
    }

    @Transactional
    public void deleteHoliday(String id) {
        Holiday holiday = holidayRepository.findById(id)
                .orElseThrow(() -> new VacademyException("Holiday not found with id: " + id));
        holidayRepository.delete(holiday);
    }

    @Transactional(readOnly = true)
    public List<HolidayDTO> getHolidays(String instituteId, Integer year) {
        List<Holiday> holidays = holidayRepository.findByInstituteIdAndYearOrderByDateAsc(instituteId, year);
        return holidays.stream().map(this::toDTO).collect(Collectors.toList());
    }

    @Transactional
    public String bulkCreateHolidays(List<HolidayDTO> holidays) {
        int successCount = 0;
        for (HolidayDTO dto : holidays) {
            Holiday holiday = new Holiday();
            holiday.setInstituteId(dto.getInstituteId());
            holiday.setName(dto.getName());
            holiday.setDate(dto.getDate());
            holiday.setType(dto.getType());
            holiday.setIsOptional(dto.getIsOptional());
            holiday.setMaxOptionalAllowed(dto.getMaxOptionalAllowed());
            holiday.setYear(dto.getYear() != null ? dto.getYear() : dto.getDate().getYear());
            holiday.setDescription(dto.getDescription());

            holidayRepository.save(holiday);
            successCount++;
        }
        return successCount + " holiday(s) created successfully";
    }

    private HolidayDTO toDTO(Holiday holiday) {
        HolidayDTO dto = new HolidayDTO();
        dto.setId(holiday.getId());
        dto.setInstituteId(holiday.getInstituteId());
        dto.setName(holiday.getName());
        dto.setDate(holiday.getDate());
        dto.setType(holiday.getType());
        dto.setIsOptional(holiday.getIsOptional());
        dto.setMaxOptionalAllowed(holiday.getMaxOptionalAllowed());
        dto.setYear(holiday.getYear());
        dto.setDescription(holiday.getDescription());
        return dto;
    }
}
