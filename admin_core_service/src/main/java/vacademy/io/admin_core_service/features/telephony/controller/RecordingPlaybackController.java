package vacademy.io.admin_core_service.features.telephony.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.Map;

import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/**
 * Returns a short-lived presigned URL for the recording mp3 instead of
 * proxying the bytes — keeps admin_core_service out of the audio path.
 *
 * The supplied {@code instituteId} must match the row's institute; cross-
 * institute fetches return 403 even if the UUID is somehow leaked.
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/calls")
public class RecordingPlaybackController {

    @Autowired private TelephonyCallLogRepository callLogRepo;
    @Autowired private MediaService mediaService;

    @GetMapping("/{callLogId}/recording")
    public ResponseEntity<Map<String, String>> recording(
            @PathVariable String callLogId,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        TelephonyCallLog row = callLogRepo.findById(callLogId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
        if (instituteId == null || !instituteId.equals(row.getInstituteId())) {
            throw new ResponseStatusException(FORBIDDEN);
        }
        if (row.getRecordingStorageKey() == null) {
            return ResponseEntity.noContent().build();
        }
        // Use the PUBLIC-bucket URL endpoint because RecordingTxOps.persist
        // uploads via MediaService.uploadFileV2 which writes to
        // vacademy-media-storage-public. getFileUrlById would resolve to the
        // private bucket (vacademy-media-storage) and return a NoSuchKey URL
        // for a file that lives in the public one.
        String url = mediaService.getFilePublicUrlById(row.getRecordingStorageKey());
        return ResponseEntity.ok(Map.of("url", url == null ? "" : url));
    }
}
