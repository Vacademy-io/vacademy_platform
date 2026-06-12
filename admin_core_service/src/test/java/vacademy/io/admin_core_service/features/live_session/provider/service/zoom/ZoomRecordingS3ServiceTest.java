package vacademy.io.admin_core_service.features.live_session.provider.service.zoom;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import vacademy.io.admin_core_service.features.live_session.entity.SessionSchedule;
import vacademy.io.admin_core_service.features.live_session.provider.dto.zoom.ZoomAccount;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.common.media.dto.FileDetailsDTO;
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
    @Mock private MediaService mediaService;

    private ZoomRecordingS3Service newSpyService() {
        return spy(new ZoomRecordingS3Service(
                zoomAccountStore, accessTokenService, zoomRecordingService, mediaService));
    }

    private static FileDetailsDTO uploaded(String id, String url) {
        return FileDetailsDTO.builder().id(id).url(url).build();
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
        when(mediaService.uploadFileV2(any()))
                .thenReturn(uploaded("file-xyz", "https://pub-bucket.s3.amazonaws.com/zoom-recording-r1.mp4"));

        int mirrored = service.mirrorToS3(schedule(), false, 0);

        assertEquals(1, mirrored);
        assertEquals("file-xyz", cloud.getFileId());
        assertEquals("S3", cloud.getRecordingStorage());
        assertNull(cloud.getExpiresAt()); // cleared — on our storage now
        // Provider (Zoom) URLs repointed to our permanent public-S3 copy so the
        // recording survives Zoom's auto-delete.
        assertEquals("https://pub-bucket.s3.amazonaws.com/zoom-recording-r1.mp4", cloud.getDownloadUrl());
        assertEquals("https://pub-bucket.s3.amazonaws.com/zoom-recording-r1.mp4", cloud.getPlaybackUrl());
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
        when(mediaService.uploadFileV2(any()))
                .thenReturn(uploaded("file-soon", "https://pub-bucket.s3.amazonaws.com/zoom-recording-r2.mp4"));

        int mirrored = service.mirrorToS3(schedule(), true, 5); // rescue window 5 days

        assertEquals(1, mirrored);
        assertNull(far.getFileId());           // 20d out — not rescued
        assertEquals("file-soon", soon.getFileId()); // 2d out — rescued
    }

    @Test
    void reMirrorsLegacyUrlAsFileId() throws Exception {
        // A row from the old buggy mirror stored the S3 URL in the fileId field.
        // It must be treated as un-mirrored and repaired on re-run.
        ZoomRecordingS3Service service = newSpyService();
        MeetingRecordingDTO legacy = rec("r1",
                "https://pub-bucket.s3.amazonaws.com/old.mp4", // URL-as-fileId (legacy bug)
                "https://zoom/dl1", "S3", null);
        List<MeetingRecordingDTO> recordings = new ArrayList<>(List.of(legacy));

        when(zoomAccountStore.findById("acct-1")).thenReturn(Optional.of(mock(ZoomAccount.class)));
        when(zoomRecordingService.getStoredRecordings(any())).thenReturn(recordings);
        when(accessTokenService.getAccessToken(any())).thenReturn("tok");
        doReturn(new byte[]{1}).when(service).downloadBytes(anyString(), anyString());
        when(mediaService.uploadFileV2(any()))
                .thenReturn(uploaded("real-id", "https://pub-bucket.s3.amazonaws.com/new.mp4"));

        int mirrored = service.mirrorToS3(schedule(), false, 0);

        assertEquals(1, mirrored);
        assertEquals("real-id", legacy.getFileId());                                  // repaired to a real id
        assertEquals("https://pub-bucket.s3.amazonaws.com/new.mp4", legacy.getDownloadUrl()); // repointed to S3
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
