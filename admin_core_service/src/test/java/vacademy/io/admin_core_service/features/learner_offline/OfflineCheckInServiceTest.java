package vacademy.io.admin_core_service.features.learner_offline;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import vacademy.io.admin_core_service.features.institute_learner.entity.StudentSessionInstituteGroupMapping;
import vacademy.io.admin_core_service.features.institute_learner.repository.StudentSessionInstituteGroupMappingRepository;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineCheckInRequest;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineCheckInResponseDTO;
import vacademy.io.admin_core_service.features.learner_offline.dto.OfflineInstalledCourseDTO;
import vacademy.io.admin_core_service.features.learner_offline.entity.OfflineDevice;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineDeviceStatus;
import vacademy.io.admin_core_service.features.learner_offline.enums.OfflineRevocationReason;
import vacademy.io.admin_core_service.features.learner_offline.repository.OfflineAccessRuleRepository;
import vacademy.io.admin_core_service.features.learner_offline.repository.OfflineDeviceRepository;
import vacademy.io.admin_core_service.features.learner_offline.service.OfflineAccessRuleService;
import vacademy.io.admin_core_service.features.learner_offline.service.OfflineCheckInService;
import vacademy.io.admin_core_service.features.learner_offline.service.OfflineDeviceService;
import vacademy.io.admin_core_service.features.learner_offline.service.OfflineManifestVersionService;
import vacademy.io.admin_core_service.features.learner_offline.service.OfflineSettingService;
import vacademy.io.admin_core_service.features.packages.repository.PackageSessionRepository;
import vacademy.io.common.institute.entity.Institute;
import vacademy.io.common.institute.entity.PackageEntity;
import vacademy.io.common.institute.entity.session.PackageSession;

import java.util.Date;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/** Check-in revocation semantics (offline plan Part A3 + spec §4.1). */
@ExtendWith(MockitoExtension.class)
class OfflineCheckInServiceTest {

    private static final String USER = "u1";
    private static final String DEVICE = "dev1";
    private static final String PS = "ps1";
    private static final String PKG = "pkg1";
    private static final String INSTITUTE = "inst1";

    @Mock private OfflineDeviceRepository offlineDeviceRepository;
    @Mock private OfflineDeviceService offlineDeviceService;
    @Mock private StudentSessionInstituteGroupMappingRepository ssigmRepository;
    @Mock private PackageSessionRepository packageSessionRepository;
    @Mock private OfflineAccessRuleRepository offlineAccessRuleRepository;
    @Mock private OfflineAccessRuleService offlineAccessRuleService;
    @Mock private OfflineSettingService offlineSettingService;
    @Mock private OfflineManifestVersionService offlineManifestVersionService;

    @InjectMocks private OfflineCheckInService offlineCheckInService;

    private OfflineDevice device;

    @BeforeEach
    void setUp() {
        device = new OfflineDevice();
        device.setId(DEVICE);
        device.setUserId(USER);
        device.setInstituteId(INSTITUTE);
        device.setStatus(OfflineDeviceStatus.ACTIVE);
        when(offlineDeviceRepository.findByIdAndUserId(DEVICE, USER)).thenReturn(Optional.of(device));
    }

    private OfflineCheckInRequest requestWithCourse(long manifestVersion) {
        OfflineInstalledCourseDTO course = new OfflineInstalledCourseDTO();
        course.setPackageSessionId(PS);
        course.setManifestVersion(manifestVersion);
        OfflineCheckInRequest request = new OfflineCheckInRequest();
        request.setInstalledCourses(List.of(course));
        return request;
    }

    private StudentSessionInstituteGroupMapping enrollment(String status, Date expiryDate) {
        StudentSessionInstituteGroupMapping mapping = new StudentSessionInstituteGroupMapping();
        mapping.setStatus(status);
        mapping.setExpiryDate(expiryDate);
        Institute institute = new Institute();
        institute.setId(INSTITUTE);
        mapping.setInstitute(institute);
        return mapping;
    }

    private void stubOfflineAllowed() {
        lenient().when(offlineSettingService.isEnabled(INSTITUTE)).thenReturn(true);
        PackageSession packageSession = new PackageSession();
        PackageEntity packageEntity = new PackageEntity();
        packageEntity.setId(PKG);
        packageSession.setPackageEntity(packageEntity);
        lenient().when(packageSessionRepository.findById(PS)).thenReturn(Optional.of(packageSession));
        lenient().when(offlineAccessRuleService.getCourseDefault(PKG)).thenReturn(true);
        lenient().when(offlineAccessRuleRepository.findAllForPackageSession(PS, PKG)).thenReturn(List.of());
    }

    @Test
    @DisplayName("revoked device: every installed course is revoked with DEVICE_REVOKED and lease is not renewed")
    void revokedDevicePurgesEverything() {
        device.setStatus(OfflineDeviceStatus.REVOKED);

        OfflineCheckInResponseDTO response = offlineCheckInService.checkIn(USER, DEVICE, requestWithCourse(1));

        assertEquals(OfflineDeviceStatus.REVOKED, response.getDeviceStatus());
        assertEquals(1, response.getRevocations().size());
        assertEquals(OfflineRevocationReason.DEVICE_REVOKED, response.getRevocations().get(0).getReason());
    }

    @Test
    @DisplayName("inactive enrollment status → UNENROLLED revocation")
    void unenrolledStatusRevokes() {
        when(ssigmRepository.findByUserIdAndPackageSessionId(USER, PS))
                .thenReturn(Optional.of(enrollment("TERMINATED", null)));

        OfflineCheckInResponseDTO response = offlineCheckInService.checkIn(USER, DEVICE, requestWithCourse(1));

        assertEquals(OfflineRevocationReason.UNENROLLED, response.getRevocations().get(0).getReason());
    }

    @Test
    @DisplayName("expired enrollment (expiry_date in the past) → UNENROLLED revocation even when status is ACTIVE")
    void expiredEnrollmentRevokes() {
        Date yesterday = new Date(System.currentTimeMillis() - 24L * 60 * 60 * 1000);
        when(ssigmRepository.findByUserIdAndPackageSessionId(USER, PS))
                .thenReturn(Optional.of(enrollment("ACTIVE", yesterday)));

        OfflineCheckInResponseDTO response = offlineCheckInService.checkIn(USER, DEVICE, requestWithCourse(1));

        assertEquals(OfflineRevocationReason.UNENROLLED, response.getRevocations().get(0).getReason());
    }

    @Test
    @DisplayName("institute offline setting disabled → OFFLINE_DISABLED revocation")
    void instituteDisabledRevokes() {
        when(ssigmRepository.findByUserIdAndPackageSessionId(USER, PS))
                .thenReturn(Optional.of(enrollment("ACTIVE", null)));
        stubOfflineAllowed();
        when(offlineSettingService.isEnabled(INSTITUTE)).thenReturn(false);

        OfflineCheckInResponseDTO response = offlineCheckInService.checkIn(USER, DEVICE, requestWithCourse(1));

        assertEquals(OfflineRevocationReason.OFFLINE_DISABLED, response.getRevocations().get(0).getReason());
    }

    @Test
    @DisplayName("allowed course with stale manifest version → manifestUpdates entry, no revocation")
    void staleManifestVersionReported() {
        when(ssigmRepository.findByUserIdAndPackageSessionId(USER, PS))
                .thenReturn(Optional.of(enrollment("ACTIVE", null)));
        stubOfflineAllowed();
        when(offlineManifestVersionService.getVersion(PS)).thenReturn(5L);

        OfflineCheckInResponseDTO response = offlineCheckInService.checkIn(USER, DEVICE, requestWithCourse(3));

        assertTrue(response.getRevocations().isEmpty());
        assertEquals(1, response.getManifestUpdates().size());
        assertEquals(5L, response.getManifestUpdates().get(0).getCurrentManifestVersion());
    }

    @Test
    @DisplayName("allowed course, current manifest → clean response and lease renewal")
    void cleanCheckInRenewsLease() {
        when(ssigmRepository.findByUserIdAndPackageSessionId(USER, PS))
                .thenReturn(Optional.of(enrollment("ACTIVE", null)));
        stubOfflineAllowed();
        when(offlineManifestVersionService.getVersion(PS)).thenReturn(4L);

        OfflineCheckInResponseDTO response = offlineCheckInService.checkIn(USER, DEVICE, requestWithCourse(4));

        assertEquals(OfflineDeviceStatus.ACTIVE, response.getDeviceStatus());
        assertTrue(response.getRevocations().isEmpty());
        assertTrue(response.getManifestUpdates().isEmpty());
        org.mockito.Mockito.verify(offlineDeviceService).renewLease(any(OfflineDevice.class), anyString());
    }
}
