package vacademy.io.admin_core_service.features.telephony.controller;

import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.telephony.queue.AiCallQueueService;
import vacademy.io.admin_core_service.features.telephony.queue.AiCallQueueSnapshotService;
import vacademy.io.admin_core_service.features.telephony.queue.AiVoiceBoxService;
import vacademy.io.admin_core_service.features.telephony.queue.dto.AiCallQueueDTOs.BoxUpsertRequest;
import vacademy.io.admin_core_service.features.telephony.queue.dto.AiCallQueueDTOs.BoxView;
import vacademy.io.admin_core_service.features.telephony.queue.dto.AiCallQueueDTOs.CapacityView;
import vacademy.io.admin_core_service.features.telephony.queue.dto.AiCallQueueDTOs.LaneUpsertRequest;
import vacademy.io.admin_core_service.features.telephony.queue.dto.AiCallQueueDTOs.LaneView;
import vacademy.io.admin_core_service.features.telephony.queue.dto.AiCallQueueDTOs.QueueItemView;
import vacademy.io.admin_core_service.features.telephony.queue.dto.AiCallQueueDTOs.QueueSnapshot;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.auth.util.SuperAdminAuthUtil;

import java.util.List;
import java.util.Map;

/**
 * Fleet-wide AI call capacity: how many simultaneous calls exist, which boxes provide
 * them, and how much of the fleet any one institute may hold.
 *
 * <p>Super-admin only, and deliberately so — these are cross-tenant numbers. Raising an
 * institute's lane cap takes slots from every other institute, and changing the fleet
 * capacity changes how hard we drive hardware that leads are talking to.
 *
 * <pre>
 *   GET    /admin-core-service/super-admin/v1/ai-queue/overview      (dashboard: fleet + lanes)
 *   GET    /admin-core-service/super-admin/v1/ai-queue/items         (dashboard: the calls themselves)
 *   GET    /admin-core-service/super-admin/v1/ai-queue/capacity
 *   PUT    /admin-core-service/super-admin/v1/ai-queue/settings/{key}   {"value":"4"}
 *   GET    /admin-core-service/super-admin/v1/ai-queue/boxes
 *   POST   /admin-core-service/super-admin/v1/ai-queue/boxes            (create)
 *   PUT    /admin-core-service/super-admin/v1/ai-queue/boxes/{id}       (update)
 *   DELETE /admin-core-service/super-admin/v1/ai-queue/boxes/{id}
 *   GET    /admin-core-service/super-admin/v1/ai-queue/lanes
 *   GET|PUT /admin-core-service/super-admin/v1/ai-queue/lanes/{instituteId}
 * </pre>
 */
@RestController
@RequestMapping("/admin-core-service/super-admin/v1/ai-queue")
@RequiredArgsConstructor
public class AiCallQueueAdminController {

    private final AiVoiceBoxService boxService;
    private final AiCallQueueService queueService;
    private final AiCallQueueSnapshotService snapshotService;

    /**
     * Everything the internal dashboard's landing view needs, in ONE request: fleet
     * capacity, each voice box and its health, and a row per institute with a queue —
     * institute name, depth, calls in flight, its share of the fleet, how long it has
     * been waiting and when it will clear.
     *
     * <p>One endpoint, and one capacity snapshot behind it, so a screen polling every few
     * seconds cannot show a capacity read from one instant next to lanes computed at
     * another — which is exactly how "the numbers do not add up" bug reports start.
     *
     * <p>Pass {@code limit} to include the head of the queue too; the default of 0 keeps
     * this light and leaves paging to {@code /items}.
     */
    @GetMapping("/overview")
    public ResponseEntity<QueueSnapshot> overview(
            @RequestParam(value = "limit", defaultValue = "0") int limit,
            @RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        // Same assembler the health dashboard's feed uses, so the two views can never
        // drift into disagreeing about the same fleet. limit=0 keeps the landing view
        // light; the item list is paged separately by /items.
        return ResponseEntity.ok(snapshotService.snapshot(Math.max(0, limit), null));
    }

    /**
     * The queued calls themselves, across every institute, each row carrying the
     * institute name and the AI agent name rather than raw ids.
     *
     * <p>Defaults to what is WAITING, in the order it will actually dial. Pass
     * {@code status=ALL} (or a specific status like DIALED / FAILED / EXPIRED) to look at
     * history instead, which comes back newest-first.
     *
     * @param instituteId narrow to one institute
     * @param status      a lifecycle state, or ALL. Default: QUEUED
     * @param provider    VACADEMY_AI | AAVTAAR | MOCK
     * @param source      WORKFLOW | BULK | MANUAL
     */
    @GetMapping("/items")
    public ResponseEntity<Page<QueueItemView>> items(
            @RequestParam(value = "instituteId", required = false) String instituteId,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "provider", required = false) String provider,
            @RequestParam(value = "source", required = false) String source,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "50") int size,
            @RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(
                queueService.search(instituteId, status, provider, source, page, size));
    }

    /** Fleet capacity, live occupancy, queue depth, and every box behind the number. */
    @GetMapping("/capacity")
    public ResponseEntity<CapacityView> capacity(@RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(boxService.capacity());
    }

    @Data
    public static class SettingBody {
        private String value;
    }

    /**
     * Change one runtime knob. The writable keys are an allow-list on the service —
     * {@code app_config} is shared with other features and this endpoint must not be a
     * general-purpose editor for it.
     */
    @PutMapping("/settings/{key}")
    public ResponseEntity<CapacityView> updateSetting(
            @PathVariable String key,
            @RequestBody SettingBody body,
            @RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(boxService.updateSetting(key, body == null ? null : body.getValue()));
    }

    @GetMapping("/boxes")
    public ResponseEntity<List<BoxView>> boxes(@RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(boxService.listBoxes());
    }

    @PostMapping("/boxes")
    public ResponseEntity<BoxView> createBox(
            @RequestBody BoxUpsertRequest body,
            @RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(boxService.upsertBox(null, body));
    }

    @PutMapping("/boxes/{id}")
    public ResponseEntity<BoxView> updateBox(
            @PathVariable String id,
            @RequestBody BoxUpsertRequest body,
            @RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(boxService.upsertBox(id, body));
    }

    @DeleteMapping("/boxes/{id}")
    public ResponseEntity<Map<String, Object>> deleteBox(
            @PathVariable String id,
            @RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        boxService.deleteBox(id);
        return ResponseEntity.ok(Map.of("deleted", true));
    }

    /** Every institute that has an override or currently has work waiting. */
    @GetMapping("/lanes")
    public ResponseEntity<List<LaneView>> lanes(@RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(queueService.allLanes());
    }

    @GetMapping("/lanes/{instituteId}")
    public ResponseEntity<LaneView> lane(
            @PathVariable String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(queueService.laneView(instituteId));
    }

    /**
     * Set or clear an institute's overrides. A null {@code maxConcurrent} clears the
     * override and returns the institute to the dynamic default rather than leaving the
     * previous number in place.
     */
    @PutMapping("/lanes/{instituteId}")
    public ResponseEntity<LaneView> upsertLane(
            @PathVariable String instituteId,
            @RequestBody(required = false) LaneUpsertRequest body,
            @RequestAttribute("user") CustomUserDetails user) {
        SuperAdminAuthUtil.requireSuperAdmin(user);
        return ResponseEntity.ok(queueService.upsertLane(instituteId, body));
    }
}
