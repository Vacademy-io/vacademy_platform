package vacademy.io.admin_core_service.features.telephony.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;
import vacademy.io.admin_core_service.features.telephony.core.CallEventBus;
import vacademy.io.admin_core_service.features.telephony.persistence.entity.TelephonyCallLog;
import vacademy.io.admin_core_service.features.telephony.persistence.repository.TelephonyCallLogRepository;
import vacademy.io.common.auth.model.CustomUserDetails;

import static org.springframework.http.HttpStatus.FORBIDDEN;
import static org.springframework.http.HttpStatus.NOT_FOUND;

/**
 * Live status stream for one call. The frontend opens an EventSource here on
 * a successful /connect — every webhook event for that call is pushed down
 * so the counsellor's toast updates without polling.
 *
 * NOTE: registered as a public path in ApplicationSecurityConfig because the
 * browser EventSource API can't send the Authorization header. Identity is
 * verified by the callLogId itself (UUID, unguessable) + an in-band check
 * against the counsellor's userId on connect.
 */
@RestController
@RequestMapping("/admin-core-service/v1/telephony/calls")
public class SseCallEventController {

    @Autowired
    private CallEventBus eventBus;

    @Autowired
    private TelephonyCallLogRepository callLogRepo;

    @GetMapping(path = "/{callLogId}/events", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream(@PathVariable("callLogId") String callLogId,
                             @RequestAttribute(value = "user", required = false) CustomUserDetails user) {
        TelephonyCallLog row = callLogRepo.findById(callLogId)
                .orElseThrow(() -> new ResponseStatusException(NOT_FOUND));
        // If JWT made it through (path may or may not be public), enforce ownership.
        // If no user attribute is present, treat the UUID as the capability token —
        // browsers can subscribe but only when they already have the id from /connect.
        // counsellor_user_id is nullable for inbound rows (V320) — null-safe compare.
        if (user != null
                && row.getCounsellorUserId() != null
                && !row.getCounsellorUserId().equals(user.getUserId())) {
            throw new ResponseStatusException(FORBIDDEN);
        }
        return eventBus.subscribe(callLogId);
    }
}
