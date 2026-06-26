package vacademy.io.admin_core_service.features.counselor_pool.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.counselor_pool.dto.PoolShiftDTO;
import vacademy.io.admin_core_service.features.counselor_pool.dto.PoolShiftMemberDTO;
import vacademy.io.admin_core_service.features.counselor_pool.dto.WeeklyScheduleRequest;
import vacademy.io.admin_core_service.features.counselor_pool.entity.CounselorPool;
import vacademy.io.admin_core_service.features.counselor_pool.entity.CounselorPoolShift;
import vacademy.io.admin_core_service.features.counselor_pool.entity.CounselorPoolShiftMember;
import vacademy.io.admin_core_service.features.counselor_pool.enums.AssignmentMode;
import vacademy.io.admin_core_service.features.counselor_pool.enums.PoolStatus;
import vacademy.io.admin_core_service.features.counselor_pool.enums.ShiftDayOfWeek;
import vacademy.io.admin_core_service.features.counselor_pool.repository.CounselorPoolRepository;
import vacademy.io.admin_core_service.features.counselor_pool.repository.CounselorPoolShiftMemberRepository;
import vacademy.io.admin_core_service.features.counselor_pool.repository.CounselorPoolShiftRepository;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Time;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Shift schedule management for a pool. Relevant for TIME_BASED pools and for
 * ROUND_ROBIN pools that opted into shift-gating (shift_aware).
 *
 * The admin replaces the full weekly schedule at once via setWeeklySchedule.
 * TIME_BASED enforces 24/7 coverage across all 7 days before any write;
 * shift-aware ROUND_ROBIN allows gaps (outside a window, leads stay
 * unassigned) and validates only the individual blocks.
 */
@Service
@RequiredArgsConstructor
public class CounselorPoolShiftService {

    private static final Time START_OF_DAY = Time.valueOf("00:00:00");
    private static final Time END_OF_DAY = Time.valueOf("23:59:59");

    private final CounselorPoolRepository poolRepository;
    private final CounselorPoolShiftRepository shiftRepository;
    private final CounselorPoolShiftMemberRepository shiftMemberRepository;

    /**
     * Replace the entire weekly schedule for a pool. Validates 24/7 coverage
     * across all 7 days before writing. On success, all existing shifts +
     * shift members for the pool are deleted and replaced atomically.
     */
    @Transactional
    public List<PoolShiftDTO> setWeeklySchedule(String poolId, WeeklyScheduleRequest request) {
        CounselorPool pool = poolRepository.findById(poolId)
                .orElseThrow(() -> new VacademyException("Pool not found: " + poolId));
        if (request == null || request.getShifts() == null || request.getShifts().isEmpty()) {
            throw new VacademyException("Schedule must include at least one shift");
        }

        // TIME_BASED requires full 24/7 coverage (someone is always on shift). A
        // shift-aware ROUND_ROBIN pool intentionally leaves gaps — outside its
        // windows leads are left unassigned — so only the blocks are validated.
        boolean requireFullCoverage = AssignmentMode.TIME_BASED.name().equals(pool.getAssignmentMode());
        validateSchedule(request.getShifts(), requireFullCoverage);

        // Replace: delete all existing shifts (and their members), then insert new.
        List<CounselorPoolShift> existing = shiftRepository.findByPoolIdOrderByDayOfWeekAscStartTimeAsc(poolId);
        if (!existing.isEmpty()) {
            List<String> existingShiftIds = existing.stream().map(CounselorPoolShift::getId).toList();
            shiftMemberRepository.deleteByShiftIdIn(existingShiftIds);
            shiftRepository.deleteByPoolId(poolId);
        }

        List<CounselorPoolShift> savedShifts = new ArrayList<>();
        for (WeeklyScheduleRequest.ShiftBlock block : request.getShifts()) {
            CounselorPoolShift shift = CounselorPoolShift.builder()
                    .poolId(poolId)
                    .dayOfWeek(block.getDayOfWeek())
                    .startTime(block.getStartTime())
                    .endTime(block.getEndTime())
                    .label(block.getLabel())
                    .status(PoolStatus.ACTIVE.name())
                    .build();
            shift = shiftRepository.save(shift);
            savedShifts.add(shift);

            List<String> counselorIds = block.getCounselorUserIds();
            if (counselorIds == null || counselorIds.isEmpty()) {
                throw new VacademyException("Each shift must have at least one counselor assigned");
            }
            for (String counselorId : counselorIds) {
                shiftMemberRepository.save(CounselorPoolShiftMember.builder()
                        .shiftId(shift.getId())
                        .counselorUserId(counselorId)
                        .status(PoolStatus.ACTIVE.name())
                        .build());
            }
        }

        return getWeeklySchedule(poolId);
    }

    @Transactional(readOnly = true)
    public List<PoolShiftDTO> getWeeklySchedule(String poolId) {
        List<CounselorPoolShift> shifts = shiftRepository.findByPoolIdOrderByDayOfWeekAscStartTimeAsc(poolId);
        if (shifts.isEmpty()) {
            return List.of();
        }
        List<String> shiftIds = shifts.stream().map(CounselorPoolShift::getId).toList();
        Map<String, List<PoolShiftMemberDTO>> membersByShiftId = shiftMemberRepository.findByShiftIdIn(shiftIds).stream()
                .map(CounselorPoolService::toShiftMemberDTO)
                .collect(Collectors.groupingBy(PoolShiftMemberDTO::getShiftId));

        return shifts.stream().map(s -> {
            PoolShiftDTO dto = CounselorPoolService.toShiftDTO(s);
            dto.setMembers(membersByShiftId.getOrDefault(s.getId(), List.of()));
            return dto;
        }).toList();
    }

    // ────────────────────────────────────────────────────────────────
    // Validation
    // ────────────────────────────────────────────────────────────────

    /**
     * Validate the submitted shift blocks. Per-block checks (valid day, present
     * times, start before end) always run. When {@code requireFullCoverage} is
     * true (TIME_BASED), additionally enforce that every day of the week is
     * covered 00:00:00 → 23:59:59 with no gaps. Overlaps are always allowed
     * (handled by the routing engine). When false (shift-aware ROUND_ROBIN),
     * gaps and uncovered days are intentional — outside a window no one is
     * picked — so the coverage walk is skipped.
     */
    private void validateSchedule(List<WeeklyScheduleRequest.ShiftBlock> blocks, boolean requireFullCoverage) {
        // Group by day-of-week
        Map<String, List<WeeklyScheduleRequest.ShiftBlock>> byDay = new HashMap<>();
        for (WeeklyScheduleRequest.ShiftBlock b : blocks) {
            String day = b.getDayOfWeek();
            try {
                ShiftDayOfWeek.valueOf(day);
            } catch (IllegalArgumentException | NullPointerException e) {
                throw new VacademyException("Invalid day_of_week: " + day);
            }
            if (b.getStartTime() == null || b.getEndTime() == null) {
                throw new VacademyException("Each shift must have start_time and end_time");
            }
            if (!b.getStartTime().before(b.getEndTime())) {
                throw new VacademyException("Shift start_time must be before end_time (no overnight shifts in v1)");
            }
            byDay.computeIfAbsent(day, k -> new ArrayList<>()).add(b);
        }

        if (!requireFullCoverage) {
            return; // Gaps allowed — per-block validation above is sufficient.
        }

        for (ShiftDayOfWeek day : ShiftDayOfWeek.values()) {
            List<WeeklyScheduleRequest.ShiftBlock> dayBlocks = byDay.get(day.name());
            if (dayBlocks == null || dayBlocks.isEmpty()) {
                throw new VacademyException("Day " + day.name() + " has no shifts. All 7 days must be covered.");
            }
            // Sort by start time; overlapping shifts are allowed so we check coverage by walking the union.
            dayBlocks.sort(Comparator.comparing(WeeklyScheduleRequest.ShiftBlock::getStartTime));

            // First block must start at 00:00
            if (!dayBlocks.get(0).getStartTime().equals(START_OF_DAY)) {
                throw new VacademyException("Day " + day.name() + " does not start at 00:00:00 (first block: "
                        + dayBlocks.get(0).getStartTime() + ")");
            }

            // Walk and ensure coverage is continuous up to end of day. Track the furthest end-time covered.
            Time coveredUntil = dayBlocks.get(0).getEndTime();
            for (int i = 1; i < dayBlocks.size(); i++) {
                WeeklyScheduleRequest.ShiftBlock next = dayBlocks.get(i);
                if (next.getStartTime().after(coveredUntil)) {
                    throw new VacademyException("Day " + day.name() + " has a gap between "
                            + coveredUntil + " and " + next.getStartTime());
                }
                if (next.getEndTime().after(coveredUntil)) {
                    coveredUntil = next.getEndTime();
                }
            }

            if (coveredUntil.before(END_OF_DAY)) {
                throw new VacademyException("Day " + day.name() + " does not cover up to 23:59:59 (covered until "
                        + coveredUntil + ")");
            }
        }
    }
}
