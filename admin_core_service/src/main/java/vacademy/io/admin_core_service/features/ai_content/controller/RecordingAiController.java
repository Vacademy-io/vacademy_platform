package vacademy.io.admin_core_service.features.ai_content.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.ai_content.dto.AssessmentArtifactDto;
import vacademy.io.admin_core_service.features.ai_content.dto.CreateAssessmentFromRecordingDto;
import vacademy.io.admin_core_service.features.ai_content.dto.TranscriptionCallbackDto;
import vacademy.io.admin_core_service.features.ai_content.dto.TranscriptionStatusDto;
import vacademy.io.admin_core_service.features.ai_content.service.RecordingAssessmentService;
import vacademy.io.admin_core_service.features.ai_content.service.RecordingTranscriptionService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;
import java.util.Map;

/**
 * Admin-facing endpoints for recording-derived AI artifacts.
 *
 * Endpoint surface (Layer 1 — transcription):
 *   POST  /live-sessions/schedule/{scheduleId}/recording/{recordingId}/transcribe
 *   GET   /live-sessions/schedule/{scheduleId}/recording/{recordingId}/transcribe
 *   POST  /live-sessions/transcription/callback  (worker → admin-core)
 *
 * Endpoint surface (Layer 3 — assessment generation):
 *   POST  /live-sessions/schedule/{scheduleId}/recording/{recordingId}/create-assessment
 *   GET   /live-sessions/schedule/{scheduleId}/recording/{recordingId}/assessments
 *
 * scheduleId is in the path because the frontend already knows it from the
 * recording-list context — avoids an O(n) scan across schedules to locate
 * the recording by id alone.
 */
@RestController
@RequestMapping("/admin-core-service/live-sessions")
@RequiredArgsConstructor
@Slf4j
public class RecordingAiController {

    private final RecordingTranscriptionService transcriptionService;
    private final RecordingAssessmentService assessmentService;

    /** Kick off transcription. Idempotent for completed jobs; 409 if already in progress. */
    @PostMapping("/schedule/{scheduleId}/recording/{recordingId}/transcribe")
    public ResponseEntity<TranscriptionStatusDto> submit(
            @PathVariable String scheduleId,
            @PathVariable String recordingId,
            @RequestAttribute("user") CustomUserDetails user) {
        TranscriptionStatusDto dto = transcriptionService.submitForRecording(scheduleId, recordingId, user);
        return ResponseEntity.ok(dto);
    }

    /** UI polling endpoint. Returns {status: null} when no extraction row exists yet. */
    @GetMapping("/schedule/{scheduleId}/recording/{recordingId}/transcribe")
    public ResponseEntity<TranscriptionStatusDto> status(
            @PathVariable String scheduleId,
            @PathVariable String recordingId) {
        return ResponseEntity.ok(transcriptionService.getStatus(scheduleId, recordingId));
    }

    /**
     * Worker callback — called by the render worker (via ai-service) on
     * terminal state. Authenticated via a `?token=...` query param that
     * admin-core embedded in the callback URL at submit time. The worker
     * doesn't natively forward custom headers, so we tunnel auth in the
     * URL itself. Idempotent on jobId.
     */
    @PostMapping("/transcription/callback")
    public ResponseEntity<Void> callback(
            @RequestBody TranscriptionCallbackDto payload,
            @RequestParam(value = "token", required = false) String token) {
        transcriptionService.handleCallback(payload, token);
        return ResponseEntity.ok().build();
    }

    // -----------------------------------------------------------------------
    // Layer 3 — Assessment generation
    // -----------------------------------------------------------------------

    /**
     * Generate an assessment (title + MCQ questions in detected source language)
     * from a recording's transcript, store as an ai_generated_artifact, and
     * return preview content to the UI. Caller is the Create Assessment modal.
     *
     * scheduleId is in the path for symmetry with the transcribe endpoint
     * (and so we can pass it to the service if/when batch resolution needs it),
     * but the actual orchestration keys off recordingId.
     */
    @PostMapping("/schedule/{scheduleId}/recording/{recordingId}/create-assessment")
    public ResponseEntity<AssessmentArtifactDto> createAssessment(
            @PathVariable String scheduleId,
            @PathVariable String recordingId,
            @RequestBody CreateAssessmentFromRecordingDto body,
            @RequestAttribute("user") CustomUserDetails user) {
        AssessmentArtifactDto dto = assessmentService.createFromRecording(recordingId, body, user);
        return ResponseEntity.ok(dto);
    }

    /** List previously-generated assessments for this recording (newest first). */
    @GetMapping("/schedule/{scheduleId}/recording/{recordingId}/assessments")
    public ResponseEntity<List<AssessmentArtifactDto>> listAssessments(
            @PathVariable String scheduleId,
            @PathVariable String recordingId) {
        return ResponseEntity.ok(assessmentService.listForRecording(recordingId));
    }

    /**
     * Publish a previously-generated assessment artifact to assessment_service
     * so it becomes a real, batch-registered assessment learners can take.
     * Optional body lets the teacher override the title at publish time.
     */
    @PostMapping("/recording/{recordingId}/assessment/{artifactId}/publish")
    public ResponseEntity<AssessmentArtifactDto> publishAssessment(
            @PathVariable String recordingId,
            @PathVariable String artifactId,
            @RequestBody(required = false) vacademy.io.admin_core_service.features.ai_content.dto.PublishAssessmentOverridesDto body,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(
                assessmentService.publishArtifact(recordingId, artifactId, body, user));
    }
}
