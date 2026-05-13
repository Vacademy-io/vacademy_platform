package vacademy.io.admin_core_service.features.youtube.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import vacademy.io.admin_core_service.features.youtube.entity.YoutubeUploadJob;

import java.util.Date;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class YoutubeUploadJobDTO {
    private String id;
    private String instituteId;
    private String sessionScheduleId;
    private String recordingId;
    private String recordingFileId;
    private String status;
    private String youtubeVideoId;
    private String youtubeVideoUrl;
    private String title;
    private String privacyStatus;
    private Integer attempts;
    private Integer maxAttempts;
    private Date nextRetryAt;
    private String lastError;
    private String lastErrorCode;
    private String triggeredVia;
    private String triggeredByUserId;
    private Date startedAt;
    private Date finishedAt;
    private Date createdAt;

    public static YoutubeUploadJobDTO from(YoutubeUploadJob j) {
        return YoutubeUploadJobDTO.builder()
                .id(j.getId())
                .instituteId(j.getInstituteId())
                .sessionScheduleId(j.getSessionScheduleId())
                .recordingId(j.getRecordingId())
                .recordingFileId(j.getRecordingFileId())
                .status(j.getStatus())
                .youtubeVideoId(j.getYoutubeVideoId())
                .youtubeVideoUrl(j.getYoutubeVideoUrl())
                .title(j.getTitle())
                .privacyStatus(j.getPrivacyStatus())
                .attempts(j.getAttempts())
                .maxAttempts(j.getMaxAttempts())
                .nextRetryAt(j.getNextRetryAt())
                .lastError(j.getLastError())
                .lastErrorCode(j.getLastErrorCode())
                .triggeredVia(j.getTriggeredVia())
                .triggeredByUserId(j.getTriggeredByUserId())
                .startedAt(j.getStartedAt())
                .finishedAt(j.getFinishedAt())
                .createdAt(j.getCreatedAt())
                .build();
    }
}
