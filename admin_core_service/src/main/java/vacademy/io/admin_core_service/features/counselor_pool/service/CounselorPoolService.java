package vacademy.io.admin_core_service.features.counselor_pool.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.counselor_pool.dto.*;
import vacademy.io.admin_core_service.features.counselor_pool.entity.*;
import vacademy.io.admin_core_service.features.counselor_pool.enums.AssignmentMode;
import vacademy.io.admin_core_service.features.counselor_pool.enums.PoolStatus;
import vacademy.io.admin_core_service.features.counselor_pool.enums.SchedulePattern;
import vacademy.io.admin_core_service.features.counselor_pool.repository.*;
import vacademy.io.common.exceptions.VacademyException;

import java.util.*;
import java.util.stream.Collectors;

/**
 * CRUD operations for counselor pools — pool itself, its audiences, and its members.
 * Shift management lives in CounselorPoolShiftService.
 * Assignment-time logic (round-robin / time-based) lives in CounselorAssignmentService.
 */
@Service
@RequiredArgsConstructor
public class CounselorPoolService {

    private final CounselorPoolRepository poolRepository;
    private final CounselorPoolAudienceRepository poolAudienceRepository;
    private final CounselorPoolMemberRepository poolMemberRepository;
    private final CounselorPoolShiftRepository poolShiftRepository;
    private final CounselorPoolShiftMemberRepository poolShiftMemberRepository;

    // ────────────────────────────────────────────────────────────────
    // Pool CRUD
    // ────────────────────────────────────────────────────────────────

    @Transactional
    public CounselorPoolDTO createPool(CreatePoolRequest request, String createdByUserId) {
        validateAssignmentMode(request.getAssignmentMode());
        requireNonBlank(request.getInstituteId(), "institute_id is required");
        requireNonBlank(request.getName(), "name is required");

        if (poolRepository.existsByInstituteIdAndNameIgnoreCase(request.getInstituteId(), request.getName())) {
            throw new VacademyException("A pool with this name already exists in the institute");
        }

        String schedulePattern = resolveSchedulePattern(request.getSchedulePattern());

        CounselorPool pool = CounselorPool.builder()
                .instituteId(request.getInstituteId())
                .name(request.getName())
                .description(request.getDescription())
                .assignmentMode(request.getAssignmentMode())
                .schedulePattern(schedulePattern)
                .createdBy(createdByUserId)
                .build();
        pool = poolRepository.save(pool);

        // Link audiences (if provided). Block if any is already in another pool.
        List<String> audienceIds = request.getAudienceIds() == null ? List.of() : request.getAudienceIds();
        for (String audienceId : audienceIds) {
            attachAudienceInternal(pool.getId(), audienceId);
        }

        // Add members (if provided). Order in the list seeds display_order.
        List<String> counselorIds = request.getCounselorUserIds() == null ? List.of() : request.getCounselorUserIds();
        for (int i = 0; i < counselorIds.size(); i++) {
            String counselorId = counselorIds.get(i);
            int displayOrder = i + 1;
            for (String audienceId : audienceIds) {
                createMemberRow(pool.getId(), audienceId, counselorId, displayOrder, createdByUserId);
            }
        }

        return getPool(pool.getId());
    }

    @Transactional
    public CounselorPoolDTO updatePool(String poolId, UpdatePoolRequest request) {
        CounselorPool pool = poolRepository.findById(poolId)
                .orElseThrow(() -> new VacademyException("Pool not found: " + poolId));

        if (request.getName() != null) {
            pool.setName(request.getName());
        }
        if (request.getDescription() != null) {
            pool.setDescription(request.getDescription());
        }
        if (request.getAssignmentMode() != null) {
            validateAssignmentMode(request.getAssignmentMode());
            pool.setAssignmentMode(request.getAssignmentMode());
        }
        if (request.getSchedulePattern() != null) {
            String newPattern = resolveSchedulePattern(request.getSchedulePattern());
            // Switching pattern with shifts already configured would silently break the
            // editor's "trust the column" load path. Force admin to clear the schedule first.
            if (!newPattern.equals(pool.getSchedulePattern())
                    && poolShiftRepository.findByPoolIdOrderByDayOfWeekAscStartTimeAsc(poolId).size() > 0) {
                throw new VacademyException("Cannot change schedule_pattern while shifts exist. Clear the schedule first.");
            }
            pool.setSchedulePattern(newPattern);
        }
        poolRepository.save(pool);

        return getPool(poolId);
    }

    @Transactional
    public void deletePool(String poolId) {
        if (!poolRepository.existsById(poolId)) {
            throw new VacademyException("Pool not found: " + poolId);
        }
        if (poolAudienceRepository.existsByPoolId(poolId)) {
            throw new VacademyException("Pool has audiences linked. Remove all audiences before deleting the pool.");
        }
        // Empty pool: cascade clean up members + shifts + shift members in app layer.
        List<CounselorPoolShift> shifts = poolShiftRepository.findByPoolIdOrderByDayOfWeekAscStartTimeAsc(poolId);
        if (!shifts.isEmpty()) {
            List<String> shiftIds = shifts.stream().map(CounselorPoolShift::getId).toList();
            poolShiftMemberRepository.deleteByShiftIdIn(shiftIds);
            poolShiftRepository.deleteByPoolId(poolId);
        }
        poolMemberRepository.deleteByPoolId(poolId);
        poolRepository.deleteById(poolId);
    }

    @Transactional(readOnly = true)
    public CounselorPoolDTO getPool(String poolId) {
        CounselorPool pool = poolRepository.findById(poolId)
                .orElseThrow(() -> new VacademyException("Pool not found: " + poolId));

        List<PoolAudienceDTO> audiences = poolAudienceRepository.findByPoolId(poolId).stream()
                .map(CounselorPoolService::toAudienceDTO).toList();

        List<PoolMemberDTO> members = poolMemberRepository.findByPoolId(poolId).stream()
                .map(CounselorPoolService::toMemberDTO).toList();

        List<CounselorPoolShift> shifts = poolShiftRepository.findByPoolIdOrderByDayOfWeekAscStartTimeAsc(poolId);
        List<String> shiftIds = shifts.stream().map(CounselorPoolShift::getId).toList();
        Map<String, List<PoolShiftMemberDTO>> shiftMembersByShiftId = shiftIds.isEmpty() ? Map.of() :
                poolShiftMemberRepository.findByShiftIdIn(shiftIds).stream()
                        .map(CounselorPoolService::toShiftMemberDTO)
                        .collect(Collectors.groupingBy(PoolShiftMemberDTO::getShiftId));

        List<PoolShiftDTO> shiftDTOs = shifts.stream().map(s -> {
            PoolShiftDTO dto = toShiftDTO(s);
            dto.setMembers(shiftMembersByShiftId.getOrDefault(s.getId(), List.of()));
            return dto;
        }).toList();

        return toPoolDTO(pool, audiences, members, shiftDTOs);
    }

    @Transactional(readOnly = true)
    public List<CounselorPoolDTO> listPools(String instituteId) {
        // The list view shows "N campaigns · M counselors" per card, so we need at least the
        // child rows hydrated. Shifts are skipped here (only used inside the detail view).
        // For institute-sized data (handful of pools, dozens of members), this is cheap.
        List<CounselorPool> pools = poolRepository.findByInstituteIdOrderByCreatedAtDesc(instituteId);
        return pools.stream()
                .map(p -> {
                    List<PoolAudienceDTO> audiences = poolAudienceRepository.findByPoolId(p.getId())
                            .stream().map(CounselorPoolService::toAudienceDTO).toList();
                    List<PoolMemberDTO> members = poolMemberRepository.findByPoolId(p.getId())
                            .stream().map(CounselorPoolService::toMemberDTO).toList();
                    return toPoolDTO(p, audiences, members, null);
                })
                .toList();
    }

    // ────────────────────────────────────────────────────────────────
    // Audience membership
    // ────────────────────────────────────────────────────────────────

    @Transactional
    public void addAudienceToPool(String poolId, String audienceId, String addedByUserId) {
        ensurePoolExists(poolId);
        attachAudienceInternal(poolId, audienceId);

        // Seed member rows for the new audience using existing pool members.
        // Display order matches the member's position when listed by added_at.
        List<CounselorPoolMember> existingRows = poolMemberRepository.findByPoolId(poolId);
        // Distinct counselors in this pool (order: first appearance in existing rows)
        LinkedHashMap<String, Integer> counselorToOrder = new LinkedHashMap<>();
        for (CounselorPoolMember row : existingRows) {
            counselorToOrder.putIfAbsent(row.getCounselorUserId(), counselorToOrder.size() + 1);
        }
        for (Map.Entry<String, Integer> entry : counselorToOrder.entrySet()) {
            createMemberRow(poolId, audienceId, entry.getKey(), entry.getValue(), addedByUserId);
        }
    }

    @Transactional
    public void removeAudienceFromPool(String poolId, String audienceId) {
        CounselorPoolAudience link = poolAudienceRepository.findByAudienceId(audienceId)
                .orElseThrow(() -> new VacademyException("Audience not linked to any pool"));
        if (!link.getPoolId().equals(poolId)) {
            throw new VacademyException("Audience does not belong to the specified pool");
        }
        // Delete member rows for this (pool, audience). No bulk method on repo — manual.
        List<CounselorPoolMember> rowsToDelete = poolMemberRepository
                .findByPoolIdAndAudienceIdOrderByDisplayOrderAsc(poolId, audienceId);
        poolMemberRepository.deleteAll(rowsToDelete);
        poolAudienceRepository.delete(link);
    }

    // ────────────────────────────────────────────────────────────────
    // Counselor membership
    // ────────────────────────────────────────────────────────────────

    @Transactional
    public void addCounselorToPool(String poolId, String counselorUserId, String addedByUserId) {
        ensurePoolExists(poolId);

        List<CounselorPoolAudience> audiences = poolAudienceRepository.findByPoolId(poolId);
        if (audiences.isEmpty()) {
            // Pool has no audiences yet. Track an intent? For now, no-op with informational throw.
            throw new VacademyException("Add at least one audience to the pool before adding counselors.");
        }

        // For each audience, append this counselor at the bottom of the rotation.
        for (CounselorPoolAudience pa : audiences) {
            String audienceId = pa.getAudienceId();
            if (poolMemberRepository.existsByPoolIdAndAudienceIdAndCounselorUserId(poolId, audienceId, counselorUserId)) {
                continue; // Idempotent for this (audience, counselor)
            }
            int nextOrder = poolMemberRepository
                    .findByPoolIdAndAudienceIdOrderByDisplayOrderAsc(poolId, audienceId)
                    .stream()
                    .mapToInt(CounselorPoolMember::getDisplayOrder)
                    .max()
                    .orElse(0) + 1;
            createMemberRow(poolId, audienceId, counselorUserId, nextOrder, addedByUserId);
        }
    }

    @Transactional
    public void removeCounselorFromPool(String poolId, String counselorUserId) {
        List<CounselorPoolMember> rows = poolMemberRepository.findByPoolIdAndCounselorUserId(poolId, counselorUserId);
        if (rows.isEmpty()) {
            throw new VacademyException("Counselor not in pool");
        }
        poolMemberRepository.deleteAll(rows);
    }

    /**
     * Replace the display_order of counselors for a single (pool, audience) pair.
     * Accepts the desired counselor_user_ids in the order they should rotate.
     * Validates: every id must be an existing member of (pool, audience); the input
     * list must cover EVERY current member (no missing, no extras).
     */
    @Transactional
    public void updateAudienceMemberOrder(String poolId, String audienceId,
                                          List<String> orderedCounselorUserIds) {
        if (orderedCounselorUserIds == null || orderedCounselorUserIds.isEmpty()) {
            throw new VacademyException("counselor_user_ids must be a non-empty ordered list");
        }
        List<CounselorPoolMember> existing = poolMemberRepository
                .findByPoolIdAndAudienceIdOrderByDisplayOrderAsc(poolId, audienceId);
        if (existing.isEmpty()) {
            throw new VacademyException("No members configured for this audience in the pool");
        }
        Set<String> existingIds = existing.stream()
                .map(CounselorPoolMember::getCounselorUserId)
                .collect(Collectors.toSet());
        Set<String> requestedIds = new HashSet<>(orderedCounselorUserIds);
        if (requestedIds.size() != orderedCounselorUserIds.size()) {
            throw new VacademyException("Ordered list contains duplicate counselors");
        }
        if (!existingIds.equals(requestedIds)) {
            throw new VacademyException("Ordered list must cover exactly the existing members of this audience");
        }
        Map<String, CounselorPoolMember> rowsByCounselor = existing.stream()
                .collect(Collectors.toMap(CounselorPoolMember::getCounselorUserId, m -> m));
        for (int i = 0; i < orderedCounselorUserIds.size(); i++) {
            CounselorPoolMember row = rowsByCounselor.get(orderedCounselorUserIds.get(i));
            row.setDisplayOrder(i + 1);
            poolMemberRepository.save(row);
        }
    }

    @Transactional
    public void updateMemberStatus(String poolId, String counselorUserId, UpdateMemberStatusRequest request) {
        String status = request.getStatus();
        if (!PoolStatus.ACTIVE.name().equals(status) && !PoolStatus.INACTIVE.name().equals(status)) {
            throw new VacademyException("status must be ACTIVE or INACTIVE");
        }

        String backupId = request.getBackupCounselorUserId();
        if (PoolStatus.INACTIVE.name().equals(status)) {
            requireNonBlank(backupId, "backup_counselor_user_id is required when marking INACTIVE");
            if (counselorUserId.equals(backupId)) {
                throw new VacademyException("Backup must be a different counselor");
            }
            // No pool-membership check on the backup. Backups can be any institute
            // counsellor — even one who isn't in this pool — so admin can temporarily
            // route leads to someone outside the team while the primary is paused.
            // The frontend dropdown already filters out inactive pool members; here
            // we trust the id and rely on app-layer rules upstream.
        } else {
            backupId = null; // clear backup when going back to ACTIVE
        }

        int updated = poolMemberRepository.bulkUpdateStatusForCounselorInPool(poolId, counselorUserId, status, backupId);
        if (updated == 0) {
            throw new VacademyException("Counselor is not in this pool");
        }
    }

    // ────────────────────────────────────────────────────────────────
    // Internal helpers
    // ────────────────────────────────────────────────────────────────

    private void attachAudienceInternal(String poolId, String audienceId) {
        requireNonBlank(audienceId, "audience_id is required");
        if (poolAudienceRepository.existsByAudienceId(audienceId)) {
            throw new VacademyException("Audience is already linked to a pool. Remove it from the existing pool first.");
        }
        poolAudienceRepository.save(CounselorPoolAudience.builder()
                .poolId(poolId)
                .audienceId(audienceId)
                .build());
    }

    private void createMemberRow(String poolId, String audienceId, String counselorUserId,
                                 int displayOrder, String addedByUserId) {
        if (poolMemberRepository.existsByPoolIdAndAudienceIdAndCounselorUserId(poolId, audienceId, counselorUserId)) {
            return;
        }
        poolMemberRepository.save(CounselorPoolMember.builder()
                .poolId(poolId)
                .audienceId(audienceId)
                .counselorUserId(counselorUserId)
                .displayOrder(displayOrder)
                .status(PoolStatus.ACTIVE.name())
                .addedBy(addedByUserId)
                .build());
    }

    private void ensurePoolExists(String poolId) {
        if (!poolRepository.existsById(poolId)) {
            throw new VacademyException("Pool not found: " + poolId);
        }
    }

    private static void validateAssignmentMode(String mode) {
        try {
            AssignmentMode.valueOf(mode);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new VacademyException("assignment_mode must be one of MANUAL, ROUND_ROBIN, TIME_BASED");
        }
    }

    /**
     * Validates the schedule_pattern string. Returns null when input is null
     * or blank — the column is nullable so the UI can distinguish "not picked
     * yet" (NULL) from "explicitly picked X".
     */
    private static String resolveSchedulePattern(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return SchedulePattern.valueOf(raw).name();
        } catch (IllegalArgumentException e) {
            throw new VacademyException("schedule_pattern must be one of PER_DAY, SAME_HOURS_ALL_DAYS");
        }
    }

    private static void requireNonBlank(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new VacademyException(message);
        }
    }

    // ────────────────────────────────────────────────────────────────
    // Entity → DTO mappers
    // ────────────────────────────────────────────────────────────────

    private static CounselorPoolDTO toPoolDTO(CounselorPool p,
                                              List<PoolAudienceDTO> audiences,
                                              List<PoolMemberDTO> members,
                                              List<PoolShiftDTO> shifts) {
        return CounselorPoolDTO.builder()
                .id(p.getId())
                .instituteId(p.getInstituteId())
                .name(p.getName())
                .description(p.getDescription())
                .assignmentMode(p.getAssignmentMode())
                .schedulePattern(p.getSchedulePattern())
                .createdBy(p.getCreatedBy())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .audiences(audiences)
                .members(members)
                .shifts(shifts)
                .build();
    }

    private static PoolAudienceDTO toAudienceDTO(CounselorPoolAudience a) {
        return PoolAudienceDTO.builder()
                .id(a.getId())
                .poolId(a.getPoolId())
                .audienceId(a.getAudienceId())
                .lastAssignedCounselorId(a.getLastAssignedCounselorId())
                .lastAssignedAt(a.getLastAssignedAt())
                .addedAt(a.getAddedAt())
                .build();
    }

    private static PoolMemberDTO toMemberDTO(CounselorPoolMember m) {
        return PoolMemberDTO.builder()
                .id(m.getId())
                .poolId(m.getPoolId())
                .audienceId(m.getAudienceId())
                .counselorUserId(m.getCounselorUserId())
                .displayOrder(m.getDisplayOrder())
                .monthlyTarget(m.getMonthlyTarget())
                .status(m.getStatus())
                .backupCounselorUserId(m.getBackupCounselorUserId())
                .addedBy(m.getAddedBy())
                .addedAt(m.getAddedAt())
                .updatedAt(m.getUpdatedAt())
                .build();
    }

    static PoolShiftDTO toShiftDTO(CounselorPoolShift s) {
        return PoolShiftDTO.builder()
                .id(s.getId())
                .poolId(s.getPoolId())
                .dayOfWeek(s.getDayOfWeek())
                .startTime(s.getStartTime())
                .endTime(s.getEndTime())
                .label(s.getLabel())
                .status(s.getStatus())
                .createdAt(s.getCreatedAt())
                .updatedAt(s.getUpdatedAt())
                .build();
    }

    static PoolShiftMemberDTO toShiftMemberDTO(CounselorPoolShiftMember m) {
        return PoolShiftMemberDTO.builder()
                .id(m.getId())
                .shiftId(m.getShiftId())
                .counselorUserId(m.getCounselorUserId())
                .status(m.getStatus())
                .addedAt(m.getAddedAt())
                .build();
    }
}
