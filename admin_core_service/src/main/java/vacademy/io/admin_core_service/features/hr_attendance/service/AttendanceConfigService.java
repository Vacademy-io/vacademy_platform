package vacademy.io.admin_core_service.features.hr_attendance.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.hr_attendance.dto.AttendanceConfigDTO;
import vacademy.io.admin_core_service.features.hr_attendance.entity.AttendanceConfig;
import vacademy.io.admin_core_service.features.hr_attendance.repository.AttendanceConfigRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.util.Optional;

@Service
public class AttendanceConfigService {

    @Autowired
    private AttendanceConfigRepository attendanceConfigRepository;

    @Transactional
    public AttendanceConfigDTO saveConfig(AttendanceConfigDTO dto) {
        AttendanceConfig config;

        Optional<AttendanceConfig> existing = attendanceConfigRepository.findByInstituteId(dto.getInstituteId());
        if (existing.isPresent()) {
            config = existing.get();
        } else {
            config = new AttendanceConfig();
            config.setInstituteId(dto.getInstituteId());
        }

        config.setMode(dto.getMode());
        config.setAutoCheckoutEnabled(dto.getAutoCheckoutEnabled());
        config.setAutoCheckoutTime(dto.getAutoCheckoutTime());
        config.setGeoFenceEnabled(dto.getGeoFenceEnabled());
        config.setGeoFenceLat(dto.getGeoFenceLat());
        config.setGeoFenceLng(dto.getGeoFenceLng());
        config.setGeoFenceRadiusM(dto.getGeoFenceRadiusM());
        config.setIpRestrictionEnabled(dto.getIpRestrictionEnabled());
        config.setAllowedIps(dto.getAllowedIps());
        config.setOvertimeEnabled(dto.getOvertimeEnabled());
        config.setOvertimeThresholdMin(dto.getOvertimeThresholdMin());
        config.setHalfDayThresholdMin(dto.getHalfDayThresholdMin());
        config.setWeekendDays(dto.getWeekendDays());
        config.setSettings(dto.getSettings());

        AttendanceConfig saved = attendanceConfigRepository.save(config);
        return toDTO(saved);
    }

    @Transactional(readOnly = true)
    public AttendanceConfigDTO getConfig(String instituteId) {
        AttendanceConfig config = attendanceConfigRepository.findByInstituteId(instituteId)
                .orElseThrow(() -> new VacademyException("Attendance config not found for institute: " + instituteId));
        return toDTO(config);
    }

    private AttendanceConfigDTO toDTO(AttendanceConfig config) {
        AttendanceConfigDTO dto = new AttendanceConfigDTO();
        dto.setId(config.getId());
        dto.setInstituteId(config.getInstituteId());
        dto.setMode(config.getMode());
        dto.setAutoCheckoutEnabled(config.getAutoCheckoutEnabled());
        dto.setAutoCheckoutTime(config.getAutoCheckoutTime());
        dto.setGeoFenceEnabled(config.getGeoFenceEnabled());
        dto.setGeoFenceLat(config.getGeoFenceLat());
        dto.setGeoFenceLng(config.getGeoFenceLng());
        dto.setGeoFenceRadiusM(config.getGeoFenceRadiusM());
        dto.setIpRestrictionEnabled(config.getIpRestrictionEnabled());
        dto.setAllowedIps(config.getAllowedIps());
        dto.setOvertimeEnabled(config.getOvertimeEnabled());
        dto.setOvertimeThresholdMin(config.getOvertimeThresholdMin());
        dto.setHalfDayThresholdMin(config.getHalfDayThresholdMin());
        dto.setWeekendDays(config.getWeekendDays());
        dto.setSettings(config.getSettings());
        return dto;
    }
}
