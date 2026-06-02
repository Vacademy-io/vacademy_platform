package vacademy.io.admin_core_service.features.live_session.provider.service.zoom;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.provider.dto.zoom.ZoomAccount;
import vacademy.io.common.media.service.FileService;
import vacademy.io.common.meeting.dto.MeetingRecordingDTO;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ZoomRecordingS3ServiceTest {

    @Mock private ZoomAccountStore zoomAccountStore;
    @Mock private ZoomAccessTokenService accessTokenService;
    @Mock private ZoomRecordingService zoomRecordingService;
    @Mock private FileService fileService;

    private ZoomRecordingS3Service newSpyService() {
        return spy(new ZoomRecordingS3Service(
                zoomAccountStore, accessTokenService, zoomRecordingService, fileService));
    }

    private SessionSchedule schedule() {
        return SessionSchedule.builder().id("sch-1").sessionId("sess-1").providerAccountId("acct-1").build();
    }

    private MeetingRecordingDTO rec(String id, String fileId, String downloadUrl, String storage, String expiresAt) {
        return MeetingRecordingDTO.builder()
                .recordingId(id).fileId(fileId).downloadUrl(downloadUrl)
                .recordingStorage(storage).expiresAt(expiresAt).build();
    }

    @Test
    void mirrorsUnmirroredCloudRecordingAndFlipsToS3() throws Exception {
        ZoomRecordingS3Service service = newSpyService();
        MeetingRecordingDTO cloud = rec("r1", null, "https://zoom/dl1", "ZOOM_CLOUD",
                Instant.now().plus(10, ChronoUnit.DAYS).toString());
        MeetingRecordingDTO already = rec("r2", "existing-file", "https://zoom/dl2", "S3", null);
        List<MeetingRecordingDTO> recordings = new ArrayList<>(List.of(cloud, already));

        when(zoomAccountStore.findById("acct-1")).thenReturn(Optional.of(mock(ZoomAccount.class)));
        when(zoomRecordingService.getStoredRecordings(any())).thenReturn(recordings);
        when(accessTokenService.getAccessToken(any())).thenReturn("tok");
        doReturn(new byte[]{1, 2, 3}).when(service).downloadBytes(anyString(), anyString());
        when(fileService.uploadDataToS3(any())).thenReturn("file-xyz");

        int mirrored = service.mirrorToS3(schedule(), false, 0);

        assertEquals(1, mirrored);
        assertEquals("file-xyz", cloud.getFileId());
        assertEquals("S3", cloud.getRecordingStorage());
        assertNull(cloud.getExpiresAt()); // cleared — on our storage now
        assertEquals("existing-file", already.getFileId()); // untouched
        verify(zoomRecordingService, times(1)).replaceRecordings(any(), eq(recordings));
        verify(service, times(1)).downloadBytes(anyString(), anyString()); // only the un-mirrored one
    }

    @Test
    void skipsWhenAllAlreadyMirrored() throws Exception {
        ZoomRecordingS3Service service = newSpyService();
        when(zoomAccountStore.findById("acct-1")).thenReturn(Optional.of(mock(ZoomAccount.class)));
        when(zoomRecordingService.getStoredRecordings(any()))
                .thenReturn(new ArrayList<>(List.of(rec("r1", "f1", "u1", "S3", null))));

        int mirrored = service.mirrorToS3(schedule(), false, 0);

        assertEquals(0, mirrored);
        verify(service, never()).downloadBytes(anyString(), anyString());
        verify(zoomRecordingService, never()).replaceRecordings(any(), any());
    }

    @Test
    void nearExpiryModeOnlyMirrorsExpiringSoon() throws Exception {
        ZoomRecordingS3Service service = newSpyService();
        MeetingRecordingDTO far = rec("r1", null, "u1", "ZOOM_CLOUD",
                Instant.now().plus(20, ChronoUnit.DAYS).toString());
        MeetingRecordingDTO soon = rec("r2", null, "u2", "ZOOM_CLOUD",
                Instant.now().plus(2, ChronoUnit.DAYS).toString());
        when(zoomAccountStore.findById("acct-1")).thenReturn(Optional.of(mock(ZoomAccount.class)));
        when(zoomRecordingService.getStoredRecordings(any()))
                .thenReturn(new ArrayList<>(List.of(far, soon)));
        when(accessTokenService.getAccessToken(any())).thenReturn("tok");
        doReturn(new byte[]{9}).when(service).downloadBytes(anyString(), anyString());
        when(fileService.uploadDataToS3(any())).thenReturn("file-soon");

        int mirrored = service.mirrorToS3(schedule(), true, 5); // rescue window 5 days

        assertEquals(1, mirrored);
        assertNull(far.getFileId());           // 20d out — not rescued
        assertEquals("file-soon", soon.getFileId()); // 2d out — rescued
    }

    @Test
    void downloadFailureLeavesRecordingUntouched() throws Exception {
        ZoomRecordingS3Service service = newSpyService();
        MeetingRecordingDTO cloud = rec("r1", null, "u1", "ZOOM_CLOUD",
                Instant.now().plus(1, ChronoUnit.DAYS).toString());
        when(zoomAccountStore.findById("acct-1")).thenReturn(Optional.of(mock(ZoomAccount.class)));
        when(zoomRecordingService.getStoredRecordings(any()))
                .thenReturn(new ArrayList<>(List.of(cloud)));
        when(accessTokenService.getAccessToken(any())).thenReturn("tok");
        doThrow(new RuntimeException("network")).when(service).downloadBytes(anyString(), anyString());

        int mirrored = service.mirrorToS3(schedule(), false, 0);

        assertEquals(0, mirrored);
        assertNull(cloud.getFileId());
        assertEquals("ZOOM_CLOUD", cloud.getRecordingStorage());
        verify(zoomRecordingService, never()).replaceRecordings(any(), any());
    }
}
