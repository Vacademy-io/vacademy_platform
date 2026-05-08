package vacademy.io.admin_core_service.features.live_session.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.features.live_session.dto.BulkLiveSessionRequestDTO;
import vacademy.io.admin_core_service.features.live_session.dto.BulkLiveSessionResponseDTO;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionStep1RequestDTO;
import vacademy.io.admin_core_service.features.live_session.dto.LiveSessionStep2RequestDTO;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.util.ArrayList;
import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class BulkLiveSessionService {

    private final Step1Service step1Service;
    private final Step2Service step2Service;
    private final LiveSessionWorkflowAsyncHelper workflowAsyncHelper;

    public BulkLiveSessionResponseDTO createBulk(BulkLiveSessionRequestDTO request,
                                                 CustomUserDetails user) {
        if (request == null || request.getSessions() == null || request.getSessions().isEmpty()) {
            throw new VacademyException("At least one session is required for bulk creation.");
        }

        List<LiveSessionStep1RequestDTO> sessions = request.getSessions();
        LiveSessionStep2RequestDTO step2Template = request.getStep2Template();
        List<LiveSessionStep2RequestDTO> step2PerRow = request.getStep2PerRow();
        log.info(
                "Bulk create requested: sessions={}, step2_per_row={}, step2_template={}",
                sessions.size(),
                step2PerRow == null ? "null" : "size=" + step2PerRow.size(),
                step2Template == null ? "null" : "present");
        if (step2PerRow != null && step2PerRow.size() != sessions.size()) {
            throw new VacademyException(
                    "step2_per_row length (" + step2PerRow.size() +
                            ") must match sessions length (" + sessions.size() + ")");
        }

        List<BulkLiveSessionResponseDTO.RowResult> results = new ArrayList<>(sessions.size());
        // Collect (savedSession, instituteId) pairs and fire the workflow
        // asynchronously *after* we've finished writing every row. This is the
        // single biggest perf improvement — each LIVE_SESSION_CREATE workflow
        // can take 0.5-2s (attendance HTML generation + cross-region notification
        // service POST), so doing N of them inside the request thread blew up
        // the bulk endpoint's latency.
        List<LiveSession> sessionsToFireWorkflow = new ArrayList<>(sessions.size());
        List<String> instituteIdsForWorkflow = new ArrayList<>(sessions.size());
        int created = 0;
        int failed = 0;

        // Per-row try/catch on purpose — partial failures must not roll back rows
        // that already succeeded; the caller surfaces failures back to the user.
        for (int i = 0; i < sessions.size(); i++) {
            LiveSessionStep1RequestDTO row = sessions.get(i);
            String title = row != null ? row.getTitle() : null;

            try {
                // Skip the synchronous workflow trigger — we'll fire it async
                // for every successfully-created session below.
                LiveSession saved = step1Service.step1AddService(row, user, false);
                String sessionId = saved.getId();

                // Resolve which step-2 payload (if any) to apply to this row:
                // per-row entry > shared template > nothing.
                LiveSessionStep2RequestDTO step2ForRow = null;
                if (step2PerRow != null) {
                    LiveSessionStep2RequestDTO perRowEntry = step2PerRow.get(i);
                    if (perRowEntry != null) {
                        step2ForRow = cloneTemplateForSession(perRowEntry, sessionId);
                    }
                } else if (step2Template != null) {
                    step2ForRow = cloneTemplateForSession(step2Template, sessionId);
                }

                boolean step2Applied = false;
                if (step2ForRow != null) {
                    try {
                        step2Service.step2AddService(step2ForRow, user);
                        step2Applied = true;
                        log.info("Bulk row {} step2 applied for sessionId={}", i, sessionId);
                    } catch (Exception step2Ex) {
                        log.warn(
                                "Bulk row {} step2 FAILED for sessionId={}: {}",
                                i, sessionId, step2Ex.getMessage(), step2Ex);
                    }
                } else {
                    log.info(
                            "Bulk row {} step2 SKIPPED (no per-row payload and no template) for sessionId={}",
                            i, sessionId);
                }

                sessionsToFireWorkflow.add(saved);
                instituteIdsForWorkflow.add(row.getInstituteId());
                results.add(BulkLiveSessionResponseDTO.RowResult.builder()
                        .index(i)
                        .success(true)
                        .sessionId(sessionId)
                        .title(title)
                        .step2Applied(step2Applied)
                        .build());
                created++;
            } catch (Exception ex) {
                log.error("Bulk live session creation failed at row {}: {}", i, ex.getMessage(), ex);
                results.add(BulkLiveSessionResponseDTO.RowResult.builder()
                        .index(i)
                        .success(false)
                        .title(title)
                        .error(ex.getMessage())
                        .build());
                failed++;
            }
        }

        // Fire LIVE_SESSION_CREATE workflows asynchronously. Each call hands
        // off to Spring's @Async pool and returns immediately, so the request
        // thread can wrap up and respond. Workflows still run — admin-side
        // workflow integrations (e.g. emails to enrolled learners) keep
        // working — they just no longer block the API response.
        for (int i = 0; i < sessionsToFireWorkflow.size(); i++) {
            workflowAsyncHelper.fireLiveSessionCreateWorkflow(
                    sessionsToFireWorkflow.get(i),
                    user.getUserId(),
                    instituteIdsForWorkflow.get(i));
        }

        return BulkLiveSessionResponseDTO.builder()
                .totalRequested(sessions.size())
                .totalCreated(created)
                .totalFailed(failed)
                .results(results)
                .build();
    }

    /**
     * Returns a copy of the shared step-2 payload with its session_id replaced
     * by the freshly created session id. The template object itself is not
     * mutated so it can be safely reused across rows.
     */
    @SuppressWarnings("deprecation")
    private LiveSessionStep2RequestDTO cloneTemplateForSession(LiveSessionStep2RequestDTO template,
                                                               String sessionId) {
        LiveSessionStep2RequestDTO copy = new LiveSessionStep2RequestDTO();
        copy.setSessionId(sessionId);
        copy.setAccessType(template.getAccessType());
        copy.setPackageSessionIds(template.getPackageSessionIds());
        copy.setDeletedPackageSessionIds(template.getDeletedPackageSessionIds());
        copy.setIndividualUserIds(template.getIndividualUserIds());
        copy.setDeletedIndividualUserIds(template.getDeletedIndividualUserIds());
        // The frontend may send `{{SESSION_ID}}` as a placeholder in the join
        // link (PUBLIC sessions need the real id, which only exists after
        // step 1 saves). Substitute here so the persisted link is valid.
        String join = template.getJoinLink();
        if (join != null && join.contains("{{SESSION_ID}}")) {
            join = join.replace("{{SESSION_ID}}", sessionId);
        }
        copy.setJoinLink(join);
        copy.setAddedNotificationActions(template.getAddedNotificationActions());
        copy.setUpdatedNotificationActions(template.getUpdatedNotificationActions());
        copy.setDeletedNotificationActionIds(template.getDeletedNotificationActionIds());
        copy.setAddedFields(template.getAddedFields());
        copy.setUpdatedFields(template.getUpdatedFields());
        copy.setDeletedFieldIds(template.getDeletedFieldIds());
        copy.setInstituteCustomFields(template.getInstituteCustomFields());
        return copy;
    }
}
