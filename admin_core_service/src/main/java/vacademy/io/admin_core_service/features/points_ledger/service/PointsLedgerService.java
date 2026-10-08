package vacademy.io.admin_core_service.features.points_ledger.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.institute.service.InstituteTimezoneService;
import vacademy.io.admin_core_service.features.points_ledger.dto.PointsBreakdownItemDTO;
import vacademy.io.admin_core_service.features.points_ledger.dto.PointsSummaryDTO;
import vacademy.io.admin_core_service.features.points_ledger.entity.PointsLedger;
import vacademy.io.admin_core_service.features.points_ledger.entity.PointsSourceType;
import vacademy.io.admin_core_service.features.points_ledger.repository.PointsLedgerRepository;

import java.sql.Timestamp;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * The one way points are awarded anywhere in the platform.
 *
 * Points per level matches the learner app's existing constant (500) so the level a
 * learner already sees does not jump when the number moves server-side.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class PointsLedgerService {

    /** Must stay in lock-step with XP_PER_LEVEL in the learner app's play-gamification.ts. */
    public static final int POINTS_PER_LEVEL = 500;

    private static final Map<String, String> SOURCE_LABELS = Map.of(
            PointsSourceType.ENGAGEMENT_ITEM.name(), "Daily engagement",
            PointsSourceType.ENGAGEMENT_STREAK.name(), "Streak bonus",
            PointsSourceType.ASSESSMENT.name(), "Assessments",
            PointsSourceType.ACTIVITY.name(), "Learning activity",
            PointsSourceType.MANUAL.name(), "Awarded by your institute");

    private final PointsLedgerRepository pointsLedgerRepository;
    private final InstituteTimezoneService instituteTimezoneService;

    /**
     * Award points, at most once per idempotency key.
     *
     * Runs in its OWN transaction: a duplicate key is a normal, expected outcome
     * (double-tapped submit, retried request) and must not roll back the caller's
     * work — the attempt row that triggered the award still has to stand.
     *
     * @return the new row, or empty when these points were already awarded.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<PointsLedger> award(String userId, String instituteId, String packageSessionId,
                                        PointsSourceType sourceType, String sourceId,
                                        int points, String reason, String idempotencyKey) {
        return award(userId, instituteId, packageSessionId, sourceType, sourceId, points, reason,
                idempotencyKey, null);
    }

    /**
     * Same, with an explicit {@code awardedAt}.
     *
     * Backfilled points MUST carry the instant they were earned, not the instant the
     * backfill ran. Otherwise a learner's whole history lands inside "today", and one
     * backfill hands every learner a full history inside the current weekly
     * leaderboard window. Null means now.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Optional<PointsLedger> award(String userId, String instituteId, String packageSessionId,
                                        PointsSourceType sourceType, String sourceId,
                                        int points, String reason, String idempotencyKey,
                                        Timestamp awardedAt) {
        if (userId == null || userId.isBlank() || instituteId == null || instituteId.isBlank()) {
            log.warn("[points] refusing award with missing user/institute (source={}, id={})", sourceType, sourceId);
            return Optional.empty();
        }
        if (points == 0) return Optional.empty();
        if (idempotencyKey == null || idempotencyKey.isBlank()) {
            log.warn("[points] refusing award with no idempotency key (user={}, source={})", userId, sourceType);
            return Optional.empty();
        }

        // Cheap pre-check; the unique index below is the real guarantee.
        if (pointsLedgerRepository.existsByIdempotencyKey(idempotencyKey)) {
            return Optional.empty();
        }

        PointsLedger row = new PointsLedger();
        row.setUserId(userId);
        row.setInstituteId(instituteId);
        row.setPackageSessionId(packageSessionId);
        row.setSourceType(sourceType.name());
        row.setSourceId(sourceId);
        row.setPoints(points);
        row.setReason(reason);
        row.setAwardedAt(awardedAt != null ? awardedAt : new Timestamp(System.currentTimeMillis()));
        row.setIdempotencyKey(idempotencyKey);

        try {
            return Optional.of(pointsLedgerRepository.saveAndFlush(row));
        } catch (DataIntegrityViolationException e) {
            // Concurrent duplicate — the other writer won. Correct outcome, not an error.
            log.debug("[points] duplicate award suppressed for key {}", idempotencyKey);
            return Optional.empty();
        }
    }

    /**
     * Reverse every award tied to a source row by writing compensating negative rows.
     * Used when an item is deleted or a score is corrected. The original rows stay —
     * the ledger is append-only and must remain auditable.
     *
     * @return how many reversal rows were written.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int reverse(PointsSourceType sourceType, String sourceId, String reason) {
        List<PointsLedger> originals =
                pointsLedgerRepository.findBySourceTypeAndSourceId(sourceType.name(), sourceId);
        int written = 0;
        for (PointsLedger original : originals) {
            if (original.getPoints() == null || original.getPoints() == 0) continue;
            // A reversal of a reversal is a no-op: the key collides and is suppressed.
            String key = "REVERSAL:" + original.getId();
            if (pointsLedgerRepository.existsByIdempotencyKey(key)) continue;

            PointsLedger reversal = new PointsLedger();
            reversal.setUserId(original.getUserId());
            reversal.setInstituteId(original.getInstituteId());
            reversal.setPackageSessionId(original.getPackageSessionId());
            reversal.setSourceType(original.getSourceType());
            reversal.setSourceId(original.getSourceId());
            reversal.setPoints(-original.getPoints());
            reversal.setReason(reason);
            reversal.setAwardedAt(new Timestamp(System.currentTimeMillis()));
            reversal.setIdempotencyKey(key);
            try {
                pointsLedgerRepository.saveAndFlush(reversal);
                written++;
            } catch (DataIntegrityViolationException e) {
                log.debug("[points] duplicate reversal suppressed for {}", original.getId());
            }
        }
        return written;
    }

    /** The learner's own points state: total, windows, level and per-source breakdown. */
    @Transactional(readOnly = true)
    public PointsSummaryDTO getSummary(String instituteId, String userId) {
        long total = pointsLedgerRepository.sumForUser(instituteId, userId);

        ZoneId zone = instituteTimezoneService.getZone(instituteId);
        LocalDate today = LocalDate.now(zone);
        Timestamp startOfToday = toTimestamp(today, zone);
        Timestamp startOfWeek = toTimestamp(today.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)), zone);

        long todayPoints = pointsLedgerRepository.sumForUserSince(instituteId, userId, startOfToday);
        long weekPoints = pointsLedgerRepository.sumForUserSince(instituteId, userId, startOfWeek);

        List<PointsBreakdownItemDTO> breakdown = new ArrayList<>();
        for (Object[] row : pointsLedgerRepository.breakdownForUser(instituteId, userId)) {
            String key = String.valueOf(row[0]);
            long points = row[1] == null ? 0L : ((Number) row[1]).longValue();
            if (points == 0) continue;
            breakdown.add(new PointsBreakdownItemDTO(key, SOURCE_LABELS.getOrDefault(key, key), points));
        }
        breakdown.sort((a, b) -> Long.compare(b.getPoints(), a.getPoints()));

        // Negative totals are possible in theory (reversals) — clamp so level maths stays sane.
        long safeTotal = Math.max(0, total);
        int level = (int) (safeTotal / POINTS_PER_LEVEL) + 1;
        int pointsToNextLevel = (int) (POINTS_PER_LEVEL - (safeTotal % POINTS_PER_LEVEL));

        return new PointsSummaryDTO(total, weekPoints, todayPoints, level, pointsToNextLevel, breakdown);
    }

    /** Start-of-day in the institute's zone, as a UTC-based SQL timestamp. */
    private Timestamp toTimestamp(LocalDate localDate, ZoneId zone) {
        return Timestamp.from(localDate.atStartOfDay(zone).toInstant());
    }
}
