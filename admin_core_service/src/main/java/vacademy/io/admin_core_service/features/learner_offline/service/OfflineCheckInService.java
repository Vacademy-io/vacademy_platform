package vacademy.io.admin_core_service.features.learner_offline.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineCheckInRequest;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineCheckInResponseDTO;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineInstalledCourseDTO;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineManifestUpdateDTO;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineRevocationDTO;
import vacademy.io.admin_core_service.features.learner_offline.entity.OfflineAccessRule;
import vacademy.io.admin_core_service.features.learner_offline.entity.OfflineDevice;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineDeviceStatus;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineRevocationReason;
import vacademy.io.admin_core_service.features.learner_offline.repository.OfflineAccessRuleRepository;
import vacademy.io.admin_core_service.features.learner_offline.repository.OfflineDeviceRepository;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Check-in processing (offline plan, Part A3): renews a device's lease and,
 * per installed course, tells the client whether to purge it (un-enrolled /
 * offline disabled / device revoked) or that a newer manifest is available.
 * Course-granularity only -- this reuses the same enrollment check and the
 * same resolver as OfflineManifestService/OfflineAccessRuleService, but at
 * just the PACKAGE/PACKAGE_SESSION levels of the chain (a course-level
 * decision, not a per-slide one).
 */
@Service
@RequiredArgsConstructor
public class OfflineCheckInService {

    private final OfflineDeviceRepository offlineDeviceRepository;
    private final OfflineDeviceService offlineDeviceService;
    private final StudentSessionInstituteGroupMappingRepository studentSessionInstituteGroupMappingRepository;
    private final PackageSessionRepository packageSessionRepository;
    private final OfflineAccessRuleRepository offlineAccessRuleRepository;
    private final OfflineAccessRuleService offlineAccessRuleService;
    private final OfflineSettingService offlineSettingService;
    private final OfflineManifestVersionService offlineManifestVersionService;

    @Transactional
    public OfflineCheckInResponseDTO checkIn(String userId, String deviceId, OfflineCheckInRequest request) {
        OfflineDevice device = offlineDeviceRepository.findByIdAndUserId(deviceId, userId)
                .orElseThrow(() -> new VacademyException(HttpStatus.NOT_FOUND, "Device not found"));

        List<OfflineInstalledCourseDTO> installedCourses = request == null || request.getInstalledCourses() == null
                ? List.of() : request.getInstalledCourses();

        if (device.getStatus() == OfflineDeviceStatus.REVOKED) {
            List<OfflineRevocationDTO> revocations = new ArrayList<>();
            for (OfflineInstalledCourseDTO course : installedCourses) {
                revocations.add(new OfflineRevocationDTO(course.getPackageSessionId(),
                        OfflineRevocationReason.DEVICE_REVOKED));
            }
            return new OfflineCheckInResponseDTO(OfflineDeviceStatus.REVOKED, device.getLeaseExpiresAt(),
                    revocations, List.of());
        }

        // ACTIVE device: renew the lease regardless of per-course outcomes below.
        offlineDeviceService.renewLease(device, device.getInstituteId());
        device.setLastCheckinAt(java.sql.Timestamp.from(java.time.Instant.now()));
        offlineDeviceRepository.save(device);

        List<OfflineRevocationDTO> revocations = new ArrayList<>();
        List<OfflineManifestUpdateDTO> manifestUpdates = new ArrayList<>();

        for (OfflineInstalledCourseDTO course : installedCourses) {
            String packageSessionId = course.getPackageSessionId();
            if (packageSessionId == null || packageSessionId.isBlank()) {
                continue;
            }

            StudentSessionInstituteGroupMapping mapping = studentSessionInstituteGroupMappingRepository
                    .findByUserIdAndPackageSessionId(userId, packageSessionId).orElse(null);
            boolean activelyEnrolled = mapping != null
                    && (mapping.getStatus() == null || "ACTIVE".equalsIgnoreCase(mapping.getStatus()))
                    && (mapping.getExpiryDate() == null
                            || mapping.getExpiryDate().after(new java.util.Date()));
            if (!activelyEnrolled) {
                revocations.add(new OfflineRevocationDTO(packageSessionId, OfflineRevocationReason.UNENROLLED));
                continue;
            }

            String instituteId = mapping.getInstitute() != null ? mapping.getInstitute().getId() : null;
            if (!isOfflineAllowedForCourse(instituteId, packageSessionId)) {
                revocations.add(new OfflineRevocationDTO(packageSessionId, OfflineRevocationReason.OFFLINE_DISABLED));
                continue;
            }

            long currentVersion = Math.max(1, offlineManifestVersionService.getVersion(packageSessionId));
            Long reportedVersion = course.getManifestVersion();
            if (reportedVersion == null || reportedVersion != currentVersion) {
                manifestUpdates.add(new OfflineManifestUpdateDTO(packageSessionId, currentVersion));
            }
        }

        return new OfflineCheckInResponseDTO(OfflineDeviceStatus.ACTIVE, device.getLeaseExpiresAt(),
                revocations, manifestUpdates);
    }

    /**
     * Course-level offline resolution: institute flag + course default +
     * PACKAGE/PACKAGE_SESSION rules only (no SUBJECT/MODULE/CHAPTER/SLIDE --
     * check-in operates at course granularity).
     */
    private boolean isOfflineAllowedForCourse(String instituteId, String packageSessionId) {
        boolean instituteEnabled = offlineSettingService.isEnabled(instituteId);

        PackageSession packageSession = packageSessionRepository.findById(packageSessionId).orElse(null);
        String packageId = packageSession != null && packageSession.getPackageEntity() != null
                ? packageSession.getPackageEntity().getId() : null;
        boolean courseDefault = offlineAccessRuleService.getCourseDefault(packageId);

        Map<String, Boolean> ruleMap = new HashMap<>();
        for (OfflineAccessRule rule : offlineAccessRuleRepository.findAllForPackageSession(packageSessionId, packageId)) {
            ruleMap.put(rule.getSourceType().name() + ":" + rule.getSourceId(), rule.getAllow());
        }
        Boolean packageAllow = ruleMap.get("PACKAGE:" + packageId);
        Boolean packageSessionAllow = ruleMap.get("PACKAGE_SESSION:" + packageSessionId);

        return OfflineAccessResolver.resolve(java.util.Arrays.asList(packageAllow, packageSessionAllow),
                courseDefault, instituteEnabled);
    }
}
