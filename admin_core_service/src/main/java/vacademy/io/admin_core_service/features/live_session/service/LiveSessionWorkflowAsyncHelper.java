package vacademy.io.admin_core_service.features.live_session.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.live_session.entity.LiveSession;
import vacademy.io.admin_core_service.features.workflow.enums.WorkflowTriggerEvent;
import vacademy.io.admin_core_service.features.workflow.service.WorkflowTriggerService;

import java.util.HashMap;
import java.util.Map;

/**
 * Fires the {@code LIVE_SESSION_CREATE} workflow trigger off the request
 * thread. Used by the bulk endpoint so creating N sessions doesn't pay the
 * cost of N synchronous workflow runs (each one fetches attendance reports,
 * renders HTML, and POSTs to the notification service).
 *
 * <p>Single-class flow continues to fire the workflow synchronously inside
 * {@link Step1Service#step1AddService}; only the bulk path opts out and uses
 * this helper.
 */
@Component
@Slf4j
@RequiredArgsConstructor
public class LiveSessionWorkflowAsyncHelper {

    private final WorkflowTriggerService workflowTriggerService;

    /**
     * Fire-and-forget workflow trigger. Errors are logged and swallowed —
     * never propagated back to the request thread.
     */
    @Async
    public void fireLiveSessionCreateWorkflow(LiveSession session,
                                              String createdBy,
                                              String instituteId) {
        if (session == null || instituteId == null) return;
        try {
            Map<String, Object> contextData = new HashMap<>();
            contextData.put("liveSession", session);
            contextData.put("createdBy", createdBy);
            workflowTriggerService.handleTriggerEvents(
                    WorkflowTriggerEvent.LIVE_SESSION_CREATE.name(),
                    session.getId(),
                    instituteId,
                    contextData);
        } catch (Exception e) {
            log.warn("Async LIVE_SESSION_CREATE workflow failed for sessionId={}: {}",
                    session.getId(), e.getMessage(), e);
        }
    }

    /**
     * Fires {@code LIVE_SESSION_FORM_SUBMISSION} after a guest submits a session's
     * public registration form. Scoped by session id, so a trigger can be configured
     * for one webinar without firing for every public session in the institute.
     *
     * <p>Async because the caller is an unauthenticated public form POST: the guest
     * should not wait on a WhatsApp/email round-trip, and a notification failure must
     * never fail a registration that is already committed. Pinned to the bounded
     * {@code workflowTaskExecutor} (not the default unbounded SimpleAsyncTaskExecutor)
     * so a burst of registrations for a popular webinar cannot spawn unbounded threads.
     */
    @Async("workflowTaskExecutor")
    public void fireLiveSessionFormSubmissionWorkflow(String sessionId,
                                                      String instituteId,
                                                      Map<String, Object> contextData) {
        if (sessionId == null || instituteId == null) return;
        try {
            workflowTriggerService.handleTriggerEvents(
                    WorkflowTriggerEvent.LIVE_SESSION_FORM_SUBMISSION.name(),
                    sessionId,
                    instituteId,
                    contextData);
        } catch (Exception e) {
            log.warn("Async LIVE_SESSION_FORM_SUBMISSION workflow failed for sessionId={}: {}",
                    sessionId, e.getMessage(), e);
        }
    }
}
